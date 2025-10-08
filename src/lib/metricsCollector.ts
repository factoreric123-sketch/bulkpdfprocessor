import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';
import { performanceMonitor } from './performanceMonitor';

interface OperationMetric {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  fileCount: number;
  totalSize: number;
  success: boolean;
  errorMessage?: string;
  memoryUsed?: number;
  details?: Record<string, any>;
}

interface SystemMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  activeOperations: number;
  queuedOperations: number;
  timestamp: number;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private operationMetrics: Map<string, OperationMetric> = new Map();
  private systemMetrics: SystemMetrics[] = [];
  private flushInterval: NodeJS.Timer | null = null;
  private metricsBuffer: OperationMetric[] = [];

  private constructor() {
    this.startAutoFlush();
    this.startSystemMetricsCollection();
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  startOperation(
    operationId: string,
    operation: string,
    fileCount: number,
    totalSize: number,
    details?: Record<string, any>
  ): void {
    const metric: OperationMetric = {
      operation,
      startTime: performance.now(),
      fileCount,
      totalSize,
      success: false,
      details,
    };

    this.operationMetrics.set(operationId, metric);
    performanceMonitor.startOperation(operationId, operation);
  }

  endOperation(
    operationId: string,
    success: boolean,
    errorMessage?: string
  ): void {
    const metric = this.operationMetrics.get(operationId);
    if (!metric) return;

    const endTime = performance.now();
    metric.endTime = endTime;
    metric.duration = endTime - metric.startTime;
    metric.success = success;
    metric.errorMessage = errorMessage;

    // Get memory usage from performance monitor
    const perfMetrics = performanceMonitor.endOperation(operationId);
    if (perfMetrics?.memoryUsage) {
      metric.memoryUsed = perfMetrics.memoryUsage.usedJSHeapSize;
    }

    // Move to buffer for batch upload
    this.metricsBuffer.push(metric);
    this.operationMetrics.delete(operationId);

    // Log summary
    logger.info(`Operation ${metric.operation} completed:`, {
      duration: `${metric.duration.toFixed(2)}ms`,
      success,
      fileCount: metric.fileCount,
      totalSize: `${(metric.totalSize / (1024 * 1024)).toFixed(2)}MB`,
    });
  }

  recordError(
    operation: string,
    error: Error,
    context?: Record<string, any>
  ): void {
    const errorMetric: OperationMetric = {
      operation,
      startTime: performance.now(),
      endTime: performance.now(),
      duration: 0,
      fileCount: 0,
      totalSize: 0,
      success: false,
      errorMessage: error.message,
      details: {
        ...context,
        stack: error.stack,
      },
    };

    this.metricsBuffer.push(errorMetric);
  }

  private startAutoFlush(): void {
    // Flush metrics every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000);
  }

  private startSystemMetricsCollection(): void {
    // Collect system metrics every 5 seconds
    setInterval(() => {
      const memory = performanceMonitor.getMemoryUsage();
      
      const systemMetric: SystemMetrics = {
        memoryUsage: memory?.percentUsed,
        activeOperations: this.operationMetrics.size,
        queuedOperations: 0, // Can be enhanced with actual queue size
        timestamp: Date.now(),
      };

      this.systemMetrics.push(systemMetric);

      // Keep only last 5 minutes of system metrics
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      this.systemMetrics = this.systemMetrics.filter(
        m => m.timestamp > fiveMinutesAgo
      );
    }, 5000);
  }

  private async flush(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metricsToFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      // Convert to database format
      const dbMetrics = metricsToFlush.map(m => ({
        operation: m.operation,
        duration: m.duration || 0,
        file_count: m.fileCount,
        total_size: m.totalSize,
        success: m.success,
        error_message: m.errorMessage,
        memory_used: m.memoryUsed,
        timestamp: new Date(Date.now() - (performance.now() - m.startTime)).toISOString(),
        context: m.details,
      }));

      const { error } = await supabase
        .from('app_metrics')
        .insert(dbMetrics);

      if (error) {
        logger.error('Failed to flush metrics:', error);
        // Put metrics back in buffer to retry
        this.metricsBuffer.unshift(...metricsToFlush);
      } else {
        logger.debug(`Flushed ${dbMetrics.length} metrics`);
      }
    } catch (err) {
      logger.error('Metrics flush error:', err);
      // Put metrics back in buffer to retry
      this.metricsBuffer.unshift(...metricsToFlush);
    }
  }

  async getOperationStats(
    operation?: string,
    timeRangeHours: number = 24
  ): Promise<any> {
    const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);

    const query = supabase
      .from('app_metrics')
      .select('*')
      .gte('timestamp', since.toISOString());

    if (operation) {
      query.eq('operation', operation);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch operation stats:', error);
      return null;
    }

    // Calculate statistics
    const stats = {
      totalOperations: data.length,
      successfulOperations: data.filter(m => m.success).length,
      failedOperations: data.filter(m => !m.success).length,
      averageDuration: data.reduce((sum, m) => sum + m.duration, 0) / data.length || 0,
      totalFilesProcessed: data.reduce((sum, m) => sum + m.file_count, 0),
      totalSizeProcessed: data.reduce((sum, m) => sum + m.total_size, 0),
      errorRate: (data.filter(m => !m.success).length / data.length) * 100 || 0,
      operationBreakdown: this.groupByOperation(data),
    };

    return stats;
  }

  private groupByOperation(metrics: any[]): Record<string, any> {
    const grouped: Record<string, any> = {};

    for (const metric of metrics) {
      if (!grouped[metric.operation]) {
        grouped[metric.operation] = {
          count: 0,
          successCount: 0,
          totalDuration: 0,
          totalFiles: 0,
          totalSize: 0,
          errors: [],
        };
      }

      const group = grouped[metric.operation];
      group.count++;
      if (metric.success) group.successCount++;
      group.totalDuration += metric.duration;
      group.totalFiles += metric.file_count;
      group.totalSize += metric.total_size;
      if (!metric.success && metric.error_message) {
        group.errors.push(metric.error_message);
      }
    }

    // Calculate averages
    for (const operation in grouped) {
      const group = grouped[operation];
      group.averageDuration = group.totalDuration / group.count;
      group.successRate = (group.successCount / group.count) * 100;
    }

    return grouped;
  }

  getSystemMetrics(): SystemMetrics[] {
    return [...this.systemMetrics];
  }

  getActiveOperations(): string[] {
    return Array.from(this.operationMetrics.keys());
  }

  // Real-time metrics for dashboard
  getCurrentStats(): any {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    
    const recentMetrics = this.systemMetrics.filter(
      m => m.timestamp > oneMinuteAgo
    );

    const avgMemoryUsage = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + (m.memoryUsage || 0), 0) / recentMetrics.length
      : 0;

    return {
      activeOperations: this.operationMetrics.size,
      pendingMetrics: this.metricsBuffer.length,
      averageMemoryUsage: avgMemoryUsage.toFixed(1),
      systemMetricsCount: this.systemMetrics.length,
    };
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush(); // Final flush
  }
}

export const metricsCollector = MetricsCollector.getInstance();