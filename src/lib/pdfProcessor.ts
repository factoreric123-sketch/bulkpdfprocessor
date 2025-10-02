import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

export interface MergeInstruction {
  sourceFiles: string[];
  outputName: string;
}

export interface DeletePagesInstruction {
  sourceFile: string;
  pagesToDelete: number[];
  outputName: string;
}

export const parseMergeExcel = (file: File): Promise<MergeInstruction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        const instructions: MergeInstruction[] = [];
        
        // Skip header row
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;
          
          // Take first 5 columns as source files, last column as output name
          const sourceFiles = row.slice(0, 5)
            .filter(Boolean)
            .map(f => String(f).trim());
          const outputName = row[5] ? String(row[5]).trim() : '';
          
          if (sourceFiles.length > 0 && outputName) {
            instructions.push({ sourceFiles, outputName });
          }
        }
        
        resolve(instructions);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const parseDeletePagesExcel = (file: File): Promise<DeletePagesInstruction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number)[][];
        
        const instructions: DeletePagesInstruction[] = [];
        
        // Skip header row
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 3) continue;
          
          const sourceFile = row[0] ? String(row[0]).trim() : '';
          const deletePages = row[1] ? String(row[1]).trim() : '';
          const outputName = row[2] ? String(row[2]).trim() : '';
          
          if (sourceFile && deletePages && outputName) {
            const pagesToDelete = parsePageNumbers(deletePages);
            instructions.push({ sourceFile, pagesToDelete, outputName });
          }
        }
        
        resolve(instructions);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

const parsePageNumbers = (pageString: string): number[] => {
  const pages: number[] = [];
  const parts = pageString.split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
      for (let i = start; i <= end; i++) {
        pages.push(i - 1); // Convert to 0-indexed
      }
    } else {
      pages.push(parseInt(trimmed) - 1); // Convert to 0-indexed
    }
  }
  
  return pages;
};

export const mergePDFs = async (
  instruction: MergeInstruction,
  pdfFiles: Map<string, File>,
  onProgress: (progress: number) => void
): Promise<Uint8Array> => {
  const mergedPdf = await PDFDocument.create();
  
  for (let i = 0; i < instruction.sourceFiles.length; i++) {
    const fileName = instruction.sourceFiles[i];
    const file = pdfFiles.get(fileName);
    
    if (!file) {
      throw new Error(`PDF file not found: ${fileName}`);
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
    
    onProgress(((i + 1) / instruction.sourceFiles.length) * 100);
  }
  
  return await mergedPdf.save();
};

export const deletePagesFromPDF = async (
  instruction: DeletePagesInstruction,
  pdfFiles: Map<string, File>,
  onProgress: (progress: number) => void
): Promise<Uint8Array> => {
  const file = pdfFiles.get(instruction.sourceFile);
  
  if (!file) {
    throw new Error(`PDF file not found: ${instruction.sourceFile}`);
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  
  // Sort pages to delete in descending order to avoid index shifting
  const sortedPages = [...instruction.pagesToDelete].sort((a, b) => b - a);
  
  for (const pageIndex of sortedPages) {
    if (pageIndex >= 0 && pageIndex < pdf.getPageCount()) {
      pdf.removePage(pageIndex);
    }
  }
  
  onProgress(100);
  return await pdf.save();
};

export const downloadPDF = (pdfBytes: Uint8Array, fileName: string) => {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  saveAs(blob, fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
};

export const downloadPDFsAsZip = async (pdfFiles: { name: string; data: Uint8Array }[]) => {
  const zip = new JSZip();
  
  pdfFiles.forEach(({ name, data }) => {
    const fileName = name.endsWith('.pdf') ? name : `${name}.pdf`;
    zip.file(fileName, data);
  });
  
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  saveAs(zipBlob, `processed_pdfs_${timestamp}.zip`);
};
