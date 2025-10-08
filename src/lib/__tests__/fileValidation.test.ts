import { describe, it, expect } from 'vitest';
import { validateFile, sanitizeFileName, validateBatch } from '../fileValidation';

describe('fileValidation', () => {
  describe('sanitizeFileName', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeFileName('../../../etc/passwd.pdf')).toBe('etc_passwd.pdf');
      expect(sanitizeFileName('file<>:"|?*.pdf')).toBe('file_.pdf');
    });

    it('should handle normal filenames', () => {
      expect(sanitizeFileName('invoice-2024.pdf')).toBe('invoice-2024.pdf');
      expect(sanitizeFileName('Report_Q1_2024.pdf')).toBe('Report_Q1_2024.pdf');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const result = sanitizeFileName(longName);
      expect(result.length).toBeLessThanOrEqual(255);
    });
  });

  describe('validateFile', () => {
    it('should reject oversized files', () => {
      const bigFile = new File([''], 'test.pdf', { type: 'application/pdf' });
      Object.defineProperty(bigFile, 'size', { value: 60 * 1024 * 1024 }); // 60MB
      
      const result = validateFile(bigFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum size');
    });

    it('should reject invalid file types', () => {
      const exeFile = new File([''], 'virus.exe', { type: 'application/exe' });
      const result = validateFile(exeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not supported');
    });

    it('should accept valid PDFs', () => {
      const validPdf = new File([''], 'document.pdf', { type: 'application/pdf' });
      Object.defineProperty(validPdf, 'size', { value: 5 * 1024 * 1024 }); // 5MB
      
      const result = validateFile(validPdf);
      expect(result.valid).toBe(true);
      expect(result.sanitizedName).toBe('document.pdf');
    });
  });

  describe('validateBatch', () => {
    it('should enforce file count limits', () => {
      const files = Array(201).fill(null).map((_, i) => 
        new File([''], `file${i}.pdf`, { type: 'application/pdf' })
      );
      
      const result = validateBatch(files);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Too many files');
    });

    it('should calculate total size correctly', () => {
      const files = [
        new File([''], 'file1.pdf', { type: 'application/pdf' }),
        new File([''], 'file2.pdf', { type: 'application/pdf' })
      ];
      Object.defineProperty(files[0], 'size', { value: 10 * 1024 * 1024 }); // 10MB
      Object.defineProperty(files[1], 'size', { value: 20 * 1024 * 1024 }); // 20MB
      
      const result = validateBatch(files);
      expect(result.totalSize).toBe(30 * 1024 * 1024);
    });
  });
});