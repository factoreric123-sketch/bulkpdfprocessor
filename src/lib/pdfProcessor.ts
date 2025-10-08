import { PDFDocument, PDFName } from 'pdf-lib';
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
): Promise<{ data: Uint8Array; missingFiles: string[] }> => {
  const mergedPdf = await PDFDocument.create();
  const missingFiles: string[] = [];
  
  for (let i = 0; i < instruction.sourceFiles.length; i++) {
    const fileName = instruction.sourceFiles[i];
    const file = pdfFiles.get(fileName);
    
    if (!file) {
      console.warn(`PDF file not found: ${fileName}, skipping...`);
      missingFiles.push(fileName);
      continue;
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
    
    onProgress(((i + 1) / instruction.sourceFiles.length) * 100);
  }
  
  const data = await mergedPdf.save();
  return { data, missingFiles };
};

export const deletePagesFromPDF = async (
  instruction: DeletePagesInstruction,
  pdfFiles: Map<string, File>,
  onProgress: (progress: number) => void
): Promise<{ data: Uint8Array; missingFiles: string[] } | null> => {
  const file = pdfFiles.get(instruction.sourceFile);
  
  if (!file) {
    console.warn(`PDF file not found: ${instruction.sourceFile}, skipping...`);
    return null;
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
  const data = await pdf.save();
  return { data, missingFiles: [] };
};

export const downloadPDF = (pdfBytes: Uint8Array, fileName: string) => {
  const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  saveAs(blob, fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
};

export const parseSplitExcel = (file: File): Promise<SplitInstruction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        const instructions: SplitInstruction[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 3) continue;
          
          const sourceFile = row[0] ? String(row[0]).trim() : '';
          const ranges = row[1] ? String(row[1]).trim() : '';
          const names = row[2] ? String(row[2]).trim() : '';
          
          if (sourceFile && ranges && names) {
            const pageRanges = ranges.split(',').map(range => {
              const trimmed = range.trim();
              if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
                return { start: start - 1, end: end - 1 };
              }
              const page = parseInt(trimmed);
              return { start: page - 1, end: page - 1 };
            });
            const outputNames = names.split(',').map(n => n.trim());
            instructions.push({ sourceFile, pageRanges, outputNames });
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

export const parseReorderExcel = (file: File): Promise<ReorderInstruction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        const instructions: ReorderInstruction[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 3) continue;
          
          const sourceFile = row[0] ? String(row[0]).trim() : '';
          const pageOrder = row[1] ? String(row[1]).trim() : '';
          const outputName = row[2] ? String(row[2]).trim() : '';
          
          if (sourceFile && pageOrder && outputName) {
            const newPageOrder = parsePageNumbers(pageOrder);
            instructions.push({ sourceFile, newPageOrder, outputName });
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

export const parseRenameExcel = (file: File): Promise<RenameInstruction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        const instructions: RenameInstruction[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 2) continue;
          
          const oldName = row[0] ? String(row[0]).trim() : '';
          const newName = row[1] ? String(row[1]).trim() : '';
          
          if (oldName && newName) {
            instructions.push({ oldName, newName });
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

export const splitPDF = async (
  instruction: SplitInstruction,
  pdfFiles: Map<string, File>,
  onProgress: (progress: number) => void
): Promise<{ name: string; data: Uint8Array }[] | null> => {
  const file = pdfFiles.get(instruction.sourceFile);
  
  if (!file) {
    console.warn(`PDF file not found: ${instruction.sourceFile}, skipping...`);
    return null;
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(arrayBuffer);
  const results: { name: string; data: Uint8Array }[] = [];
  
  for (let i = 0; i < instruction.pageRanges.length; i++) {
    const range = instruction.pageRanges[i];
    const outputName = instruction.outputNames[i] || `${instruction.sourceFile}_part${i + 1}.pdf`;
    
    const newPdf = await PDFDocument.create();
    
    for (let pageNum = range.start; pageNum <= range.end; pageNum++) {
      if (pageNum >= 0 && pageNum < sourcePdf.getPageCount()) {
        const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNum]);
        newPdf.addPage(copiedPage);
      }
    }
    
    const pdfBytes = await newPdf.save();
    results.push({ name: outputName, data: pdfBytes });
    
    onProgress(((i + 1) / instruction.pageRanges.length) * 100);
  }
  
  return results;
};

export const reorderPDF = async (
  instruction: ReorderInstruction,
  pdfFiles: Map<string, File>,
  onProgress: (progress: number) => void
): Promise<{ data: Uint8Array; missingFiles: string[] } | null> => {
  const file = pdfFiles.get(instruction.sourceFile);
  
  if (!file) {
    console.warn(`PDF file not found: ${instruction.sourceFile}, skipping...`);
    return null;
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();
  
  for (const pageIndex of instruction.newPageOrder) {
    if (pageIndex >= 0 && pageIndex < sourcePdf.getPageCount()) {
      const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
      newPdf.addPage(copiedPage);
    }
  }
  
  onProgress(100);
  const data = await newPdf.save();
  return { data, missingFiles: [] };
};

export const renamePDF = async (
  instruction: RenameInstruction,
  pdfFiles: Map<string, File>
): Promise<{ name: string; data: Uint8Array } | null> => {
  const file = pdfFiles.get(instruction.oldName);
  
  if (!file) {
    console.warn(`PDF file not found: ${instruction.oldName}, skipping...`);
    return null;
  }
  
  const arrayBuffer = await file.arrayBuffer();
  try {
    const srcBytes = await file.arrayBuffer();
    const sourcePdf = await PDFDocument.load(srcBytes);
    const newPdf = await PDFDocument.create();

    // Copy all pages into a brand new PDF to fully reset metadata
    const copiedPages = await newPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    copiedPages.forEach((p) => newPdf.addPage(p));

    const baseTitle = (instruction.newName.endsWith('.pdf')
      ? instruction.newName.slice(0, -4)
      : instruction.newName).trim();

    // Set classic Info dictionary metadata
    try {
      newPdf.setTitle(baseTitle);
      newPdf.setProducer('Bulk PDF Processor');
      newPdf.setCreator('Bulk PDF Processor');
      newPdf.setModificationDate(new Date());
    } catch {}

    // Set XMP metadata as well (some viewers prefer XMP over Info)
    try {
      const now = new Date().toISOString();
      const xmp = `<?xpacket begin=\"\uFEFF\" id=\"W5M0MpCehiHzreSzNTczkc9d\"?>\n` +
        `<x:xmpmeta xmlns:x=\"adobe:ns:meta/\">\n` +
        `  <rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:xmp=\"http://ns.adobe.com/xap/1.0/\" xmlns:pdf=\"http://ns.adobe.com/pdf/1.3/\">\n` +
        `    <rdf:Description rdf:about=\"\" xmp:CreateDate=\"${now}\" xmp:ModifyDate=\"${now}\" pdf:Producer=\"Bulk PDF Processor\">\n` +
        `      <dc:title><rdf:Alt><rdf:li xml:lang=\"x-default\">${baseTitle}</rdf:li></rdf:Alt></dc:title>\n` +
        `      <xmp:CreatorTool>Bulk PDF Processor</xmp:CreatorTool>\n` +
        `    </rdf:Description>\n` +
        `  </rdf:RDF>\n` +
        `</x:xmpmeta>\n` +
        `<?xpacket end=\"w\"?>`;

      const xmlBytes = new TextEncoder().encode(xmp);
      const metadataRef = newPdf.context.register(
        newPdf.context.stream(xmlBytes, {
          Type: PDFName.of('Metadata'),
          Subtype: PDFName.of('XML'),
        })
      );
      newPdf.catalog.set(PDFName.of('Metadata'), metadataRef);
    } catch (err) {
      console.warn('Failed to set XMP metadata on rename (continuing):', err);
    }

    const updatedBytes = await newPdf.save();
    return { name: instruction.newName, data: updatedBytes };
  } catch (e) {
    console.warn('Failed to update PDF metadata on rename, returning original bytes. Error:', e);
    return { name: instruction.newName, data: new Uint8Array(await file.arrayBuffer()) };
  }
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
