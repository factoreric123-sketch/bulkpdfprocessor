import { supabase } from '@/integrations/supabase/client';
import { FILE_PROCESSING } from './constants';
import { validateBatch, sanitizeFileName } from './fileValidation';
import { logger } from './logger';

interface BatchUploadResult {
  successful: string[];
  failed: { fileName: string; error: string }[];
}

// Upload files to Supabase storage with concurrency control
export async function uploadBatchToStorage(
  files: File[],
  userId: string,
  onProgress?: (progress: number, message: string) => void
): Promise<BatchUploadResult> {
  const bucket = supabase.storage.from('pdf-uploads');
  const result: BatchUploadResult = { successful: [], failed: [] };
  
  // Validate batch first
  const validation = validateBatch(files);
  if (validation.errors.length > 0) {
    validation.errors.forEach(error => {
      result.failed.push({ fileName: 'Batch validation', error });
    });
    if (validation.validFiles.length === 0) {
      return result;
    }
  }
  
  const validFiles = validation.validFiles;
  const totalFiles = validFiles.length;
  let uploadedCount = 0;
  
  // Process files in chunks for better memory management
  const chunkSize = FILE_PROCESSING.SERVER_SIDE_BATCH_SIZE;
  
  for (let i = 0; i < validFiles.length; i += chunkSize) {
    const chunk = validFiles.slice(i, i + chunkSize);
    
    // Upload chunk in parallel with limited concurrency
    const uploadPromises = chunk.map(async (file) => {
      try {
        const sanitizedName = sanitizeFileName(file.name);
        const path = `${userId}/${sanitizedName}`;
        
        // Check if file already exists and get its size
        const { data: existingFiles } = await bucket.list(userId, {
          search: sanitizedName,
          limit: 1,
        });
        
        // Upload with retry logic
        let attempts = 0;
        let uploadError: Error | null = null;
        
        while (attempts < FILE_PROCESSING.MAX_RETRIES) {
          try {
            const { error } = await bucket.upload(path, file, {
              upsert: true,
              contentType: 'application/pdf',
            });
            
            if (error) throw error;
            
            result.successful.push(sanitizedName);
            uploadedCount++;
            
            if (onProgress) {
              const progress = (uploadedCount / totalFiles) * 100;
              onProgress(progress, `Uploaded ${uploadedCount}/${totalFiles} files`);
            }
            
            break; // Success, exit retry loop
          } catch (err) {
            uploadError = err as Error;
            attempts++;
            
            if (attempts < FILE_PROCESSING.MAX_RETRIES) {
              // Exponential backoff
              const delay = FILE_PROCESSING.RETRY_DELAY * Math.pow(FILE_PROCESSING.RETRY_MULTIPLIER, attempts - 1);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        if (uploadError && attempts >= FILE_PROCESSING.MAX_RETRIES) {
          throw uploadError;
        }
      } catch (err) {
        logger.error(`Failed to upload ${file.name}:`, err);
        result.failed.push({
          fileName: file.name,
          error: err instanceof Error ? err.message : 'Unknown upload error',
        });
      }
    });
    
    // Wait for chunk to complete
    await Promise.all(uploadPromises);
    
    // Small delay between chunks to avoid overwhelming the server
    if (i + chunkSize < validFiles.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return result;
}

// Poll job status with proper timeout and error handling
export async function pollJobStatus(
  jobId: string,
  onProgress?: (progress: number, message: string) => void,
  timeoutMs: number = FILE_PROCESSING.JOB_TIMEOUT
): Promise<{ success: boolean; resultPath?: string; errors?: string[] }> {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds
  
  return new Promise((resolve) => {
    const timer = setInterval(async () => {
      try {
        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(timer);
          resolve({ success: false, errors: ['Job timeout - processing took too long'] });
          return;
        }
        
        const { data, error } = await supabase
          .from('processing_jobs')
          .select('status, processed, total, errors, result_path')
          .eq('id', jobId)
          .single();
        
        if (error) {
          clearInterval(timer);
          resolve({ success: false, errors: [error.message] });
          return;
        }
        
        if (!data) {
          clearInterval(timer);
          resolve({ success: false, errors: ['Job not found'] });
          return;
        }
        
        // Update progress
        if (onProgress && data.total > 0) {
          const progress = (data.processed / data.total) * 100;
          const message = `Processing: ${data.processed}/${data.total} items (${data.status})`;
          onProgress(progress, message);
        }
        
        // Check if job is complete
        if (data.status === 'completed') {
          clearInterval(timer);
          resolve({
            success: true,
            resultPath: data.result_path,
            errors: data.errors || [],
          });
        } else if (data.status === 'failed') {
          clearInterval(timer);
          resolve({
            success: false,
            errors: data.errors || ['Job failed without specific error'],
          });
        }
        
        // Job still processing, continue polling
      } catch (err) {
        logger.error('Error polling job status:', err);
        // Don't stop polling on transient errors
      }
    }, pollInterval);
  });
}

// Download result from storage
export async function downloadJobResult(
  resultPath: string,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob | null> {
  try {
    if (onProgress) {
      onProgress(0, 'Preparing download...');
    }
    
    const { data, error } = await supabase.storage
      .from('pdf-results')
      .download(resultPath);
    
    if (error) {
      logger.error('Failed to download result:', error);
      return null;
    }
    
    if (onProgress) {
      onProgress(100, 'Download complete');
    }
    
    return data;
  } catch (err) {
    logger.error('Error downloading result:', err);
    return null;
  }
}

// Clean up uploaded files after processing
export async function cleanupUploadedFiles(
  fileNames: string[],
  userId: string
): Promise<void> {
  const bucket = supabase.storage.from('pdf-uploads');
  const filePaths = fileNames.map(name => `${userId}/${sanitizeFileName(name)}`);
  
  try {
    const { error } = await bucket.remove(filePaths);
    if (error) {
      logger.warn('Failed to cleanup some uploaded files:', error);
    }
  } catch (err) {
    logger.warn('Error during file cleanup:', err);
  }
}

// Process large batches by splitting them into manageable chunks
export async function processLargeBatch<T>(
  items: T[],
  processFunction: (chunk: T[]) => Promise<any>,
  chunkSize: number = FILE_PROCESSING.SERVER_SIDE_BATCH_SIZE,
  onProgress?: (progress: number, message: string) => void
): Promise<any[]> {
  const results: any[] = [];
  const totalItems = items.length;
  let processedCount = 0;
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkNumber = Math.floor(i / chunkSize) + 1;
    const totalChunks = Math.ceil(items.length / chunkSize);
    
    if (onProgress) {
      onProgress(
        (processedCount / totalItems) * 100,
        `Processing batch ${chunkNumber}/${totalChunks}`
      );
    }
    
    try {
      const chunkResult = await processFunction(chunk);
      results.push(chunkResult);
      processedCount += chunk.length;
    } catch (err) {
      logger.error(`Failed to process chunk ${chunkNumber}:`, err);
      throw err;
    }
    
    // Small delay between chunks
    if (i + chunkSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}