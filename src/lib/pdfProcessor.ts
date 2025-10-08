import { PDFDocument, PDFName } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { logger } from './logger';
import {
  validatePdfFile,
  validateExcelFile,
  validateBatchSize,
  withRetry,
  withTimeout,
  normalizeFileName,
  ensureFileExtension,
  cleanupResources,
  DEFAULT_RETRY_OPTIONS,
  type FileValidationResult,
  type RetryOptions,
} from './fileValidation';

export interface MergeInstruction {
  sourceFiles: string[];
  outputName: string;
}

export interface DeletePagesInstruction {
  sourceFile: string;
  pagesToDelete: number[];
  outputName: string;
}

export interface SplitInstruction {
  sourceFile: string;
  pageRanges: { start: number; end: number }[];
  outputNames: string[];
}

export interface ReorderInstruction {
  sourceFile: string;
  newPageOrder: number[];
  outputName: string;
}

export interface RenameInstruction {
  oldName: string;
  newName: string;
}

export const parseMergeExcel = async (file: File): Promise<MergeInstruction[]> => {
  // Validate file first
  const validation = validateExcelFile(file);
  if (!validation.isValid) {
    throw new Error(`Invalid Excel file: ${validation.error}`);
  }

  return withRetry(async () => {
    return new Promise<MergeInstruction[]>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          if (!workbook.SheetNames.length) {
            throw new Error('Excel file contains no worksheets');
          }
          
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
          
          if (jsonData.length < 2) {
            throw new Error('Excel file must contain at least a header row and one data row');
          }
          
          const instructions: MergeInstruction[] = [];
          
          // Skip header row
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;
            
            // Take first 5 columns as source files, last column as output name
            const sourceFiles = row.slice(0, 5)
              .filter(Boolean)
              .map(f => normalizeFileName(String(f).trim()))
              .filter(name => name.length > 0);
            const outputName = row[5] ? normalizeFileName(String(row[5]).trim()) : '';
            
            if (sourceFiles.length > 0 && outputName) {
              instructions.push({ 
                sourceFiles, 
                outputName: ensureFileExtension(outputName, 'pdf') 
              });
            }
          }
          
          if (instructions.length === 0) {
            throw new Error('No valid merge instructions found in Excel file');
          }
          
          resolve(instructions);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read Excel file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }, DEFAULT_RETRY_OPTIONS, 'parseMergeExcel');
};

export const parseDeletePagesExcel = async (file: File): Promise<DeletePagesInstruction[]> => {
  // Validate file first
  const validation = validateExcelFile(file);
  if (!validation.isValid) {
    throw new Error(`Invalid Excel file: ${validation.error}`);
  }

  return withRetry(async () => {
    return new Promise<DeletePagesInstruction[]>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          if (!workbook.SheetNames.length) {
            throw new Error('Excel file contains no worksheets');
          }
          
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number)[][];
          
          if (jsonData.length < 2) {
            throw new Error('Excel file must contain at least a header row and one data row');
          }
          
          const instructions: DeletePagesInstruction[] = [];
          
          // Skip header row
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length < 3) continue;
            
            const sourceFile = row[0] ? normalizeFileName(String(row[0]).trim()) : '';
            const deletePages = row[1] ? String(row[1]).trim() : '';
            const outputName = row[2] ? normalizeFileName(String(row[2]).trim()) : '';
            
            if (sourceFile && deletePages && outputName) {
              const pagesToDelete = parsePageNumbers(deletePages);
              if (pagesToDelete.length > 0) {
                instructions.push({ 
                  sourceFile, 
                  pagesToDelete, 
                  outputName: ensureFileExtension(outputName, 'pdf') 
                });
              }
            }
          }
          
          if (instructions.length === 0) {
            throw new Error('No valid delete page instructions found in Excel file');
          }
          
          resolve(instructions);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read Excel file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }, DEFAULT_RETRY_OPTIONS, 'parseDeletePagesExcel');
};

