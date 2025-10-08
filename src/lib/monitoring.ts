// FREE Monitoring Solution using Supabase for metrics storage
import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';

interface PerformanceMetric {
  operation: string;
  duration: number;
  fileCount: number;
  totalSize: number;
  success: boolean;
  errorMessage?: string;
  memoryUsed?: number;
  timestamp: string;
}

class MonitoringService {
  private metrics: PerformanceMetric[] = [];
  private flushInterval: NodeJS.Timer | null = null;

  constructor() {
    // Flush metrics every 30 seconds
    this.startAutoFlush();
  }

  // Track operation performance
  async trackOperation(
    operation: string,
    fileCount: number,
    totalSize: number,
    execute: () => Promise<void>
  ) {
    const startTime = performance.now();
    const startMemory = performance.memory?.usedJSHeapSize;
    let success = true;
    let errorMessage: string | undefined;

    try {
      await execute();
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      const memoryUsed = performance.memory?.usedJSHeapSize 
        ? performance.memory.usedJSHeapSize - (startMemory || 0)
        : undefined;

      const metric: PerformanceMetric = {
        operation,
        duration,
        fileCount,
        totalSize,
        success,
        errorMessage,
        memoryUsed,
        timestamp: new Date().toISOString(),
      };

      this.metrics.push(metric);
      
      // Log locally
      logger.info('Operation tracked:', {
        operation,
        duration: `${duration.toFixed(2)}ms`,
        success,
        fileCount,
      });

      // Send critical errors immediately
      if (!success) {
        await this.flush();
      }
    }
  }

  // Get performance stats
  getStats() {
    const operations = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.operation]) {
        acc[metric.operation] = {
          count: 0,
          successCount: 0,
          totalDuration: 0,
          avgDuration: 0,
          errorRate: 0,
        };
      }
      
      const op = acc[metric.operation];
      op.count++;
      if (metric.success) op.successCount++;
      op.totalDuration += metric.duration;
      op.avgDuration = op.totalDuration / op.count;
      op.errorRate = ((op.count - op.successCount) / op.count) * 100;
      
      return acc;
    }, {} as Record<string, any>);

    return operations;
  }

  // Send metrics to Supabase (free storage)
  private async flush() {
    if (this.metrics.length === 0) return;

    try {
      // Store in a simple metrics table
      const { error } = await supabase
        .from('app_metrics')
        .insert(this.metrics);

      if (error) {
        logger.error('Failed to send metrics:', error);
      } else {
        logger.debug(`Flushed ${this.metrics.length} metrics`);
        this.metrics = [];
      }
    } catch (err) {
      logger.error('Metrics flush error:', err);
    }
  }

  private startAutoFlush() {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000); // Every 30 seconds
  }

  // Clean up
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush(); // Final flush
  }

  // Browser Performance API Integration
  measureWebVitals() {
    // First Contentful Paint
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    
    // Largest Contentful Paint
    let lcp = 0;
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      lcp = lastEntry.startTime;
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // Resource timing
    const resources = performance.getEntriesByType('resource');
    const apiCalls = resources.filter(r => r.name.includes('/api/') || r.name.includes('supabase'));
    
    return {
      fcp: fcp?.startTime,
      lcp,
      apiCallCount: apiCalls.length,
      avgApiDuration: apiCalls.reduce((sum, r) => sum + r.duration, 0) / apiCalls.length || 0,
    };
  }
}

// Singleton instance
export const monitoring = new MonitoringService();

// Usage example:
// await monitoring.trackOperation('pdf_merge', files.length, totalSize, async () => {
//   await mergePDFs(...);
// });