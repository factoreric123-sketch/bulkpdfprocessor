import mammoth from 'mammoth';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import {
  validateWordFile,
  validatePdfFile,
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
import { logger } from './logger';

export interface WordToPdfInstruction {
  sourceFile: string;
  outputName: string;
}

export interface PdfToWordInstruction {
  sourceFile: string;
  outputName: string;
}

export interface RenameWordInstruction {
  oldName: string;
  newName: string;
}

// Convert Word document to PDF with improved formatting preservation
export const convertWordToPdf = async (
  instruction: WordToPdfInstruction,
  fileMap: Map<string, File>,
  onProgress?: (progress: number) => void
): Promise<{ name: string; data: Uint8Array }> => {
  const wordFile = fileMap.get(instruction.sourceFile);
  if (!wordFile) {
    throw new Error(`Word file not found: ${instruction.sourceFile}`);
  }

  // Validate Word file
  const validation = validateWordFile(wordFile);
  if (!validation.isValid) {
    throw new Error(`Invalid Word file: ${validation.error}`);
  }

  return withTimeout(
    withRetry(async () => {
      onProgress?.(10);

      // Convert Word to HTML using mammoth with better options
      const arrayBuffer = await wordFile.arrayBuffer();
      const result = await mammoth.convertToHtml({ 
        arrayBuffer,
        convertImage: mammoth.images.imgElement((image) => {
          // Handle images by converting to base64
          return image.read('base64').then((imageBuffer) => {
            return {
              src: `data:${image.contentType};base64,${imageBuffer}`
            };
          });
        })
      });
      
      const html = result.value;
      const warnings = result.messages.filter(m => m.type === 'warning');
      
      if (warnings.length > 0) {
        logger.warn('Word conversion warnings:', warnings);
      }

      onProgress?.(30);

      // Create PDF with improved text formatting
      const pdfDoc = await PDFDocument.create();
      
      // Set metadata
      try {
        const title = instruction.outputName.replace(/\.pdf$/i, '');
        pdfDoc.setTitle(title);
        pdfDoc.setProducer('Bulk Document Processor');
        pdfDoc.setCreator('Bulk Document Processor');
        pdfDoc.setModificationDate(new Date());
      } catch (metaError) {
        logger.warn('Failed to set PDF metadata:', metaError);
      }
      
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 12;
      const lineHeight = fontSize * 1.4;
      const margin = 72; // 1 inch margins
      
      // Parse HTML more intelligently
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Extract text with better structure preservation
      const textContent = extractTextFromHTML(tempDiv);
      
      let currentPage = pdfDoc.addPage();
      let { width, height } = currentPage.getSize();
      let y = height - margin;
      const maxWidth = width - margin * 2;
      
      const lines = textContent.split('\n');
      
      for (const line of lines) {
        if (y < margin + lineHeight) {
          // Add new page if needed
          currentPage = pdfDoc.addPage();
          const size = currentPage.getSize();
          width = size.width;
          height = size.height;
          y = height - margin;
        }
        
        if (line.trim()) {
          // Wrap long lines
          const wrappedLines = wrapText(line, font, fontSize, maxWidth);
          
          for (const wrappedLine of wrappedLines) {
            if (y < margin + lineHeight) {
              currentPage = pdfDoc.addPage();
              const size = currentPage.getSize();
              width = size.width;
              height = size.height;
              y = height - margin;
            }
            
            currentPage.drawText(wrappedLine, {
              x: margin,
              y,
              size: fontSize,
              font,
              color: rgb(0, 0, 0),
            });
            y -= lineHeight;
          }
        } else {
          y -= lineHeight / 2; // Smaller spacing for empty lines
        }
      }

      onProgress?.(90);

      const pdfBytes = await pdfDoc.save();
      onProgress?.(100);

      // Ensure output name has .pdf extension
      const outputName = ensureFileExtension(instruction.outputName, 'pdf');

      return {
        name: outputName,
        data: pdfBytes,
      };
      
    }, DEFAULT_RETRY_OPTIONS, `convertWordToPdf-${instruction.sourceFile}`),
    60000, // 60 second timeout for Word conversion
    `convertWordToPdf-${instruction.sourceFile}`
  );
};

// Convert PDF to Word document with improved text extraction
export const convertPdfToWord = async (
  instruction: PdfToWordInstruction,
  fileMap: Map<string, File>,
  onProgress?: (progress: number) => void
): Promise<{ name: string; data: Blob }> => {
  const pdfFile = fileMap.get(instruction.sourceFile);
  if (!pdfFile) {
    throw new Error(`PDF file not found: ${instruction.sourceFile}`);
  }

  // Validate PDF file
  const validation = validatePdfFile(pdfFile);
  if (!validation.isValid) {
    throw new Error(`Invalid PDF file: ${validation.error}`);
  }

  return withTimeout(
    withRetry(async () => {
      onProgress?.(10);

      const arrayBuffer = await pdfFile.arrayBuffer();

      // Lazy-load pdf.js for robust client-side text extraction
      const pdfjs: any = await import('pdfjs-dist/build/pdf.mjs');
      if (pdfjs?.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.js';
      }

      onProgress?.(20);

      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;

      onProgress?.(30);

      const paragraphs: Paragraph[] = [];
      const tempResources: Array<{ cleanup: () => void }> = [];
      
      try {
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          // Improved text extraction with better spacing
          const pageText = extractTextFromPage(textContent);

          if (pageText.trim()) {
            // Split into paragraphs by sentence boundaries or double spaces
            const chunks = pageText.split(/(?<=[.!?])\s{2,}|\n{2,}/);
            
            for (const chunk of chunks) {
              const txt = chunk.trim();
              if (txt) {
                paragraphs.push(
                  new Paragraph({
                    children: [new TextRun({ 
                      text: txt, 
                      size: 24, // 12pt
                      font: 'Calibri'
                    })],
                    spacing: { after: 200 } // 10pt spacing after paragraph
                  })
                );
              } else {
                // Empty paragraph for spacing
                paragraphs.push(new Paragraph({ 
                  children: [],
                  spacing: { after: 100 }
                }));
              }
            }
          } else {
            // Keep an empty paragraph if nothing was extracted for this page
            paragraphs.push(new Paragraph({ 
              children: [],
              spacing: { after: 200 }
            }));
          }

          // Page break between pages (except for the last page)
          if (pageNum < pdf.numPages) {
            paragraphs.push(new Paragraph({ 
              children: [new TextRun({ text: '', break: 1 })],
              spacing: { after: 0 }
            }));
          }

          onProgress?.(30 + Math.round((pageNum / pdf.numPages) * 50));
        }

        onProgress?.(85);

        const doc = new Document({
          sections: [
            {
              properties: {
                page: {
                  margin: {
                    top: 720, // 0.5 inch
                    right: 720,
                    bottom: 720,
                    left: 720,
                  },
                },
              },
              children: paragraphs,
            },
          ],
        });

        const blob = await Packer.toBlob(doc);
        onProgress?.(100);

        const outName = ensureFileExtension(instruction.outputName, 'docx');

        return { name: outName, data: blob };
        
      } finally {
        // Cleanup temporary resources
        await cleanupResources(tempResources);
      }
      
    }, DEFAULT_RETRY_OPTIONS, `convertPdfToWord-${instruction.sourceFile}`),
    60000, // 60 second timeout for PDF conversion
    `convertPdfToWord-${instruction.sourceFile}`
  );
};