const parsePageNumbers = (pageString: string): number[] => {
  const pages: number[] = [];
  const parts = pageString.split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue; // Skip empty parts
    
    if (trimmed.includes('-')) {
      const rangeParts = trimmed.split('-');
      if (rangeParts.length !== 2) {
        logger.warn(`Invalid page range format: ${trimmed}`);
        continue;
      }
      
      const start = parseInt(rangeParts[0].trim());
      const end = parseInt(rangeParts[1].trim());
      
      if (isNaN(start) || isNaN(end)) {
        logger.warn(`Invalid page numbers in range: ${trimmed}`);
        continue;
      }
      
      if (start > end) {
        logger.warn(`Invalid page range (start > end): ${trimmed}`);
        continue;
      }
      
      if (start < 1) {
        logger.warn(`Page numbers must be >= 1: ${trimmed}`);
        continue;
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i - 1); // Convert to 0-indexed
      }
    } else {
      const pageNum = parseInt(trimmed);
      if (isNaN(pageNum)) {
        logger.warn(`Invalid page number: ${trimmed}`);
        continue;
      }
      
      if (pageNum < 1) {
        logger.warn(`Page numbers must be >= 1: ${trimmed}`);
        continue;
      }
      
      pages.push(pageNum - 1); // Convert to 0-indexed
    }
  }
  
  // Remove duplicates and sort
  return [...new Set(pages)].sort((a, b) => a - b);
};

export const mergePDFs = async (
  instruction: MergeInstruction,
  pdfFiles: Map<string, File>,
  onProgress: (progress: number) => void
): Promise<{ data: Uint8Array; missingFiles: string[] }> => {
  // Validate batch size
  const filesToProcess = instruction.sourceFiles
    .map(name => pdfFiles.get(name))
    .filter((file): file is File => file !== undefined);
  
  const batchValidation = validateBatchSize(filesToProcess);
  if (!batchValidation.isValid) {
    throw new Error(`Batch validation failed: ${batchValidation.error}`);
  }

  return withTimeout(
    withRetry(async () => {
      const mergedPdf = await PDFDocument.create();
      const missingFiles: string[] = [];
      const tempResources: Array<{ cleanup: () => void }> = [];
      
      try {
        // Preserve metadata from first valid PDF
        let metadataPreserved = false;
        
        for (let i = 0; i < instruction.sourceFiles.length; i++) {
          const fileName = instruction.sourceFiles[i];
          const file = pdfFiles.get(fileName);
          
          if (!file) {
            logger.warn(`PDF file not found: ${fileName}, skipping...`);
            missingFiles.push(fileName);
            continue;
          }
          
          // Validate PDF file
          const validation = validatePdfFile(file);
          if (!validation.isValid) {
            logger.warn(`Invalid PDF file ${fileName}: ${validation.error}, skipping...`);
            missingFiles.push(fileName);
            continue;
          }
          
          try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            
            // Preserve metadata from first valid PDF
            if (!metadataPreserved && pdf.getPageCount() > 0) {
              try {
                const title = pdf.getTitle() || instruction.outputName.replace(/\.pdf$/i, '');
                mergedPdf.setTitle(title);
                mergedPdf.setProducer('Bulk PDF Processor');
                mergedPdf.setCreator('Bulk PDF Processor');
                mergedPdf.setModificationDate(new Date());
                metadataPreserved = true;
              } catch (metaError) {
                logger.warn('Failed to preserve metadata:', metaError);
              }
            }
            
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
            
            // Clean up PDF document
            tempResources.push({
              cleanup: () => {
                // PDF-lib doesn't expose cleanup, but we can nullify references
                (pdf as any) = null;
              }
            });
            
          } catch (pdfError) {
            logger.warn(`Failed to process PDF ${fileName}:`, pdfError);
            missingFiles.push(fileName);
            continue;
          }
          
          onProgress(((i + 1) / instruction.sourceFiles.length) * 100);
        }
        
        if (mergedPdf.getPageCount() === 0) {
          throw new Error('No valid PDF pages found to merge');
        }
        
        const data = await mergedPdf.save();
        return { data, missingFiles };
        
      } finally {
        // Cleanup temporary resources
        await cleanupResources(tempResources);
      }
    }, DEFAULT_RETRY_OPTIONS, `mergePDFs-${instruction.outputName}`),
    30000, // 30 second timeout
    `mergePDFs-${instruction.outputName}`
  );
};

