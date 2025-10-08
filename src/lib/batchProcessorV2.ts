import { supabase } from '@/integrations/supabase/client';
import { FILE_PROCESSING } from './constants';
import { validateBatch, canProcessInMemory } from './fileValidation';
import { logger } from './logger';
import { performanceMonitor } from './performanceMonitor';
import { monitoring } from './monitoring';
import {
  DeletePagesInstruction,
  SplitInstruction,
  ReorderInstruction,
  RenameInstruction,
  deletePagesFromPDF,
  splitPDF,
  reorderPDF,
  renamePDF,
  downloadPDFsAsZip,
} from './pdfProcessor';
import { splitPDFV2, withRetry } from './pdfProcessorV2';
import { uploadBatchToStorage, pollJobStatus, downloadJobResult, cleanupUploadedFiles } from './batchProcessor';
import { saveAs } from 'file-saver';
import { getWorkerPool } from './workers/workerPool';
import { errorHandler, PDFProcessingError, ErrorCodes } from './errorHandler';
import { checkRateLimit } from './rateLimiter';
import { metricsCollector } from './metricsCollector';

export interface ProcessOperationOptions {
  operation: 'delete' | 'split' | 'reorder' | 'rename';
  pdfFiles: File[];
  instructions: any[];
  userId: string;
  onProgress?: (progress: number, message: string) => void;
  onBatchProgress?: (current: number, total: number) => void;
}

export interface ProcessOperationResult {
  success: boolean;
  message: string;
  errors?: string[];
  processedCount?: number;
}

/**
 * Enhanced batch processor with automatic client/server routing
 */
