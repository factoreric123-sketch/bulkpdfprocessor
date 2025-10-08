// FREE Error Tracking using Supabase
import { supabase } from '@/integrations/supabase/client';

interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  context?: Record<string, any>;
}

class ErrorTracker {
  private errors: ErrorReport[] = [];
  private flushTimeout: number | null = null;

  constructor() {
    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers() {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.trackError(event.error || new Error(event.message), {
        type: 'unhandled',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(
        new Error(`Unhandled Promise Rejection: ${event.reason}`),
        { type: 'unhandled_promise' }
      );
    });
  }

  trackError(error: Error, context?: Record<string, any>) {
    const report: ErrorReport = {
      message: error.message,
      stack: error.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      context,
    };

    this.errors.push(report);
    
    // Batch errors and send after a delay
    if (this.flushTimeout) window.clearTimeout(this.flushTimeout);
    this.flushTimeout = window.setTimeout(() => this.flush(), 5000);
    
    // Log to console in development
    if (import.meta.env.MODE === 'development') {
      console.error('Tracked error:', report);
    }
  }

  private async flush() {
    if (this.errors.length === 0) return;

    try {
      const { error } = await (supabase as any)
        .from('error_logs')
        .insert(this.errors as any);

      if (!error) {
        this.errors = [];
      }
    } catch (err) {
      console.error('Failed to send error reports:', err);
    }
  }

  // Get error stats for display
  async getErrorStats() {
    const { data, error } = await (supabase as any)
      .from('error_logs')
      .select('message, count')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('count', { ascending: false })
      .limit(10);

    return data || [];
  }
}

export const errorTracker = new ErrorTracker();