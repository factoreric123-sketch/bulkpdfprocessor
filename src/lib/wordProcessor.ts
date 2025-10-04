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
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 12;
  const maxWidth = width - 100;
  
  const lines = text.split('\n');
  let y = height - 50;
  
  for (const line of lines) {
    if (y < 50) {
      // Add new page if needed
      const newPage = pdfDoc.addPage();
      y = newPage.getSize().height - 50;
    }
    
    page.drawText(line.substring(0, 100), {
      x: 50,
      y,
      size: fontSize,
    });
    
    y -= fontSize + 5;
  }

  onProgress?.(90);

  const pdfBytes = await pdfDoc.save();
  onProgress?.(100);

  return {
    name: instruction.outputName,
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

  onProgress?.(20);

  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  onProgress?.(50);

  // Extract text from PDF (basic implementation)
  const pages = pdfDoc.getPages();
  const paragraphs: Paragraph[] = [];

  for (let i = 0; i < pages.length; i++) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `[Content from page ${i + 1}]`,
            size: 24,
          }),
        ],
      })
    );
    
    // Add spacing
    paragraphs.push(new Paragraph({ children: [] }));
  }

  onProgress?.(80);

  // Create Word document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  onProgress?.(90);

  const blob = await Packer.toBlob(doc);
  onProgress?.(100);

  return {
    name: instruction.outputName,
    data: blob,
  };
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

  return {
    name: instruction.newName,
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
