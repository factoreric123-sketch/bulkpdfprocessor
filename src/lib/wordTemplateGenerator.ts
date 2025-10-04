import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export const downloadWordToPdfTemplate = () => {
  const template = [
    ['Source File', 'Output Name'],
    ['document1.docx', 'output1.pdf'],
    ['document2.docx', 'output2.pdf'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Word to PDF');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  saveAs(blob, 'word-to-pdf-template.xlsx');
};

export const downloadPdfToWordTemplate = () => {
  const template = [
    ['Source File', 'Output Name'],
    ['document1.pdf', 'output1.docx'],
    ['document2.pdf', 'output2.docx'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PDF to Word');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  saveAs(blob, 'pdf-to-word-template.xlsx');
};

export const downloadRenameWordTemplate = () => {
  const template = [
    ['Old Name', 'New Name'],
    ['old-document.docx', 'new-document.docx'],
    ['report-v1.docx', 'report-final.docx'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rename Word');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  saveAs(blob, 'rename-word-template.xlsx');
};