export async function processOperationV2({
  operation,
  pdfFiles,
  instructions,
  userId,
  onProgress,
  onBatchProgress,
}: ProcessOperationOptions): Promise<ProcessOperationResult> {
  const operationId = `${operation}_${Date.now()}`;
  performanceMonitor.startOperation(operationId, `PDF ${operation} operation`);
  
  // Check rate limits
  const rateLimit = await checkRateLimit(userId, operation as any);
  if (!rateLimit.allowed) {
    return {
      success: false,
      message: `Rate limit exceeded. Please try again after ${rateLimit.resetAt.toLocaleTimeString()}`,
      errors: [`Rate limit: ${rateLimit.remaining} requests remaining`],
    };
  }

  // Calculate total size
  const totalSize = pdfFiles.reduce((sum, file) => sum + file.size, 0);
  
  // Start metrics collection
  metricsCollector.startOperation(
    operationId,
    `pdf_${operation}`,
    pdfFiles.length,
    totalSize,
    { instructionCount: instructions.length }
  );

  try {
    // Validate files
    if (onProgress) onProgress(0, 'Validating files...');
    const validation = validateBatch(pdfFiles);
    
    if (validation.errors.length > 0 && validation.validFiles.length === 0) {
      return {
        success: false,
        message: 'File validation failed',
        errors: validation.errors,
      };
    }

    // Decide on processing strategy
    const shouldUseClientSide = canProcessInMemory(validation.validFiles) && 
                               instructions.length <= 10 &&
                               validation.totalSize < 50 * 1024 * 1024; // 50MB

    logger.info(`Processing ${operation} operation: ${instructions.length} instructions, ${shouldUseClientSide ? 'client-side' : 'server-side'}`);

    // Track operation
    return await monitoring.trackOperation(
      `pdf_${operation}`,
      validation.validFiles.length,
      validation.totalSize,
      async () => {
        if (shouldUseClientSide) {
          return await processClientSideOperation({
            operation,
            pdfFiles: validation.validFiles,
            instructions,
            onProgress,
          });
        } else {
          return await processServerSideOperation({
            operation,
            pdfFiles: validation.validFiles,
            instructions,
            userId,
            onProgress,
            onBatchProgress,
            validationErrors: validation.errors,
          });
        }
      }
    );
    
    // End metrics collection
    metricsCollector.endOperation(operationId, result.success, result.errors?.join('; '));
    
    return result;
  } catch (error) {
    metricsCollector.endOperation(operationId, false, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  } finally {
    performanceMonitor.endOperation(operationId);
  }
}

/**
 * Client-side processing for small batches
 */
async function processClientSideOperation({
  operation,
  pdfFiles,
  instructions,
  onProgress,
}: {
  operation: 'delete' | 'split' | 'reorder' | 'rename';
  pdfFiles: File[];
  instructions: any[];
  onProgress?: (progress: number, message: string) => void;
}): Promise<ProcessOperationResult> {
  const workerPool = getWorkerPool();
  
  try {
    if (onProgress) onProgress(10, `Processing ${operation} operations locally...`);
    
    const pdfFileMap = new Map<string, File>();
    pdfFiles.forEach(file => pdfFileMap.set(file.name, file));
    
    const processedPDFs: { name: string; data: Uint8Array }[] = [];
    const errors: string[] = [];
    let processed = 0;
    
    // Check if we can use Web Workers
    const useWorkers = typeof Worker !== 'undefined' && operation !== 'merge'; // Merge has dependencies
    
    if (useWorkers && instructions.length > 1) {
      // Process in parallel using Web Workers
      const BATCH_SIZE = 4; // Process 4 items at a time
      
      for (let i = 0; i < instructions.length; i += BATCH_SIZE) {
        const batch = instructions.slice(i, i + BATCH_SIZE);
        const progressBase = 10 + (i / instructions.length) * 80;
        
        if (onProgress) {
          onProgress(progressBase, `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(instructions.length / BATCH_SIZE)}`);
        }
        
        const batchPromises = batch.map(async (instruction, index) => {
          try {
            const actualIndex = i + index;
            return await processInstructionWithWorker(
              workerPool,
              operation,
              instruction,
              pdfFileMap,
              (p) => {
                const itemProgress = progressBase + (index / batch.length) * (BATCH_SIZE / instructions.length) * 80;
                onProgress?.(itemProgress + (p * 0.8 / batch.length), `Processing item ${actualIndex + 1}/${instructions.length}`);
              }
            );
          } catch (err) {
            const error = await errorHandler.handle(err as Error, {
              operation,
              fileName: instruction.sourceFile || instruction.oldName,
            });
            return { error: errorHandler.getUserMessage(error) };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        for (const result of batchResults) {
          if ('error' in result) {
            errors.push(result.error);
          } else if (Array.isArray(result)) {
            processedPDFs.push(...result);
          } else if (result) {
            processedPDFs.push(result);
          }
          processed++;
        }
      }
    } else {
      // Sequential processing (fallback or single item)
      for (const instruction of instructions) {
        try {
          const progressBase = 10 + (processed / instructions.length) * 80;
          
          if (onProgress) {
            onProgress(progressBase, `Processing ${processed + 1}/${instructions.length}`);
          }

          let result: any;
          
          switch (operation) {
          case 'delete':
            result = await withRetry(
              () => deletePagesFromPDF(instruction as DeletePagesInstruction, pdfFileMap, 
                (p) => onProgress?.(progressBase + (p * 0.8 / instructions.length), `Deleting pages...`)),
              `Delete pages from ${instruction.sourceFile}`
            );
            if (result) {
              processedPDFs.push({ name: instruction.outputName, data: result.data });
            }
            break;

          case 'split':
            result = await withRetry(
              () => splitPDFV2(instruction as SplitInstruction, pdfFileMap,
                (p) => onProgress?.(progressBase + (p * 0.8 / instructions.length), `Splitting PDF...`)),
              `Split ${instruction.sourceFile}`
            );
            if (result) {
              processedPDFs.push(...result);
            }
            break;

          case 'reorder':
            result = await withRetry(
              () => reorderPDF(instruction as ReorderInstruction, pdfFileMap,
                (p) => onProgress?.(progressBase + (p * 0.8 / instructions.length), `Reordering pages...`)),
              `Reorder ${instruction.sourceFile}`
            );
            if (result) {
              processedPDFs.push({ name: instruction.outputName, data: result.data });
            }
            break;

          case 'rename':
            result = await withRetry(
              () => renamePDF(instruction as RenameInstruction, pdfFileMap),
              `Rename ${instruction.oldName}`
            );
            if (result) {
              processedPDFs.push(result);
            }
            break;
        }

        processed++;
      } catch (err) {
        const error = `Failed to process ${instruction.sourceFile || instruction.oldName}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        logger.error(error);
        errors.push(error);
      }
    }
  }

    // Download results
    if (onProgress) onProgress(90, 'Preparing download...');
    
    if (processedPDFs.length === 0) {
      return {
        success: false,
        message: 'No files were processed successfully',
        errors,
      };
    }

    await downloadPDFsAsZip(processedPDFs);

    return {
      success: true,
      message: 'Processing completed',
      errors,
      processedCount: processedPDFs.length,
    };
  } catch (error) {
    logger.error(`Client-side ${operation} failed:`, error);
    return {
      success: false,
      message: `Client-side processing failed`,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Server-side processing for large batches
 */
async function processServerSideOperation({
  operation,
  pdfFiles,
  instructions,
  userId,
  onProgress,
  onBatchProgress,
  validationErrors,
}: {
  operation: 'delete' | 'split' | 'reorder' | 'rename';
  pdfFiles: File[];
  instructions: any[];
  userId: string;
  onProgress?: (progress: number, message: string) => void;
  onBatchProgress?: (current: number, total: number) => void;
  validationErrors: string[];
}): Promise<ProcessOperationResult> {
  let uploadedFiles: string[] = [];
  
  try {
    // Upload files
    if (onProgress) onProgress(0, 'Uploading files to secure storage...');
    
    const uploadResult = await uploadBatchToStorage(
      pdfFiles,
      userId,
      (progress, message) => {
        if (onProgress) {
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

    // Process in batches
    const maxInstructionsPerJob = 50;
    const instructionBatches: any[][] = [];
    
    for (let i = 0; i < instructions.length; i += maxInstructionsPerJob) {
      instructionBatches.push(instructions.slice(i, i + maxInstructionsPerJob));
    }
    
    const allErrors: string[] = [...validationErrors];
    if (uploadResult.failed.length > 0) {
      allErrors.push(...uploadResult.failed.map(f => `Upload failed - ${f.fileName}: ${f.error}`));
    }
    
    let totalProcessed = 0;
    
    for (let batchIndex = 0; batchIndex < instructionBatches.length; batchIndex++) {
      const batch = instructionBatches[batchIndex];
      
      if (onBatchProgress) {
        onBatchProgress(batchIndex + 1, instructionBatches.length);
      }
      
      if (onProgress) {
        const baseProgress = 30 + (batchIndex / instructionBatches.length) * 60;
        onProgress(baseProgress, `Starting batch ${batchIndex + 1}/${instructionBatches.length}...`);
      }
      
      // Start server job
      const { data: start, error: startError } = await supabase.functions.invoke('process-pdf-operations', {
        body: { operation, instructions: batch },
      });
      
      if (startError || !start?.jobId) {
        allErrors.push(`Failed to start batch ${batchIndex + 1}: ${startError?.message || 'Unknown error'}`);
        continue;
      }
      
      const jobId = start.jobId;
      
      // Poll for completion
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
          saveAs(resultBlob, `${operation}_results_batch_${batchIndex + 1}_${timestamp}.zip`);
        }
      }
      
      if (jobResult.errors && jobResult.errors.length > 0) {
        allErrors.push(...jobResult.errors);
      }
    }
    
    // Cleanup
    if (onProgress) onProgress(95, 'Cleaning up...');
    await cleanupUploadedFiles(uploadedFiles, userId);
    
    return {
      success: totalProcessed > 0,
      message: totalProcessed > 0 
        ? `Successfully processed ${totalProcessed} ${operation} operations` 
        : 'No operations were processed successfully',
      errors: allErrors,
      processedCount: totalProcessed,
    };
  } catch (error) {
    logger.error(`Server-side ${operation} failed:`, error);
    
    // Cleanup on error
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

/**
 * Process instruction using Web Worker for better performance
 */
async function processInstructionWithWorker(
  workerPool: any,
  operation: string,
  instruction: any,
  pdfFileMap: Map<string, File>,
  onProgress?: (progress: number) => void
): Promise<any> {
  // Prepare data for worker
  const prepareFileData = async (fileName: string) => {
    const file = pdfFileMap.get(fileName);
    if (!file) {
      throw new PDFProcessingError({
        code: ErrorCodes.FILE_NOT_FOUND,
        message: `File not found: ${fileName}`,
        recoverable: false,
        fileName,
      });
    }
    const buffer = await file.arrayBuffer();
    return { name: fileName, buffer };
  };

  let message: any = {
    id: crypto.randomUUID(),
    type: operation,
    data: {}
  };

  switch (operation) {
    case 'delete':
      message.data = {
        file: await prepareFileData(instruction.sourceFile),
        pagesToDelete: instruction.pagesToDelete,
        outputName: instruction.outputName,
      };
      break;

    case 'split':
      message.data = {
        file: await prepareFileData(instruction.sourceFile),
        ranges: instruction.pageRanges,
        outputNames: instruction.outputNames,
      };
      break;

    case 'reorder':
      message.data = {
        file: await prepareFileData(instruction.sourceFile),
        newPageOrder: instruction.newPageOrder,
        outputName: instruction.outputName,
      };
      break;

    case 'rename':
      message.data = {
        file: await prepareFileData(instruction.oldName),
        newName: instruction.newName,
      };
      break;
  }

  // Execute in worker
  const result = await workerPool.execute(message);
  
  // Convert result back to Uint8Array format
  if (Array.isArray(result)) {
    return result.map((item: any) => ({
      name: item.name,
      data: new Uint8Array(item.buffer),
    }));
  } else {
    return {
      name: result.name,
      data: new Uint8Array(result.buffer),
    };
  }
}