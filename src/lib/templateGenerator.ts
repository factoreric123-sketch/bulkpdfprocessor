import * as XLSX from 'xlsx';

export const downloadMergeTemplate = () => {
  const data = [
    ['PDF1', 'PDF2', 'PDF3', 'PDF4', 'PDF5', 'New PDF Name'],
    ['part1.pdf', 'part2.pdf', 'part3.pdf', 'part4.pdf', 'part5.pdf', 'complete_document.pdf'],
    ['chapter1.pdf', 'chapter2.pdf', '', '', '', 'combined_chapters.pdf'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Merge Instructions');
  
  XLSX.writeFile(wb, 'PDF_Merge_Template.xlsx');
};

export const downloadDeleteTemplate = () => {
  const data = [
    ['PDF1', 'Delete Pages', 'New PDF Name'],
    ['document.pdf', '1,3,5-7', 'document_edited.pdf'],
    ['report.pdf', '2-4', 'report_trimmed.pdf'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Delete Instructions');
  
  XLSX.writeFile(wb, 'PDF_Delete_Pages_Template.xlsx');
};

export const downloadSplitTemplate = () => {
  const data = [
    ['PDF File', 'Page Ranges', 'Output Names'],
    ['document.pdf', '1-5, 6-10, 11-15', 'part1.pdf, part2.pdf, part3.pdf'],
    ['report.pdf', '1-3, 4-8', 'section1.pdf, section2.pdf'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Split Instructions');
  
  XLSX.writeFile(wb, 'PDF_Split_Template.xlsx');
};

export const downloadReorderTemplate = () => {
  const data = [
    ['PDF File', 'New Page Order', 'Output Name'],
    ['document.pdf', '5,2,1-3,6', 'reordered.pdf'],
    ['report.pdf', '3,1,2', 'report_reordered.pdf'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reorder Instructions');
  
  XLSX.writeFile(wb, 'PDF_Reorder_Template.xlsx');
};

export const downloadRenameTemplate = () => {
  const data = [
    ['Old File Name', 'New File Name'],
    ['document.pdf', 'renamed_document.pdf'],
    ['report.pdf', 'final_report.pdf'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rename Instructions');
  
  XLSX.writeFile(wb, 'PDF_Rename_Template.xlsx');
};
