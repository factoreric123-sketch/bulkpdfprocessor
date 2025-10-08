import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { monitoring } from '../monitoring';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

describe('monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('trackOperation', () => {
    it('should track successful operations', async () => {
      const operation = vi.fn().mockResolvedValue(undefined);
      
      await monitoring.trackOperation(
        'test_operation',
        10,
        1000000,
        operation
      );
      
      expect(operation).toHaveBeenCalled();
      const stats = monitoring.getStats();
      expect(stats.test_operation).toBeDefined();
      expect(stats.test_operation.count).toBe(1);
      expect(stats.test_operation.successCount).toBe(1);
      expect(stats.test_operation.errorRate).toBe(0);
    });

    it('should track failed operations', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Test error'));
      
      await expect(
        monitoring.trackOperation('failing_op', 5, 500000, operation)
      ).rejects.toThrow('Test error');
      
      const stats = monitoring.getStats();
      expect(stats.failing_op).toBeDefined();
      expect(stats.failing_op.errorRate).toBe(100);
    });

    it('should calculate average duration', async () => {
      const fastOp = () => new Promise(resolve => setTimeout(resolve, 10));
      const slowOp = () => new Promise(resolve => setTimeout(resolve, 50));
      
      await monitoring.trackOperation('timed_op', 1, 100, fastOp);
      await monitoring.trackOperation('timed_op', 1, 100, slowOp);
      
      const stats = monitoring.getStats();
      expect(stats.timed_op.count).toBe(2);
      expect(stats.timed_op.avgDuration).toBeGreaterThan(0);
    });
  });

  describe('measureWebVitals', () => {
    it('should measure web vitals', () => {
      // Mock performance API
      const mockEntries = [
        { name: 'first-contentful-paint', startTime: 1234 },
      ];
      
      vi.spyOn(performance, 'getEntriesByType').mockReturnValue(mockEntries as any);
      
      const vitals = monitoring.measureWebVitals();
      
      expect(vitals.fcp).toBe(1234);
      expect(vitals.apiCallCount).toBeDefined();
    });
  });
});