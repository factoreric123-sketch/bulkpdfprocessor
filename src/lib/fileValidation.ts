// Centralized file validation and error handling utilities
// Provides MIME type validation, file size limits, and retry logic

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  mimeType?: string;
  size?: number;
}

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
};

// MIME type validation for supported file types
export const SUPPORTED_MIME_TYPES = {
  PDF: [
    'application/pdf',
    'application/x-pdf',
    'application/acrobat',
    'application/vnd.pdf',
    'text/pdf',
    'text/x-pdf',
  ],
  WORD: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'application/vnd.ms-word',
    'application/vnd.oasis.opendocument.text', // .odt
  ],
  EXCEL: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/vnd.oasis.opendocument.spreadsheet', // .ods
  ],
} as const;

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  MAX_PDF_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_WORD_SIZE: 50 * 1024 * 1024,  // 50MB
  MAX_EXCEL_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_BATCH_SIZE: 500 * 1024 * 1024, // 500MB total batch
} as const;

/**
 * Validates file MIME type and size
 */
export const validateFile = (
  file: File,
  expectedTypes: string[],
  maxSize: number = FILE_SIZE_LIMITS.MAX_PDF_SIZE
): FileValidationResult => {
  try {
    // Check file size
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File size ${formatBytes(file.size)} exceeds limit of ${formatBytes(maxSize)}`,
        size: file.size,
      };
    }

    // Check MIME type
    const mimeType = file.type.toLowerCase();
    const isValidMimeType = expectedTypes.some(type => 
      mimeType === type.toLowerCase()
    );

    if (!isValidMimeType && file.name) {
      // Fallback to extension-based validation
      const extension = file.name.toLowerCase().split('.').pop();
      const isValidExtension = validateByExtension(extension, expectedTypes);
      
      if (!isValidExtension) {
        return {
          isValid: false,
          error: `Invalid file type. Expected: ${expectedTypes.join(', ')}, got: ${mimeType || 'unknown'}`,
          mimeType,
          size: file.size,
        };
      }
    }

    return {
      isValid: true,
      mimeType,
      size: file.size,
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      size: file.size,
    };
  }
};

/**
 * Fallback validation by file extension
 */
const validateByExtension = (extension: string | undefined, expectedTypes: string[]): boolean => {
  if (!extension) return false;
  
  const extensionMap: Record<string, string[]> = {
    'pdf': SUPPORTED_MIME_TYPES.PDF,
    'doc': SUPPORTED_MIME_TYPES.WORD,
    'docx': SUPPORTED_MIME_TYPES.WORD,
    'odt': SUPPORTED_MIME_TYPES.WORD,
    'xls': SUPPORTED_MIME_TYPES.EXCEL,
    'xlsx': SUPPORTED_MIME_TYPES.EXCEL,
    'ods': SUPPORTED_MIME_TYPES.EXCEL,
  };

  const mimeTypes = extensionMap[extension];
  return mimeTypes ? expectedTypes.some(type => mimeTypes.includes(type)) : false;
};

/**
 * Validates PDF file specifically
 */
export const validatePdfFile = (file: File): FileValidationResult => {
  return validateFile(file, SUPPORTED_MIME_TYPES.PDF, FILE_SIZE_LIMITS.MAX_PDF_SIZE);
};

/**
 * Validates Word document file specifically
 */
export const validateWordFile = (file: File): FileValidationResult => {
  return validateFile(file, SUPPORTED_MIME_TYPES.WORD, FILE_SIZE_LIMITS.MAX_WORD_SIZE);
};

/**
 * Validates Excel file specifically
 */
export const validateExcelFile = (file: File): FileValidationResult => {
  return validateFile(file, SUPPORTED_MIME_TYPES.EXCEL, FILE_SIZE_LIMITS.MAX_EXCEL_SIZE);
};

/**
 * Validates batch of files for total size limit
 */
export const validateBatchSize = (files: File[]): FileValidationResult => {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  
  if (totalSize > FILE_SIZE_LIMITS.MAX_BATCH_SIZE) {
    return {
      isValid: false,
      error: `Batch size ${formatBytes(totalSize)} exceeds limit of ${formatBytes(FILE_SIZE_LIMITS.MAX_BATCH_SIZE)}`,
      size: totalSize,
    };
  }

  return {
    isValid: true,
    size: totalSize,
  };
};

/**
 * Retry mechanism for async operations
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
  context?: string
): Promise<T> => {
  let lastError: Error | null = null;
  let delay = options.delayMs;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === options.maxRetries) {
        const contextMsg = context ? ` (${context})` : '';
        throw new Error(`Operation failed after ${options.maxRetries + 1} attempts${contextMsg}: ${lastError.message}`);
      }

      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= options.backoffMultiplier;
    }
  }

  throw lastError || new Error('Unknown error in retry mechanism');
};

/**
 * Safe file name normalization
 */
export const normalizeFileName = (fileName: string): string => {
  return fileName
    .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .toLowerCase(); // Normalize to lowercase
};

/**
 * Ensures file has correct extension
 */
export const ensureFileExtension = (fileName: string, expectedExtension: string): string => {
  const normalizedName = normalizeFileName(fileName);
  const extension = expectedExtension.startsWith('.') ? expectedExtension : `.${expectedExtension}`;
  
  if (normalizedName.endsWith(extension)) {
    return normalizedName;
  }
  
  return `${normalizedName}${extension}`;
};

/**
 * Format bytes to human readable string
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Timeout wrapper for async operations
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  context?: string
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        const contextMsg = context ? ` (${context})` : '';
        reject(new Error(`Operation timed out after ${timeoutMs}ms${contextMsg}`));
      }, timeoutMs);
    }),
  ]);
};

/**
 * Memory-efficient file reading with streaming
 */
export const readFileAsStream = async (
  file: File,
  chunkSize: number = 64 * 1024 // 64KB chunks
): Promise<ReadableStream<Uint8Array>> => {
  return file.stream();
};

/**
 * Process file in chunks to avoid memory issues
 */
export const processFileInChunks = async <T>(
  file: File,
  processor: (chunk: Uint8Array, offset: number) => Promise<T>,
  chunkSize: number = 64 * 1024
): Promise<T[]> => {
  const results: T[] = [];
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  for (let offset = 0; offset < uint8Array.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, uint8Array.length);
    const chunk = uint8Array.slice(offset, end);
    const result = await processor(chunk, offset);
    results.push(result);
  }
  
  return results;
};

/**
 * Cleanup utility for temporary resources
 */
export const cleanupResources = (resources: Array<{ cleanup: () => void | Promise<void> }>) => {
  return Promise.allSettled(
    resources.map(resource => 
      Promise.resolve(resource.cleanup()).catch(error => 
        console.warn('Cleanup error:', error)
      )
    )
  );
};