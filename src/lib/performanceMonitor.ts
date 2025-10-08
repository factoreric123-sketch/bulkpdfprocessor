import { logger } from './logger';

interface PerformanceMetrics {
  memoryUsage: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    percentUsed: number;
  } | null;
  timing: {
    operationName: string;
    startTime: number;
    endTime?: number;
    duration?: number;
  };
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private memoryCheckInterval: number | null = null;

  // Start monitoring an operation
  startOperation(operationId: string, operationName: string) {
    this.metrics.set(operationId, {
      memoryUsage: this.getMemoryUsage(),
      timing: {
        operationName,
        startTime: performance.now(),
      },
    });

    logger.info(`Started operation: ${operationName} (${operationId})`);
  }

  // End monitoring an operation
  endOperation(operationId: string) {
    const metric = this.metrics.get(operationId);
    if (!metric) return;

    const endTime = performance.now();
    metric.timing.endTime = endTime;
    metric.timing.duration = endTime - metric.timing.startTime;
    metric.memoryUsage = this.getMemoryUsage();

    logger.info(`Completed operation: ${metric.timing.operationName} in ${metric.timing.duration.toFixed(2)}ms`);
    
    // Log memory usage if available
    if (metric.memoryUsage) {
      logger.info(`Memory usage: ${metric.memoryUsage.percentUsed.toFixed(1)}% (${this.formatBytes(metric.memoryUsage.usedJSHeapSize)} / ${this.formatBytes(metric.memoryUsage.jsHeapSizeLimit)})`);
    }

    return metric;
  }

  // Get current memory usage
  private getMemoryUsage() {
    const memoryAPI = (performance as any).memory;
    if (!memoryAPI) return null;

    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = memoryAPI;
    const percentUsed = (usedJSHeapSize / jsHeapSizeLimit) * 100;

    return {
      usedJSHeapSize,
      totalJSHeapSize,
      jsHeapSizeLimit,
      percentUsed,
    };
  }

  // Start continuous memory monitoring
  startMemoryMonitoring(interval: number = 5000, warningThreshold: number = 80) {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }

    this.memoryCheckInterval = window.setInterval(() => {
      const memory = this.getMemoryUsage();
      if (!memory) return;

      if (memory.percentUsed > warningThreshold) {
        logger.warn(`High memory usage detected: ${memory.percentUsed.toFixed(1)}%`);
      }
    }, interval);
  }

  // Stop memory monitoring
  stopMemoryMonitoring() {
    if (this.memoryCheckInterval) {
      window.clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  // Format bytes to human readable
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  // Check if we're approaching memory limits
  isMemoryConstrained(): boolean {
    const memory = this.getMemoryUsage();
    if (!memory) return false;
    
    return memory.percentUsed > 70; // Conservative threshold
  }

  // Get recommended batch size based on available memory
  getRecommendedBatchSize(averageFileSize: number): number {
    const memory = this.getMemoryUsage();
    if (!memory) return 5; // Conservative default

    const availableMemory = memory.jsHeapSizeLimit - memory.usedJSHeapSize;
    const safetyFactor = 0.5; // Use only 50% of available memory
    const memoryPerFile = averageFileSize * 2.5; // Estimate 2.5x for processing

    const recommendedSize = Math.floor((availableMemory * safetyFactor) / memoryPerFile);
    
    // Clamp between reasonable bounds
    return Math.max(1, Math.min(recommendedSize, 20));
  }

  // Clear metrics for an operation
  clearOperation(operationId: string) {
    this.metrics.delete(operationId);
  }

  // Get all metrics
  getAllMetrics() {
    return Array.from(this.metrics.entries());
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();