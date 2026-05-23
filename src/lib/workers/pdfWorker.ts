// Web Worker for CPU-intensive PDF operations
import { PDFDocument } from 'pdf-lib';

// Message types
interface WorkerMessage {
  id: string;
  type: 'merge' | 'split' | 'delete' | 'reorder' | 'rename';
  data: any;
}

interface WorkerResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

// Handle messages from main thread
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, data } = event.data;
  
  try {
    let result: any;
    
    switch (type) {
      case 'merge':
        result = await handleMerge(data);
        break;
      case 'split':
        result = await handleSplit(data);
        break;
      case 'delete':
        result = await handleDelete(data);
        break;
      case 'reorder':
        result = await handleReorder(data);
        break;
      case 'rename':
        result = await handleRename(data);
        break;
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
    
    const response: WorkerResponse = {
      id,
      success: true,
      result,
    };
    
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    
    self.postMessage(response);
  }
});

async function handleMerge(data: {
  files: { name: string; buffer: ArrayBuffer }[];
  outputName: string;
}): Promise<{ name: string; buffer: ArrayBuffer }> {
  const mergedPdf = await PDFDocument.create();
  
  for (const file of data.files) {
    const pdf = await PDFDocument.load(file.buffer, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    });
    
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach(page => mergedPdf.addPage(page));
  }
  
  const mergedBytes = await mergedPdf.save({ useObjectStreams: false });
  
  return {
    name: data.outputName,
    buffer: mergedBytes.buffer,
  };
}

async function handleSplit(data: {
  file: { name: string; buffer: ArrayBuffer };
  ranges: { start: number; end: number }[];
  outputNames: string[];
}): Promise<{ name: string; buffer: ArrayBuffer }[]> {
  const sourcePdf = await PDFDocument.load(data.file.buffer, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
  });
  
  const results: { name: string; buffer: ArrayBuffer }[] = [];
  
  for (let i = 0; i < data.ranges.length; i++) {
    const range = data.ranges[i];
    const outputName = data.outputNames[i] || `${data.file.name}_part${i + 1}.pdf`;
    
    const newPdf = await PDFDocument.create();
    
    for (let pageNum = range.start; pageNum <= range.end; pageNum++) {
      if (pageNum >= 0 && pageNum < sourcePdf.getPageCount()) {
        const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNum]);
        newPdf.addPage(copiedPage);
      }
    }
    
    const pdfBytes = await newPdf.save({ useObjectStreams: false });
    results.push({
      name: outputName,
      buffer: pdfBytes.buffer,
    });
  }
  
  return results;
}

async function handleDelete(data: {
  file: { name: string; buffer: ArrayBuffer };
  pagesToDelete: number[];
  outputName: string;
}): Promise<{ name: string; buffer: ArrayBuffer }> {
  const pdf = await PDFDocument.load(data.file.buffer, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
  });
  
  // Sort pages in descending order to avoid index shifting
  const sortedPages = [...data.pagesToDelete].sort((a, b) => b - a);
  
  for (const pageIndex of sortedPages) {
    if (pageIndex >= 0 && pageIndex < pdf.getPageCount()) {
      pdf.removePage(pageIndex);
    }
  }
  
  const pdfBytes = await pdf.save({ useObjectStreams: false });
  
  return {
    name: data.outputName,
    buffer: pdfBytes.buffer,
  };
}

async function handleReorder(data: {
  file: { name: string; buffer: ArrayBuffer };
  newPageOrder: number[];
  outputName: string;
}): Promise<{ name: string; buffer: ArrayBuffer }> {
  const sourcePdf = await PDFDocument.load(data.file.buffer, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
  });
  
  const newPdf = await PDFDocument.create();
  
  for (const pageIndex of data.newPageOrder) {
    if (pageIndex >= 0 && pageIndex < sourcePdf.getPageCount()) {
      const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
      newPdf.addPage(copiedPage);
    }
  }
  
  const pdfBytes = await newPdf.save({ useObjectStreams: false });
  
  return {
    name: data.outputName,
    buffer: pdfBytes.buffer,
  };
}

async function handleRename(data: {
  file: { name: string; buffer: ArrayBuffer };
  newName: string;
}): Promise<{ name: string; buffer: ArrayBuffer }> {
  const sourcePdf = await PDFDocument.load(data.file.buffer, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
  });
  
  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
  copiedPages.forEach(p => newPdf.addPage(p));
  
  const baseTitle = (data.newName.endsWith('.pdf')
    ? data.newName.slice(0, -4)
    : data.newName).trim();
  
  try {
    newPdf.setTitle(baseTitle);
    newPdf.setProducer('Bulk PDF Processor');
    newPdf.setCreator('Bulk PDF Processor');
    newPdf.setModificationDate(new Date());
  } catch (err) {
    // Continue even if metadata setting fails
  }
  
  const pdfBytes = await newPdf.save({ useObjectStreams: false });
  
  return {
    name: data.newName,
    buffer: pdfBytes.buffer,
  };
}