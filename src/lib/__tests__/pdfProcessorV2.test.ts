import { describe, it, expect, vi } from 'vitest';
import { processInChunks, withRetry } from '../pdfProcessorV2';

describe('pdfProcessorV2', () => {
  describe('processInChunks', () => {
    it('should process items in specified chunk sizes', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = vi.fn().mockImplementation((chunk) => 
        Promise.resolve(chunk.map((x: number) => x * 2))
      );
      
      const results = await processInChunks(items, processor, 2);
      
      expect(processor).toHaveBeenCalledTimes(3); // 5 items with chunk size 2
      expect(processor).toHaveBeenCalledWith([1, 2]);
      expect(processor).toHaveBeenCalledWith([3, 4]);
      expect(processor).toHaveBeenCalledWith([5]);
      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it('should handle empty arrays', async () => {
      const processor = vi.fn();
      const results = await processInChunks([], processor, 5);
      
      expect(processor).not.toHaveBeenCalled();
      expect(results).toEqual([]);
    });
  });

  describe('withRetry', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve('success');
      });
      
      const result = await withRetry(operation, 'test operation', 3);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent failure'));
      
      await expect(withRetry(operation, 'test operation', 2))
        .rejects.toThrow('test operation failed after 2 attempts');
      
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should succeed on first try without retries', async () => {
      const operation = vi.fn().mockResolvedValue('immediate success');
      
      const result = await withRetry(operation, 'test operation', 3);
      
      expect(result).toBe('immediate success');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});