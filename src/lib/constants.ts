// File processing constants and limits
export const FILE_PROCESSING = {
  // Size limits
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB per file
  MAX_TOTAL_SIZE: 500 * 1024 * 1024, // 500MB total per batch
  
  // Concurrency settings
  CLIENT_SIDE_CONCURRENCY: 3, // Reduced for memory efficiency
  SERVER_SIDE_BATCH_SIZE: 20, // Files per server batch
  MAX_FILES_PER_BATCH: 200, // Maximum files allowed
  
  // Memory management
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks for streaming
  MEMORY_CHECK_INTERVAL: 1000, // Check memory every second
  MAX_MEMORY_USAGE: 0.7, // Use max 70% of available memory
  
  // Timeouts
  OPERATION_TIMEOUT: 5 * 60 * 1000, // 5 minutes per operation
  JOB_TIMEOUT: 30 * 60 * 1000, // 30 minutes for entire job
  
  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // Initial delay in ms
  RETRY_MULTIPLIER: 2, // Exponential backoff
} as const;

// Security settings
export const SECURITY = {
  // Allowed file extensions
  ALLOWED_EXTENSIONS: ['.pdf', '.docx', '.doc'],
  
  // Filename sanitization regex
  FILENAME_SANITIZE_REGEX: /[^a-zA-Z0-9._-]/g,
  
  // Max filename length
  MAX_FILENAME_LENGTH: 255,
} as const;