export const deletePagesFromPDF = async (
  instruction: DeletePagesInstruction,
  pdfFiles: Map<string, File>,
  onProgress: (progress: number) => void
): Promise<{ data: Uint8Array; missingFiles: string[] } | null> => {
  const file = pdfFiles.get(instruction.sourceFile);
  
  if (!file) {
    logger.warn(`PDF file not found: ${instruction.sourceFile}, skipping...`);
    return null;
  }
  
  // Validate PDF file
  const validation = validatePdfFile(file);
  if (!validation.isValid) {
    logger.warn(`Invalid PDF file ${instruction.sourceFile}: ${validation.error}, skipping...`);
    return null;
  }

  return withTimeout(
    withRetry(async () => {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const originalPageCount = pdf.getPageCount();
      
      // Validate page numbers
      const validPagesToDelete = instruction.pagesToDelete
        .filter(pageIndex => pageIndex >= 0 && pageIndex < originalPageCount)
        .sort((a, b) => b - a); // Sort in descending order to avoid index shifting
      
      if (validPagesToDelete.length === 0) {
        logger.warn(`No valid pages to delete from: ${instruction.sourceFile}`);
        return null;
      }
      
      // Check if we would delete all pages
      if (validPagesToDelete.length >= originalPageCount) {
        logger.warn(`All pages would be deleted from: ${instruction.sourceFile}, skipping...`);
        return null;
      }
      
      let deletedCount = 0;
      for (const pageIndex of validPagesToDelete) {
        try {
          pdf.removePage(pageIndex);
          deletedCount++;
        } catch (removeError) {
          logger.warn(`Failed to remove page ${pageIndex} from ${instruction.sourceFile}:`, removeError);
        }
      }
      
      if (pdf.getPageCount() === 0) {
        logger.warn(`No pages remaining after deletion from: ${instruction.sourceFile}, skipping...`);
        return null;
      }
      
      // Preserve metadata
      try {
        const title = pdf.getTitle() || instruction.outputName.replace(/\.pdf$/i, '');
        pdf.setTitle(title);
        pdf.setModificationDate(new Date());
      } catch (metaError) {
        logger.warn('Failed to update metadata:', metaError);
      }
      
      onProgress(100);
      const data = await pdf.save();
      return { data, missingFiles: [] };
      
    }, DEFAULT_RETRY_OPTIONS, `deletePages-${instruction.sourceFile}`),
    15000, // 15 second timeout
    `deletePages-${instruction.sourceFile}`
  );
};

export const downloadPDF = (pdfBytes: Uint8Array, fileName: string) => {
  const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  saveAs(blob, fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
};

export const parseSplitExcel = async (file: File): Promise<SplitInstruction[]> => {
  // Validate file first
  const validation = validateExcelFile(file);
  if (!validation.isValid) {
    throw new Error(`Invalid Excel file: ${validation.error}`);
  }

  return withRetry(async () => {
    return new Promise<SplitInstruction[]>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          if (!workbook.SheetNames.length) {
            throw new Error('Excel file contains no worksheets');
          }
          
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
          
          if (jsonData.length < 2) {
            throw new Error('Excel file must contain at least a header row and one data row');
          }
          
          const instructions: SplitInstruction[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length < 3) continue;
            
            const sourceFile = row[0] ? normalizeFileName(String(row[0]).trim()) : '';
            const ranges = row[1] ? String(row[1]).trim() : '';
            const names = row[2] ? String(row[2]).trim() : '';
            
            if (sourceFile && ranges && names) {
              const pageRanges = ranges.split(',').map(range => {
                const trimmed = range.trim();
                if (!trimmed) return null;
                
                if (trimmed.includes('-')) {
                  const rangeParts = trimmed.split('-');
                  if (rangeParts.length !== 2) return null;
                  
                  const start = parseInt(rangeParts[0].trim());
                  const end = parseInt(rangeParts[1].trim());
                  
                  if (isNaN(start) || isNaN(end) || start > end || start < 1) return null;
                  
                  return { start: start - 1, end: end - 1 };
                }
                
                const page = parseInt(trimmed);
                if (isNaN(page) || page < 1) return null;
                
                return { start: page - 1, end: page - 1 };
              }).filter((range): range is { start: number; end: number } => range !== null);
              
              const outputNames = names.split(',')
                .map(n => normalizeFileName(n.trim()))
                .filter(n => n.length > 0)
                .map(name => ensureFileExtension(name, 'pdf'));
              
              if (pageRanges.length > 0 && outputNames.length > 0) {
                instructions.push({ sourceFile, pageRanges, outputNames });
              }
            }
          }
          
          if (instructions.length === 0) {
            throw new Error('No valid split instructions found in Excel file');
          }
          
          resolve(instructions);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read Excel file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }, DEFAULT_RETRY_OPTIONS, 'parseSplitExcel');
};

