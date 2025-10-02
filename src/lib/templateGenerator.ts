import * as XLSX from 'xlsx';

export const downloadMergeTemplate = () => {
  const data = [
    ['PDF1', 'PDF2', 'New PDF Name'],
    ['contract_part1.pdf', 'contract_part2.pdf', 'complete_contract.pdf'],
    ['report_intro.pdf', 'report_body.pdf', 'full_report.pdf'],
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
