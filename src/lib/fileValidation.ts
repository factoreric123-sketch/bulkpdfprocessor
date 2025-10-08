import { FILE_PROCESSING, SECURITY } from './constants';
import { logger } from './logger';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedName?: string;
}

export function validateFile(file: File): ValidationResult {
  // Check file size
  if (file.size > FILE_PROCESSING.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File "${file.name}" exceeds maximum size of ${FILE_PROCESSING.MAX_FILE_SIZE / (1024 * 1024)}MB`,
    };
  }

  // Check file extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!SECURITY.ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `File type "${extension}" is not supported. Allowed types: ${SECURITY.ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  // Sanitize filename
  const sanitizedName = sanitizeFileName(file.name);

  return {
    valid: true,
    sanitizedName,
  };
}

export function sanitizeFileName(filename: string): string {
  // Get file extension
  const parts = filename.split('.');
  const extension = parts.length > 1 ? '.' + parts.pop() : '';
  const baseName = parts.join('.');

  // Sanitize base name
  let sanitized = baseName.replace(SECURITY.FILENAME_SANITIZE_REGEX, '_');
  
  // Remove consecutive underscores
  sanitized = sanitized.replace(/_+/g, '_');
  
  // Remove leading/trailing underscores
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  
  // Ensure filename isn't empty
  if (!sanitized) {
    sanitized = 'unnamed';
  }
  
  // Limit length
  const maxBaseLength = SECURITY.MAX_FILENAME_LENGTH - extension.length;
  if (sanitized.length > maxBaseLength) {
    sanitized = sanitized.substring(0, maxBaseLength);
  }
  
  return sanitized + extension;
}

export function validateBatch(files: File[]): {
  validFiles: File[];
  errors: string[];
  totalSize: number;
} {
  const validFiles: File[] = [];
  const errors: string[] = [];
  let totalSize = 0;

  // Check total file count
  if (files.length > FILE_PROCESSING.MAX_FILES_PER_BATCH) {
    errors.push(`Too many files. Maximum ${FILE_PROCESSING.MAX_FILES_PER_BATCH} files allowed per batch.`);
    return { validFiles: [], errors, totalSize: 0 };
  }

  for (const file of files) {
    const validation = validateFile(file);
    
    if (validation.valid) {
      totalSize += file.size;
      
      // Check cumulative size
      if (totalSize > FILE_PROCESSING.MAX_TOTAL_SIZE) {
        errors.push(`Total batch size exceeds ${FILE_PROCESSING.MAX_TOTAL_SIZE / (1024 * 1024)}MB limit`);
        break;
      }
      
      validFiles.push(file);
    } else {
      errors.push(validation.error!);
    }
  }

  logger.info(`Batch validation: ${validFiles.length} valid files, ${errors.length} errors, total size: ${(totalSize / (1024 * 1024)).toFixed(2)}MB`);

  return { validFiles, errors, totalSize };
}

// Memory estimation for PDF operations
export function estimateMemoryUsage(files: File[]): number {
  // Rough estimate: 2.5x file size for PDF processing (original + parsed + working memory)
  const totalFileSize = files.reduce((sum, file) => sum + file.size, 0);
  return totalFileSize * 2.5;
}

// Check if we have enough memory for operation
export function canProcessInMemory(files: File[]): boolean {
  if (!performance.memory) {
    // If memory API not available, use conservative estimate
    logger.warn('Performance.memory API not available, using conservative limits');
    return files.length <= 10 && estimateMemoryUsage(files) < 100 * 1024 * 1024; // 100MB
  }

  const estimatedUsage = estimateMemoryUsage(files);
  const availableMemory = performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize;
  const canProcess = estimatedUsage < availableMemory * FILE_PROCESSING.MAX_MEMORY_USAGE;

  logger.info(`Memory check: Estimated ${(estimatedUsage / (1024 * 1024)).toFixed(2)}MB, Available: ${(availableMemory / (1024 * 1024)).toFixed(2)}MB, Can process: ${canProcess}`);

  return canProcess;
}