export const parseReorderExcel = async (file: File): Promise<ReorderInstruction[]> => {
  // Validate file first
  const validation = validateExcelFile(file);
  if (!validation.isValid) {
    throw new Error(`Invalid Excel file: ${validation.error}`);
  }

  return withRetry(async () => {
    return new Promise<ReorderInstruction[]>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          if (!workbook.SheetNames.length) {
            throw new Error('Excel file contains no worksheets');
          }
          
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
          
          if (jsonData.length < 2) {
            throw new Error('Excel file must contain at least a header row and one data row');
          }
          
          const instructions: ReorderInstruction[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length < 3) continue;
            
            const sourceFile = row[0] ? normalizeFileName(String(row[0]).trim()) : '';
            const pageOrder = row[1] ? String(row[1]).trim() : '';
            const outputName = row[2] ? normalizeFileName(String(row[2]).trim()) : '';
            
            if (sourceFile && pageOrder && outputName) {
              const newPageOrder = parsePageNumbers(pageOrder);
              if (newPageOrder.length > 0) {
                instructions.push({ 
                  sourceFile, 
                  newPageOrder, 
                  outputName: ensureFileExtension(outputName, 'pdf') 
                });
              }
            }
          }
          
          if (instructions.length === 0) {
            throw new Error('No valid reorder instructions found in Excel file');
          }
          
          resolve(instructions);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read Excel file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }, DEFAULT_RETRY_OPTIONS, 'parseReorderExcel');
};

export const parseRenameExcel = async (file: File): Promise<RenameInstruction[]> => {
  // Validate file first
  const validation = validateExcelFile(file);
  if (!validation.isValid) {
    throw new Error(`Invalid Excel file: ${validation.error}`);
  }

  return withRetry(async () => {
    return new Promise<RenameInstruction[]>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          if (!workbook.SheetNames.length) {
            throw new Error('Excel file contains no worksheets');
          }
          
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
          
          if (jsonData.length < 2) {
            throw new Error('Excel file must contain at least a header row and one data row');
          }
          
          const instructions: RenameInstruction[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length < 2) continue;
            
            const oldName = row[0] ? normalizeFileName(String(row[0]).trim()) : '';
            const newName = row[1] ? normalizeFileName(String(row[1]).trim()) : '';
            
            if (oldName && newName) {
              instructions.push({ oldName, newName });
            }
          }
          
          if (instructions.length === 0) {
            throw new Error('No valid rename instructions found in Excel file');
          }
          
          resolve(instructions);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read Excel file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }, DEFAULT_RETRY_OPTIONS, 'parseRenameExcel');
};

