import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateBatch, sanitizeFileName } from '../fileValidation';
import { processLargeBatch } from '../batchProcessor';

describe('batchProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processLargeBatch', () => {
    it('should process items in chunks', async () => {
      const items = Array(50).fill(null).map((_, i) => i);
      const processFunction = vi.fn().mockResolvedValue('processed');
      
      const results = await processLargeBatch(items, processFunction, 10);
      
      expect(processFunction).toHaveBeenCalledTimes(5); // 50 items / 10 chunk size
      expect(results).toHaveLength(5);
    });

    it('should handle processing errors gracefully', async () => {
      const items = [1, 2, 3];
      const processFunction = vi.fn()
        .mockRejectedValueOnce(new Error('Process failed'))
        .mockResolvedValue('success');
      
      await expect(processLargeBatch(items, processFunction, 1))
        .rejects.toThrow('Process failed');
    });

    it('should call progress callback', async () => {
      const items = Array(20).fill(null).map((_, i) => i);
      const processFunction = vi.fn().mockResolvedValue('processed');
      const onProgress = vi.fn();
      
      await processLargeBatch(items, processFunction, 5, onProgress);
      
      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(
        expect.any(Number),
        expect.stringContaining('batch')
      );
    });
  });

  describe('file validation in batch context', () => {
    it('should handle 200 files correctly', () => {
      const files = Array(200).fill(null).map((_, i) => 
        new File(['content'], `file${i}.pdf`, { type: 'application/pdf' })
      );
      
      const result = validateBatch(files);
      
      expect(result.validFiles).toHaveLength(200);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject 201 files', () => {
      const files = Array(201).fill(null).map((_, i) => 
        new File(['content'], `file${i}.pdf`, { type: 'application/pdf' })
      );
      
      const result = validateBatch(files);
      
      expect(result.validFiles).toHaveLength(0);
      expect(result.errors[0]).toContain('Too many files');
    });
  });
});