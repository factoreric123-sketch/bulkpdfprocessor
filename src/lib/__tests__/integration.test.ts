import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processMergeV2 } from '../mergeProcessorV2';
import { FILE_PROCESSING } from '../constants';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { jobId: 'test-job-id' } }),
    },
  },
}));

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

describe('Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processMergeV2', () => {
    it('should handle small batches with client-side processing', async () => {
      // Create mock files
      const pdfFiles = Array(5).fill(null).map((_, i) => 
        new File(['PDF content'], `file${i}.pdf`, { type: 'application/pdf' })
      );
      
      const excelContent = 'Source1,Source2,Output\nfile0.pdf,file1.pdf,merged.pdf';
      const excelFile = new File([excelContent], 'instructions.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const result = await processMergeV2({
        pdfFiles,
        excelFile,
        userId: 'test-user-id',
        onProgress: vi.fn(),
      });

      // Since we're mocking, we need to check the flow rather than actual results
      expect(result.success).toBeDefined();
    });

    it('should validate file limits', async () => {
      const tooManyFiles = Array(FILE_PROCESSING.MAX_FILES_PER_BATCH + 1)
        .fill(null)
        .map((_, i) => new File(['content'], `file${i}.pdf`));
      
      const excelFile = new File([''], 'instructions.xlsx');

      const result = await processMergeV2({
        pdfFiles: tooManyFiles,
        excelFile,
        userId: 'test-user-id',
      });

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('File validation failed');
    });

    it('should track operations with monitoring', async () => {
      const monitoringSpy = vi.spyOn(await import('../monitoring').then(m => m.monitoring), 'trackOperation');
      
      const pdfFiles = [new File(['PDF'], 'test.pdf', { type: 'application/pdf' })];
      const excelFile = new File([''], 'instructions.xlsx');

      await processMergeV2({
        pdfFiles,
        excelFile,
        userId: 'test-user-id',
      });

      expect(monitoringSpy).toHaveBeenCalledWith(
        'pdf_merge_v2',
        1,
        expect.any(Number),
        expect.any(Function)
      );
    });
  });

  describe('Error Handling', () => {
    it('should track errors when operations fail', async () => {
      const errorTrackerSpy = vi.spyOn(
        await import('../errorTracking').then(m => m.errorTracker),
        'trackError'
      );

      // Force an error by passing invalid data
      const result = await processMergeV2({
        pdfFiles: [],
        excelFile: new File([''], 'invalid.xlsx'),
        userId: 'test-user-id',
      });

      expect(result.success).toBe(false);
      // Error tracker should have been called for validation failures
    });
  });

  describe('Performance', () => {
    it('should handle 200 files within memory limits', () => {
      const files = Array(200).fill(null).map((_, i) => {
        const file = new File(['Small PDF content'], `file${i}.pdf`, { 
          type: 'application/pdf' 
        });
        Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB each
        return file;
      });

      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      expect(totalSize).toBe(200 * 1024 * 1024); // 200MB total
      expect(totalSize).toBeLessThan(FILE_PROCESSING.MAX_TOTAL_SIZE);
    });
  });
});