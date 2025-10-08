import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { logger } from './logger';
import { FILE_PROCESSING } from './constants';
import { sanitizeFileName, canProcessInMemory } from './fileValidation';
import { 
  MergeInstruction, 
  DeletePagesInstruction, 
  SplitInstruction, 
  ReorderInstruction, 
  RenameInstruction 
} from './pdfProcessor';

// Process files in smaller batches to avoid memory issues
export async function processInChunks<T>(
  items: T[],
  processor: (chunk: T[]) => Promise<any>,
  chunkSize: number = FILE_PROCESSING.CLIENT_SIDE_CONCURRENCY
): Promise<any[]> {
  const results: any[] = [];
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await processor(chunk);
    results.push(...(Array.isArray(chunkResults) ? chunkResults : [chunkResults]));
    
    // Allow browser to breathe between chunks
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Force garbage collection hint
    if (window.gc) {
      window.gc();
    }
  }
  
  return results;
}

// Enhanced merge with memory management
export async function mergePDFsV2(
  instructions: MergeInstruction[],
  pdfFiles: Map<string, File>,
  onProgress: (progress: number, message: string) => void
): Promise<{ name: string; data: Uint8Array; missingFiles: string[] }[]> {
  const results: { name: string; data: Uint8Array; missingFiles: string[] }[] = [];
  let processedCount = 0;

  // Process instructions in chunks
  const processChunk = async (chunk: MergeInstruction[]) => {
    const chunkResults = [];
    
    for (const instruction of chunk) {
      try {
        onProgress(
          (processedCount / instructions.length) * 100,
          `Merging ${instruction.outputName} (${processedCount + 1}/${instructions.length})`
        );

        const mergedPdf = await PDFDocument.create();
        const missingFiles: string[] = [];

        // Process source files one at a time to minimize memory usage
        for (const fileName of instruction.sourceFiles) {
          const file = pdfFiles.get(fileName);
          
          if (!file) {
            logger.warn(`PDF file not found: ${fileName}, skipping...`);
            missingFiles.push(fileName);
            continue;
          }

          try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer, {
              ignoreEncryption: true,
              throwOnInvalidObject: false,
            });
            
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
            
            // Clear reference to allow garbage collection
            (pdf as any).context = null;
          } catch (err) {
            logger.error(`Error processing ${fileName}:`, err);
            missingFiles.push(fileName);
          }
        }

        const data = await mergedPdf.save({ useObjectStreams: false });
        const sanitizedName = sanitizeFileName(instruction.outputName);
        
        chunkResults.push({
          name: sanitizedName.endsWith('.pdf') ? sanitizedName : `${sanitizedName}.pdf`,
          data,
          missingFiles,
        });

        // Clear the merged PDF from memory
        (mergedPdf as any).context = null;
        
        processedCount++;
      } catch (err) {
        logger.error(`Failed to process merge instruction:`, err);
        onProgress(
          (processedCount / instructions.length) * 100,
          `Error: Failed to merge ${instruction.outputName}`
        );
      }
    }
    
    return chunkResults;
  };

  const chunkResults = await processInChunks(instructions, processChunk, 5);
  results.push(...chunkResults.flat());

  return results;
}

// Optimized batch download with streaming ZIP creation
export async function downloadPDFsAsZipV2(
  pdfFiles: { name: string; data: Uint8Array }[],
  onProgress?: (progress: number, message: string) => void
) {
  const zip = new JSZip();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  
  // Add files to ZIP in chunks to manage memory
  const chunkSize = 10;
  for (let i = 0; i < pdfFiles.length; i += chunkSize) {
    const chunk = pdfFiles.slice(i, i + chunkSize);
    
    chunk.forEach(({ name, data }) => {
      const fileName = name.endsWith('.pdf') ? name : `${name}.pdf`;
      zip.file(fileName, data, { compression: 'DEFLATE', compressionOptions: { level: 6 } });
    });
    
    if (onProgress) {
      onProgress(
        ((i + chunk.length) / pdfFiles.length) * 100,
        `Preparing download: ${i + chunk.length}/${pdfFiles.length} files`
      );
    }
    
    // Allow UI to update
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  // Generate ZIP with streaming if supported
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    streamFiles: true,
  });
  
  saveAs(zipBlob, `processed_pdfs_${timestamp}.zip`);
}

// Enhanced split operation with better memory management
export async function splitPDFV2(
  instruction: SplitInstruction,
  pdfFiles: Map<string, File>,
  onProgress: (progress: number) => void
): Promise<{ name: string; data: Uint8Array }[] | null> {
  const file = pdfFiles.get(instruction.sourceFile);
  
  if (!file) {
    logger.warn(`PDF file not found: ${instruction.sourceFile}, skipping...`);
    return null;
  }
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const sourcePdf = await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    });
    
    const results: { name: string; data: Uint8Array }[] = [];
    
    for (let i = 0; i < instruction.pageRanges.length; i++) {
      const range = instruction.pageRanges[i];
      const outputName = instruction.outputNames[i] || `${instruction.sourceFile}_part${i + 1}.pdf`;
      
      const newPdf = await PDFDocument.create();
      
      // Copy pages one at a time
      for (let pageNum = range.start; pageNum <= range.end; pageNum++) {
        if (pageNum >= 0 && pageNum < sourcePdf.getPageCount()) {
          const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNum]);
          newPdf.addPage(copiedPage);
        }
      }
      
      const pdfBytes = await newPdf.save({ useObjectStreams: false });
      results.push({ 
        name: sanitizeFileName(outputName), 
        data: pdfBytes 
      });
      
      // Clear reference
      (newPdf as any).context = null;
      
      onProgress(((i + 1) / instruction.pageRanges.length) * 100);
    }
    
    // Clear source PDF reference
    (sourcePdf as any).context = null;
    
    return results;
  } catch (err) {
    logger.error(`Failed to split PDF:`, err);
    return null;
  }
}

// Create a retry wrapper for operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = FILE_PROCESSING.MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err as Error;
      logger.warn(`${operationName} failed (attempt ${attempt + 1}/${maxRetries}):`, err);
      
      if (attempt < maxRetries - 1) {
        // Exponential backoff
        const delay = FILE_PROCESSING.RETRY_DELAY * Math.pow(FILE_PROCESSING.RETRY_MULTIPLIER, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`${operationName} failed after ${maxRetries} attempts: ${lastError?.message}`);
}