import * as XLSX from 'xlsx';
import type { WordToPdfInstruction, PdfToWordInstruction, RenameWordInstruction } from './wordProcessor';

export const parseWordToPdfExcel = async (excelFile: File): Promise<WordToPdfInstruction[]> => {
  const data = await excelFile.arrayBuffer();
  const workbook = XLSX.read(data);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (jsonData.length < 2) {
    throw new Error('Excel file must contain at least a header row and one data row');
  }

  const instructions: WordToPdfInstruction[] = [];

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row[0] || !row[1]) continue;

    instructions.push({
      sourceFile: String(row[0]).trim(),
      outputName: String(row[1]).trim(),
    });
  }

  return instructions;
};

export const parsePdfToWordExcel = async (excelFile: File): Promise<PdfToWordInstruction[]> => {
  const data = await excelFile.arrayBuffer();
  const workbook = XLSX.read(data);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (jsonData.length < 2) {
    throw new Error('Excel file must contain at least a header row and one data row');
  }

  const instructions: PdfToWordInstruction[] = [];

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row[0] || !row[1]) continue;

    instructions.push({
      sourceFile: String(row[0]).trim(),
      outputName: String(row[1]).trim(),
    });
  }

  return instructions;
};

export const parseRenameWordExcel = async (excelFile: File): Promise<RenameWordInstruction[]> => {
  const data = await excelFile.arrayBuffer();
  const workbook = XLSX.read(data);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (jsonData.length < 2) {
    throw new Error('Excel file must contain at least a header row and one data row');
  }

  const instructions: RenameWordInstruction[] = [];

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row[0] || !row[1]) continue;

    instructions.push({
      oldName: String(row[0]).trim(),
      newName: String(row[1]).trim(),
    });
  }

  return instructions;
};
