import { errorTracker } from './errorTracking';
import { logger } from './logger';
import { supabase } from '@/integrations/supabase/client';

export interface ProcessingError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
  operation?: string;
  fileName?: string;
}

export class PDFProcessingError extends Error {
  code: string;
  details?: any;
  recoverable: boolean;
  operation?: string;
  fileName?: string;

  constructor(error: ProcessingError) {
    super(error.message);
    this.name = 'PDFProcessingError';
    this.code = error.code;
    this.details = error.details;
    this.recoverable = error.recoverable;
    this.operation = error.operation;
    this.fileName = error.fileName;
  }
}

// Error codes
export const ErrorCodes = {
  // File errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_CORRUPTED: 'FILE_CORRUPTED',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  
  // Processing errors
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  MEMORY_EXCEEDED: 'MEMORY_EXCEEDED',
  TIMEOUT: 'TIMEOUT',
  INVALID_INSTRUCTION: 'INVALID_INSTRUCTION',
  PAGE_OUT_OF_RANGE: 'PAGE_OUT_OF_RANGE',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  
  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  
  // Storage errors
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_WRITE_FAILED: 'STORAGE_WRITE_FAILED',
} as const;

// Error handler with recovery strategies
export class ErrorHandler {
  private static instance: ErrorHandler;
  private retryStrategies: Map<string, (error: PDFProcessingError) => Promise<boolean>>;

  private constructor() {
    this.retryStrategies = new Map();
    this.setupRetryStrategies();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private setupRetryStrategies() {
    // Network errors - always retry
    this.retryStrategies.set(ErrorCodes.NETWORK_ERROR, async () => true);
    
    // Server errors - retry with backoff
    this.retryStrategies.set(ErrorCodes.SERVER_ERROR, async (error) => {
      const details = error.details || {};
      const statusCode = details.statusCode;
      // Retry 5xx errors, not 4xx
      return statusCode >= 500;
    });
    
    // Memory errors - check if we can free memory
    this.retryStrategies.set(ErrorCodes.MEMORY_EXCEEDED, async () => {
      if (typeof window !== 'undefined' && window.gc) {
        window.gc();
        return true;
      }
      return false;
    });
    
    // Storage errors - check quota
    this.retryStrategies.set(ErrorCodes.STORAGE_QUOTA_EXCEEDED, async () => {
      // Could implement storage cleanup here
      return false;
    });
  }

  async handle(error: Error | PDFProcessingError, context?: any): Promise<ProcessingError> {
    // Log the error
    logger.error('Error occurred:', error, context);

    // Track the error
    errorTracker.trackError(error, context);

    // Convert to PDFProcessingError if needed
    const pdfError = error instanceof PDFProcessingError 
      ? error 
      : this.classifyError(error, context);

    // Store error in database for analysis
    await this.storeError(pdfError, context);

    return {
      code: pdfError.code,
      message: pdfError.message,
      details: pdfError.details,
      recoverable: pdfError.recoverable,
      operation: pdfError.operation,
      fileName: pdfError.fileName,
    };
  }

  private classifyError(error: Error, context?: any): PDFProcessingError {
    const message = error.message.toLowerCase();
    
    // Classify based on error message patterns
    if (message.includes('network') || message.includes('fetch')) {
      return new PDFProcessingError({
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Network connection error',
        recoverable: true,
        details: { originalError: error.message },
        ...context,
      });
    }
    
    if (message.includes('memory') || message.includes('heap')) {
      return new PDFProcessingError({
        code: ErrorCodes.MEMORY_EXCEEDED,
        message: 'Memory limit exceeded',
        recoverable: true,
        details: { originalError: error.message },
        ...context,
      });
    }
    
    if (message.includes('timeout')) {
      return new PDFProcessingError({
        code: ErrorCodes.TIMEOUT,
        message: 'Operation timed out',
        recoverable: true,
        details: { originalError: error.message },
        ...context,
      });
    }
    
    if (message.includes('unauthorized') || message.includes('401')) {
      return new PDFProcessingError({
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Authentication required',
        recoverable: false,
        details: { originalError: error.message },
        ...context,
      });
    }
    
    // Default processing error
    return new PDFProcessingError({
      code: ErrorCodes.PROCESSING_FAILED,
      message: error.message || 'Processing failed',
      recoverable: false,
      details: { originalError: error.message },
      ...context,
    });
  }

  async shouldRetry(error: PDFProcessingError): Promise<boolean> {
    if (!error.recoverable) return false;
    
    const strategy = this.retryStrategies.get(error.code);
    if (strategy) {
      return await strategy(error);
    }
    
    return error.recoverable;
  }

  private async storeError(error: PDFProcessingError, context?: any) {
    try {
      const { error: dbError } = await supabase
        .from('error_logs')
        .insert({
          message: error.message,
          stack: error.stack,
          context: {
            code: error.code,
            details: error.details,
            operation: error.operation,
            fileName: error.fileName,
            ...context,
          },
          url: window?.location?.href,
          userAgent: navigator?.userAgent,
          timestamp: new Date().toISOString(),
        });
        
      if (dbError) {
        logger.warn('Failed to store error in database:', dbError);
      }
    } catch (err) {
      logger.warn('Error storing error log:', err);
    }
  }

  // Helper to create user-friendly error messages
  getUserMessage(error: ProcessingError): string {
    switch (error.code) {
      case ErrorCodes.FILE_NOT_FOUND:
        return `File not found: ${error.fileName || 'unknown'}`;
      case ErrorCodes.FILE_TOO_LARGE:
        return `File is too large. Maximum size is 50MB.`;
      case ErrorCodes.INVALID_FILE_TYPE:
        return `Invalid file type. Only PDF files are supported.`;
      case ErrorCodes.FILE_CORRUPTED:
        return `File appears to be corrupted and cannot be processed.`;
      case ErrorCodes.MEMORY_EXCEEDED:
        return `Operation requires too much memory. Try processing fewer files at once.`;
      case ErrorCodes.TIMEOUT:
        return `Operation took too long. Try processing fewer files at once.`;
      case ErrorCodes.NETWORK_ERROR:
        return `Network connection error. Please check your internet connection.`;
      case ErrorCodes.SERVER_ERROR:
        return `Server error occurred. Please try again later.`;
      case ErrorCodes.UNAUTHORIZED:
        return `Please sign in to continue.`;
      case ErrorCodes.INSUFFICIENT_CREDITS:
        return `Insufficient credits. Please purchase more credits to continue.`;
      case ErrorCodes.PAGE_OUT_OF_RANGE:
        return `Page number out of range in file: ${error.fileName || 'unknown'}`;
      default:
        return error.message || 'An unexpected error occurred.';
    }
  }
}

export const errorHandler = ErrorHandler.getInstance();