// Rename Word document with validation
export const renameWordFile = async (
  instruction: RenameWordInstruction,
  fileMap: Map<string, File>
): Promise<{ name: string; data: Blob }> => {
  const wordFile = fileMap.get(instruction.oldName);
  if (!wordFile) {
    throw new Error(`Word file not found: ${instruction.oldName}`);
  }

  // Validate Word file
  const validation = validateWordFile(wordFile);
  if (!validation.isValid) {
    throw new Error(`Invalid Word file: ${validation.error}`);
  }

  return withRetry(async () => {
    const blob = new Blob([await wordFile.arrayBuffer()], {
      type: wordFile.type,
    });

    // Ensure the output name has the correct extension
    let outputName = normalizeFileName(instruction.newName);
    if (!outputName.endsWith('.docx') && !outputName.endsWith('.doc')) {
      // Determine extension from original file
      const ext = instruction.oldName.endsWith('.docx') ? '.docx' : '.doc';
      outputName = `${outputName}${ext}`;
    }

    return {
      name: outputName,
      data: blob,
    };
    
  }, DEFAULT_RETRY_OPTIONS, `renameWordFile-${instruction.oldName}`);
};

// Download files as ZIP with improved error handling
export const downloadFilesAsZip = async (
  files: { name: string; data: Uint8Array | Blob }[]
) => {
  if (files.length === 0) {
    throw new Error('No files to download');
  }

  return withRetry(async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const tempResources: Array<{ cleanup: () => void }> = [];

    try {
      for (const file of files) {
        zip.file(file.name, file.data);
      }

      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const zipName = `processed-files-${timestamp}.zip`;
      
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
    
  }, DEFAULT_RETRY_OPTIONS, 'downloadFilesAsZip');
};

// Helper function to extract text from HTML with better structure preservation
function extractTextFromHTML(element: HTMLElement): string {
  let text = '';
  
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        text += '\n\n' + extractTextFromHTML(el) + '\n\n';
      } else if (['p', 'div'].includes(tagName)) {
        text += '\n' + extractTextFromHTML(el) + '\n';
      } else if (['br'].includes(tagName)) {
        text += '\n';
      } else if (['li'].includes(tagName)) {
        text += '• ' + extractTextFromHTML(el) + '\n';
      } else {
        text += extractTextFromHTML(el);
      }
    }
  }
  
  return text;
}

// Helper function to wrap text to fit within specified width
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    
    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is too long, break it
        lines.push(word);
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

// Helper function to extract text from PDF page with better spacing
function extractTextFromPage(textContent: any): string {
  const items = textContent.items || [];
  let text = '';
  let lastY = -1;
  
  for (const item of items) {
    if (typeof item?.str === 'string') {
      // Add line break if Y position changed significantly
      if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
        text += '\n';
      }
      
      text += item.str;
      lastY = item.transform[5];
    }
  }
  
  return text.replace(/\s+/g, ' ').trim();
}