export const splitPDF = async (
  instruction: SplitInstruction,
  pdfFiles: Map<string, File>,
  onProgress: (progress: number) => void
): Promise<{ name: string; data: Uint8Array }[] | null> => {
  const file = pdfFiles.get(instruction.sourceFile);
  
  if (!file) {
    logger.warn(`PDF file not found: ${instruction.sourceFile}, skipping...`);
    return null;
  }
  
  // Validate PDF file
  const validation = validatePdfFile(file);
  if (!validation.isValid) {
    logger.warn(`Invalid PDF file ${instruction.sourceFile}: ${validation.error}, skipping...`);
    return null;
  }

  return withTimeout(
    withRetry(async () => {
      const arrayBuffer = await file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer);
      const results: { name: string; data: Uint8Array }[] = [];
      const tempResources: Array<{ cleanup: () => void }> = [];
      
      try {
        const sourcePageCount = sourcePdf.getPageCount();
        
        // Validate page ranges
        const validRanges = instruction.pageRanges.filter(range => {
          return range.start >= 0 && 
                 range.end >= range.start && 
                 range.start < sourcePageCount && 
                 range.end < sourcePageCount;
        });
        
        if (validRanges.length === 0) {
          logger.warn(`No valid page ranges found for: ${instruction.sourceFile}`);
          return null;
        }
        
        for (let i = 0; i < validRanges.length; i++) {
          const range = validRanges[i];
          const outputName = instruction.outputNames[i] || 
            `${instruction.sourceFile.replace(/\.pdf$/i, '')}_part${i + 1}.pdf`;
          
          const newPdf = await PDFDocument.create();
          
          // Preserve metadata from source
          try {
            const title = sourcePdf.getTitle() || 
              outputName.replace(/\.pdf$/i, '');
            newPdf.setTitle(title);
            newPdf.setProducer('Bulk PDF Processor');
            newPdf.setCreator('Bulk PDF Processor');
            newPdf.setModificationDate(new Date());
          } catch (metaError) {
            logger.warn('Failed to set metadata for split PDF:', metaError);
          }
          
          for (let pageNum = range.start; pageNum <= range.end; pageNum++) {
            try {
              const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNum]);
              newPdf.addPage(copiedPage);
            } catch (copyError) {
              logger.warn(`Failed to copy page ${pageNum} for ${outputName}:`, copyError);
            }
          }
          
          // Only save if we have at least one page
          if (newPdf.getPageCount() > 0) {
            const pdfBytes = await newPdf.save();
            results.push({ 
              name: ensureFileExtension(outputName, 'pdf'), 
              data: pdfBytes 
            });
          } else {
            logger.warn(`Split range ${i + 1} resulted in empty PDF, skipping: ${outputName}`);
          }
          
          // Clean up PDF document
          tempResources.push({
            cleanup: () => {
              (newPdf as any) = null;
            }
          });
          
          onProgress(((i + 1) / validRanges.length) * 100);
        }
        
        return results.length > 0 ? results : null;
        
      } finally {
        // Cleanup temporary resources
        await cleanupResources(tempResources);
      }
      
    }, DEFAULT_RETRY_OPTIONS, `splitPDF-${instruction.sourceFile}`),
    20000, // 20 second timeout
    `splitPDF-${instruction.sourceFile}`
  );
};

export const reorderPDF = async (
  instruction: ReorderInstruction,
  pdfFiles: Map<string, File>,
  onProgress: (progress: number) => void
): Promise<{ data: Uint8Array; missingFiles: string[] } | null> => {
  const file = pdfFiles.get(instruction.sourceFile);
  
  if (!file) {
    logger.warn(`PDF file not found: ${instruction.sourceFile}, skipping...`);
    return null;
  }
  
  // Validate PDF file
  const validation = validatePdfFile(file);
  if (!validation.isValid) {
    logger.warn(`Invalid PDF file ${instruction.sourceFile}: ${validation.error}, skipping...`);
    return null;
  }

  return withTimeout(
    withRetry(async () => {
      const arrayBuffer = await file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer);
      const newPdf = await PDFDocument.create();
      const sourcePageCount = sourcePdf.getPageCount();
      
      // Validate page order
      const validPageOrder = instruction.newPageOrder.filter(pageIndex => 
        pageIndex >= 0 && pageIndex < sourcePageCount
      );
      
      if (validPageOrder.length === 0) {
        logger.warn(`No valid pages to reorder in: ${instruction.sourceFile}`);
        return null;
      }
      
      // Preserve metadata from source
      try {
        const title = sourcePdf.getTitle() || instruction.outputName.replace(/\.pdf$/i, '');
        newPdf.setTitle(title);
        newPdf.setProducer('Bulk PDF Processor');
        newPdf.setCreator('Bulk PDF Processor');
        newPdf.setModificationDate(new Date());
      } catch (metaError) {
        logger.warn('Failed to set metadata for reordered PDF:', metaError);
      }
      
      let validPagesAdded = 0;
      for (const pageIndex of validPageOrder) {
        try {
          const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
          newPdf.addPage(copiedPage);
          validPagesAdded++;
        } catch (copyError) {
          logger.warn(`Failed to copy page ${pageIndex} for ${instruction.outputName}:`, copyError);
        }
      }
      
      if (validPagesAdded === 0) {
        logger.warn(`No valid pages to reorder in: ${instruction.sourceFile}`);
        return null;
      }
      
      onProgress(100);
      const data = await newPdf.save();
      return { data, missingFiles: [] };
      
    }, DEFAULT_RETRY_OPTIONS, `reorderPDF-${instruction.sourceFile}`),
    15000, // 15 second timeout
    `reorderPDF-${instruction.sourceFile}`
  );
};

