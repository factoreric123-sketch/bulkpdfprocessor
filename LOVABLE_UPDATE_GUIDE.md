# Lovable Update Guide - Essential Files for Testing

## Step 1: Create Core Library Files

### 1.1 Create `/src/lib/constants.ts`
Copy this entire file - it contains all the configuration:
```typescript
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
```

### 1.2 Create `/src/lib/fileValidation.ts`
This handles security and validation.

### 1.3 Create `/src/lib/batchProcessor.ts`
This handles the improved upload/download logic.

## Step 2: Update Edge Function

### 2.1 Create new Edge Function `process-pdf-batch-v2`
In Lovable's Functions section, create a new function with this name and copy the content from `/supabase/functions/process-pdf-batch-v2/index.ts`

## Step 3: Quick Test Integration

### 3.1 Update your existing Index.tsx
Instead of replacing the entire file, just update the `processMerge` function:

```typescript
// Add these imports at the top
import { FILE_PROCESSING } from '@/lib/constants';
import { validateBatch } from '@/lib/fileValidation';

// Replace the processMerge function with this updated version:
const processMerge = async () => {
  if (pdfFiles.length === 0 || excelFile.length === 0) {
    toast({
      title: 'Missing files',
      description: 'Please upload both PDF files and an Excel instruction file.',
      variant: 'destructive',
    });
    return;
  }

  // NEW: Check file count limit
  if (pdfFiles.length > FILE_PROCESSING.MAX_FILES_PER_BATCH) {
    toast({
      title: 'Too many files',
      description: `Maximum ${FILE_PROCESSING.MAX_FILES_PER_BATCH} files allowed. You have ${pdfFiles.length} files.`,
      variant: 'destructive',
    });
    return;
  }

  // NEW: Validate files
  const validation = validateBatch(pdfFiles);
  if (validation.errors.length > 0) {
    toast({
      title: 'Validation errors',
      description: validation.errors[0],
      variant: 'destructive',
    });
    if (validation.validFiles.length === 0) return;
  }

  // Rest of your existing processMerge code...
  // The existing server-side processing will still work
};
```

## Step 4: Database Migration

Run this SQL in Lovable's database editor:

```sql
-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_status 
ON public.processing_jobs(user_id, status);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at 
ON public.processing_jobs(created_at DESC);

-- Add cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_stuck_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.processing_jobs
  SET status = 'failed',
      errors = ARRAY['Job timeout - processing took too long'],
      updated_at = NOW()
  WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '1 hour';
END;
$$;
```

## Step 5: Test It!

1. Start with 50 PDFs to ensure it works
2. Monitor the browser console for any errors
3. Check if the new validation messages appear
4. Try with 100+ PDFs if the first test succeeds

## Minimal File List for Testing

1. `/src/lib/constants.ts` - Configuration
2. `/src/lib/fileValidation.ts` - Validation logic
3. `/supabase/functions/process-pdf-batch-v2/index.ts` - New edge function
4. Update the imports and add validation to your existing Index.tsx

This minimal update will let you test the 200+ PDF capability without changing everything at once!