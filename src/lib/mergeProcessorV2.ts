import { supabase } from '@/integrations/supabase/client';
import { parseMergeExcel, type MergeInstruction } from './pdfProcessor';
import { mergePDFsV2, downloadPDFsAsZipV2 } from './pdfProcessorV2';
import { uploadBatchToStorage, pollJobStatus, downloadJobResult, cleanupUploadedFiles } from './batchProcessor';
import { validateBatch, canProcessInMemory } from './fileValidation';
import { FILE_PROCESSING } from './constants';
import { logger } from './logger';
import { saveAs } from 'file-saver';

interface ProcessMergeOptions {
  pdfFiles: File[];
  excelFile: File;
  userId: string;
  onProgress?: (progress: number, message: string) => void;
  onBatchProgress?: (current: number, total: number) => void;
}

interface ProcessMergeResult {
  success: boolean;
  message: string;
  errors?: string[];
  processedCount?: number;
}

export async function processMergeV2({
  pdfFiles,
  excelFile,
  userId,
  onProgress,
  onBatchProgress,
}: ProcessMergeOptions): Promise<ProcessMergeResult> {
  try {
    // Step 1: Parse instructions
    if (onProgress) onProgress(0, 'Parsing Excel instructions...');
    const instructions = await parseMergeExcel(excelFile);
    
    if (instructions.length === 0) {
      return {
        success: false,
        message: 'No valid instructions found in Excel file',
      };
    }

    // Step 2: Validate files
    const validation = validateBatch(pdfFiles);
    if (validation.errors.length > 0 && validation.validFiles.length === 0) {
      return {
        success: false,
        message: 'File validation failed',
        errors: validation.errors,
      };
    }

    // Step 3: Decide on processing strategy
    const shouldUseClientSide = canProcessInMemory(validation.validFiles) && 
                               instructions.length <= 10;

    if (shouldUseClientSide) {
      // Use client-side processing for small batches
      return await processClientSideMerge({
        pdfFiles: validation.validFiles,
        instructions,
        onProgress,
      });
    } else {
      // Use server-side processing for large batches
      return await processServerSideMerge({
        pdfFiles: validation.validFiles,
        instructions,
        userId,
        onProgress,
        onBatchProgress,
        validationErrors: validation.errors,
      });
    }
  } catch (error) {
    logger.error('Merge processing failed:', error);
    return {
      success: false,
      message: 'Processing failed',
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

// Client-side processing for small batches
async function processClientSideMerge({
  pdfFiles,
  instructions,
  onProgress,
}: {
  pdfFiles: File[];
  instructions: MergeInstruction[];
  onProgress?: (progress: number, message: string) => void;
}): Promise<ProcessMergeResult> {
  try {
    if (onProgress) onProgress(10, 'Processing PDFs locally...');
    
    // Create file map
    const pdfFileMap = new Map<string, File>();
    pdfFiles.forEach(file => pdfFileMap.set(file.name, file));
    
    // Process merges with enhanced processor
    const results = await mergePDFsV2(
      instructions,
      pdfFileMap,
      (progress, message) => {
        if (onProgress) {
          // Scale progress from 10% to 90%
          onProgress(10 + (progress * 0.8), message);
        }
      }
    );
    
    // Download results
    if (onProgress) onProgress(90, 'Preparing download...');
    
    if (results.length === 1) {
      // Single file - download directly
      const { name, data } = results[0];
      const blob = new Blob([data], { type: 'application/pdf' });
      saveAs(blob, name);
    } else {
      // Multiple files - create ZIP
      await downloadPDFsAsZipV2(results, onProgress);
    }
    
    // Collect any errors
    const allErrors: string[] = [];
    results.forEach(result => {
      if (result.missingFiles.length > 0) {
        allErrors.push(`${result.name}: missing files - ${result.missingFiles.join(', ')}`);
      }
    });
    
    return {
      success: true,
      message: 'Processing completed',
      errors: allErrors,
      processedCount: results.length,
    };
  } catch (error) {
    logger.error('Client-side merge failed:', error);
    return {
      success: false,
      message: 'Client-side processing failed',
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

// Server-side processing for large batches
async function processServerSideMerge({
  pdfFiles,
  instructions,
  userId,
  onProgress,
  onBatchProgress,
  validationErrors,
}: {
  pdfFiles: File[];
  instructions: MergeInstruction[];
  userId: string;
  onProgress?: (progress: number, message: string) => void;
  onBatchProgress?: (current: number, total: number) => void;
  validationErrors: string[];
}): Promise<ProcessMergeResult> {
  let uploadedFiles: string[] = [];
  
  try {
    // Step 1: Upload files to storage (0-30% progress)
    if (onProgress) onProgress(0, 'Uploading files to secure storage...');
    
    const uploadResult = await uploadBatchToStorage(
      pdfFiles,
      userId,
      (progress, message) => {
        if (onProgress) {
          // Scale to 0-30%
          onProgress(progress * 0.3, message);
        }
      }
    );
    
    uploadedFiles = uploadResult.successful;
    
    if (uploadResult.successful.length === 0) {
      return {
        success: false,
        message: 'Failed to upload any files',
        errors: uploadResult.failed.map(f => `${f.fileName}: ${f.error}`),
      };
    }
    
    // Step 2: Process in batches if needed
    const maxInstructionsPerJob = 50;
    const instructionBatches: MergeInstruction[][] = [];
    
    for (let i = 0; i < instructions.length; i += maxInstructionsPerJob) {
      instructionBatches.push(instructions.slice(i, i + maxInstructionsPerJob));
    }
    
    const allErrors: string[] = [...validationErrors];
    if (uploadResult.failed.length > 0) {
      allErrors.push(...uploadResult.failed.map(f => `Upload failed - ${f.fileName}: ${f.error}`));
    }
    
    let totalProcessed = 0;
    
    // Process each batch
    for (let batchIndex = 0; batchIndex < instructionBatches.length; batchIndex++) {
      const batch = instructionBatches[batchIndex];
      
      if (onBatchProgress) {
        onBatchProgress(batchIndex + 1, instructionBatches.length);
      }
      
      // Start server job (use v2 function if available, otherwise fall back to v1)
      if (onProgress) {
        const baseProgress = 30 + (batchIndex / instructionBatches.length) * 60;
        onProgress(baseProgress, `Starting batch ${batchIndex + 1}/${instructionBatches.length}...`);
      }
      
      const { data: start } = await supabase.functions.invoke('process-pdf-batch-v2', {
        body: { operation: 'merge', instructions: batch },
      }).catch(() => 
        // Fallback to v1 if v2 not deployed yet
        supabase.functions.invoke('process-pdf-batch', {
          body: { operation: 'merge', instructions: batch },
        })
      );
      
      const jobId = (start as any)?.jobId;
      if (!jobId) {
        allErrors.push(`Failed to start batch ${batchIndex + 1}`);
        continue;
      }
      
      // Poll for completion (30-90% progress)
      const jobResult = await pollJobStatus(
        jobId,
        (progress, message) => {
          if (onProgress) {
            const baseProgress = 30 + (batchIndex / instructionBatches.length) * 60;
            const batchProgress = (progress / 100) * (60 / instructionBatches.length);
            onProgress(baseProgress + batchProgress, message);
          }
        }
      );
      
      if (jobResult.success && jobResult.resultPath) {
        totalProcessed += batch.length;
        
        // Download result
        if (onProgress) onProgress(90, 'Downloading results...');
        const resultBlob = await downloadJobResult(jobResult.resultPath);
        
        if (resultBlob) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          saveAs(resultBlob, `merged_pdfs_batch_${batchIndex + 1}_${timestamp}.zip`);
        }
      }
      
      if (jobResult.errors && jobResult.errors.length > 0) {
        allErrors.push(...jobResult.errors);
      }
    }
    
    // Cleanup uploaded files
    if (onProgress) onProgress(95, 'Cleaning up...');
    await cleanupUploadedFiles(uploadedFiles, userId);
    
    return {
      success: totalProcessed > 0,
      message: totalProcessed > 0 
        ? `Successfully processed ${totalProcessed} merge operations` 
        : 'No operations were processed successfully',
      errors: allErrors,
      processedCount: totalProcessed,
    };
  } catch (error) {
    logger.error('Server-side merge failed:', error);
    
    // Attempt cleanup on error
    if (uploadedFiles.length > 0) {
      await cleanupUploadedFiles(uploadedFiles, userId).catch(() => {});
    }
    
    return {
      success: false,
      message: 'Server-side processing failed',
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}