export const renamePDF = async (
  instruction: RenameInstruction,
  pdfFiles: Map<string, File>
): Promise<{ name: string; data: Uint8Array } | null> => {
  const file = pdfFiles.get(instruction.oldName);
  
  if (!file) {
    logger.warn(`PDF file not found: ${instruction.oldName}, skipping...`);
    return null;
  }
  
  // Validate PDF file
  const validation = validatePdfFile(file);
  if (!validation.isValid) {
    logger.warn(`Invalid PDF file ${instruction.oldName}: ${validation.error}, skipping...`);
    return null;
  }

  return withTimeout(
    withRetry(async () => {
      const srcBytes = await file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(srcBytes);
      const newPdf = await PDFDocument.create();

      // Copy all pages into a brand new PDF to fully reset metadata
      const copiedPages = await newPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
      copiedPages.forEach((p) => newPdf.addPage(p));

      const baseTitle = normalizeFileName(
        instruction.newName.endsWith('.pdf')
          ? instruction.newName.slice(0, -4)
          : instruction.newName
      );

      // Set classic Info dictionary metadata
      try {
        newPdf.setTitle(baseTitle);
        newPdf.setProducer('Bulk PDF Processor');
        newPdf.setCreator('Bulk PDF Processor');
        newPdf.setModificationDate(new Date());
      } catch (metaError) {
        logger.warn('Failed to set basic metadata:', metaError);
      }

      // Set XMP metadata as well (some viewers prefer XMP over Info)
      try {
        const now = new Date().toISOString();
        const xmp = `<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>\n` +
          `<x:xmpmeta xmlns:x="adobe:ns:meta/">\n` +
          `  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">\n` +
          `    <rdf:Description rdf:about="" xmp:CreateDate="${now}" xmp:ModifyDate="${now}" pdf:Producer="Bulk PDF Processor">\n` +
          `      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${baseTitle}</rdf:li></rdf:Alt></dc:title>\n` +
          `      <xmp:CreatorTool>Bulk PDF Processor</xmp:CreatorTool>\n` +
          `    </rdf:Description>\n` +
          `  </rdf:RDF>\n` +
          `</x:xmpmeta>\n` +
          `<?xpacket end="w"?>`;

        const xmlBytes = new TextEncoder().encode(xmp);
        const metadataRef = newPdf.context.register(
          newPdf.context.stream(xmlBytes, {
            Type: PDFName.of('Metadata'),
            Subtype: PDFName.of('XML'),
          })
        );
        newPdf.catalog.set(PDFName.of('Metadata'), metadataRef);
      } catch (err) {
        logger.warn('Failed to set XMP metadata on rename (continuing):', err);
      }

      const updatedBytes = await newPdf.save();
      return { 
        name: ensureFileExtension(instruction.newName, 'pdf'), 
        data: updatedBytes 
      };
      
    }, DEFAULT_RETRY_OPTIONS, `renamePDF-${instruction.oldName}`),
    10000, // 10 second timeout
    `renamePDF-${instruction.oldName}`
  );
};

export const downloadPDFsAsZip = async (pdfFiles: { name: string; data: Uint8Array }[]) => {
  if (pdfFiles.length === 0) {
    throw new Error('No PDF files to download');
  }

  return withRetry(async () => {
    const zip = new JSZip();
    const tempResources: Array<{ cleanup: () => void }> = [];
    
    try {
      pdfFiles.forEach(({ name, data }) => {
        const fileName = ensureFileExtension(name, 'pdf');
        zip.file(fileName, data);
      });
      
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const zipName = `processed_pdfs_${timestamp}.zip`;
      
      saveAs(zipBlob, zipName);
      
      // Cleanup blob after download
      tempResources.push({
        cleanup: () => {
          if (zipBlob) {
            URL.revokeObjectURL(URL.createObjectURL(zipBlob));
          }
        }
      });
      
    } finally {
      await cleanupResources(tempResources);
    }
    
  }, DEFAULT_RETRY_OPTIONS, 'downloadPDFsAsZip');
};
