import mammoth from 'mammoth';
import { PDFDocument } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

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

// Convert Word document to PDF
export const convertWordToPdf = async (
  instruction: WordToPdfInstruction,
  fileMap: Map<string, File>,
  onProgress?: (progress: number) => void
): Promise<{ name: string; data: Uint8Array }> => {
  const wordFile = fileMap.get(instruction.sourceFile);
  if (!wordFile) {
    throw new Error(`Word file not found: ${instruction.sourceFile}`);
  }

  onProgress?.(20);

  // Convert Word to HTML using mammoth
  const arrayBuffer = await wordFile.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;

  onProgress?.(50);

  // Create a simple PDF with the text content
  const pdfDoc = await PDFDocument.create();
  
  // Extract text from HTML (simple approach)
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const text = tempDiv.textContent || tempDiv.innerText || '';
  
  // Add pages with text
  let currentPage = pdfDoc.addPage();
  let { width, height } = currentPage.getSize();
  const fontSize = 12;
  const maxWidth = width - 100;
  
  const lines = text.split('\n');
  let y = height - 50;
  
  for (const line of lines) {
    if (y < 50) {
      // Add new page if needed
      currentPage = pdfDoc.addPage();
      const size = currentPage.getSize();
      width = size.width;
      height = size.height;
      y = height - 50;
    }
    
    // Truncate long lines to prevent overflow
    const truncatedLine = line.substring(0, 100);
    if (truncatedLine.trim()) {
      currentPage.drawText(truncatedLine, {
        x: 50,
        y,
        size: fontSize,
      });
    }
    
    y -= fontSize + 5;
  }

  onProgress?.(90);

  const pdfBytes = await pdfDoc.save();
  onProgress?.(100);

  // Ensure output name has .pdf extension
  const outputName = instruction.outputName.endsWith('.pdf')
    ? instruction.outputName
    : `${instruction.outputName}.pdf`;

  return {
    name: outputName,
    data: pdfBytes,
  };
};

// Convert PDF to Word document
export const convertPdfToWord = async (
  instruction: PdfToWordInstruction,
  fileMap: Map<string, File>,
  onProgress?: (progress: number) => void
): Promise<{ name: string; data: Blob }> => {
  const pdfFile = fileMap.get(instruction.sourceFile);
  if (!pdfFile) {
    throw new Error(`PDF file not found: ${instruction.sourceFile}`);
  }

  onProgress?.(15);

  const arrayBuffer = await pdfFile.arrayBuffer();

  // Lazy-load pdf.js for robust client-side text extraction (avoids placeholders)
  // We set the worker from a CDN to simplify bundling.
  const pdfjs: any = await import('pdfjs-dist/build/pdf.mjs');
  if (pdfjs?.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.js';
  }

  onProgress?.(30);

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  onProgress?.(50);

  const paragraphs: Paragraph[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Join all text items keeping a reasonable spacing
    const pageText = (textContent.items || [])
      .map((it: any) => (typeof it?.str === 'string' ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (pageText) {
      // Split into rough paragraphs by sentence boundaries or long spaces
      const chunks = pageText.split(/(?<=[\.!?])\s{2,}|\n{2,}/);
      for (const chunk of chunks) {
        const txt = chunk.trim();
        if (!txt) {
          paragraphs.push(new Paragraph({ children: [] }));
        } else {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: txt, size: 24 })], // 12pt
            })
          );
        }
      }
    } else {
      // Keep an empty paragraph if nothing was extracted for this page
      paragraphs.push(new Paragraph({ children: [] }));
    }

    // Page break between pages (visual separation)
    if (pageNum < pdf.numPages) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: '', break: 1 })] }));
    }

    onProgress?.(50 + Math.round((pageNum / pdf.numPages) * 40));
  }

  onProgress?.(95);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  onProgress?.(100);

  const outName = instruction.outputName.endsWith('.docx')
    ? instruction.outputName
    : `${instruction.outputName}.docx`;

  return { name: outName, data: blob };
};

// Rename Word document
export const renameWordFile = async (
  instruction: RenameWordInstruction,
  fileMap: Map<string, File>
): Promise<{ name: string; data: Blob }> => {
  const wordFile = fileMap.get(instruction.oldName);
  if (!wordFile) {
    throw new Error(`Word file not found: ${instruction.oldName}`);
  }

  const blob = new Blob([await wordFile.arrayBuffer()], {
    type: wordFile.type,
  });

  // Ensure the output name has the correct extension
  let outputName = instruction.newName;
  if (!outputName.endsWith('.docx') && !outputName.endsWith('.doc')) {
    // Determine extension from original file
    const ext = instruction.oldName.endsWith('.docx') ? '.docx' : '.doc';
    outputName = `${outputName}${ext}`;
  }

  return {
    name: outputName,
    data: blob,
  };
};

// Download files as ZIP
export const downloadFilesAsZip = async (
  files: { name: string; data: Uint8Array | Blob }[]
) => {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.name, file.data);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `processed-files-${Date.now()}.zip`);
};
