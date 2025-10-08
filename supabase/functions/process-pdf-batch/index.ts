// process-pdf-batch: Server-side PDF batch processing with improved error handling and memory management
// Handles large merges reliably with proper cleanup and validation

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import JSZip from 'npm:jszip@3.10.1';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

// Provided by Lovable Cloud runtime for background tasks
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MergeInstruction {
  sourceFiles: string[];
  outputName: string;
}

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  MAX_PDF_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_BATCH_SIZE: 500 * 1024 * 1024, // 500MB total batch
} as const;

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
};

// Helper function to validate file size
const validateFileSize = (size: number, maxSize: number): boolean => {
  return size <= maxSize;
};

// Helper function to retry operations
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = RETRY_CONFIG.maxRetries,
  delayMs: number = RETRY_CONFIG.delayMs
): Promise<T> => {
  let lastError: Error | null = null;
  let delay = delayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw new Error(`Operation failed after ${maxRetries + 1} attempts: ${lastError.message}`);
      }

      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= RETRY_CONFIG.backoffMultiplier;
    }
  }

  throw lastError || new Error('Unknown error in retry mechanism');
};

// Helper function to normalize file names
const normalizeFileName = (fileName: string): string => {
  return fileName
    .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .toLowerCase(); // Normalize to lowercase
};

// Helper function to ensure file extension
const ensureFileExtension = (fileName: string, expectedExtension: string): string => {
  const normalizedName = normalizeFileName(fileName);
  const extension = expectedExtension.startsWith('.') ? expectedExtension : `.${expectedExtension}`;
  
  if (normalizedName.endsWith(extension)) {
    return normalizedName;
  }
  
  return `${normalizedName}${extension}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Client for reading the user from the JWT
  const authedClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await authedClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid user' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  const userId = userData.user.id;

  // Service role client for DB/storage operations
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json();
    const operation: 'merge' = body.operation; // currently only merge is supported here
    const instructions: MergeInstruction[] = body.instructions || [];

    // Validate instructions
    if (!instructions || instructions.length === 0) {
      throw new Error('No instructions provided');
    }

    // Validate batch size
    let totalEstimatedSize = 0;
    for (const instruction of instructions) {
      totalEstimatedSize += instruction.sourceFiles.length * 10 * 1024 * 1024; // Estimate 10MB per file
    }
    
    if (totalEstimatedSize > FILE_SIZE_LIMITS.MAX_BATCH_SIZE) {
      throw new Error(`Batch size too large. Estimated ${Math.round(totalEstimatedSize / 1024 / 1024)}MB exceeds limit of ${FILE_SIZE_LIMITS.MAX_BATCH_SIZE / 1024 / 1024}MB`);
    }

    // Create job row
    const { data: job, error: jobErr } = await supabase
      .from('processing_jobs')
      .insert({ 
        user_id: userId, 
        operation, 
        status: 'queued', 
        total: instructions.length, 
        processed: 0,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (jobErr || !job) {
      throw new Error(`Failed to create job: ${jobErr?.message}`);
    }

    const jobId = job.id as string;

    // Respond immediately; run the heavy work in the background
    EdgeRuntime.waitUntil(handleMergeJob(supabase, userId, jobId, instructions));

    return new Response(JSON.stringify({ jobId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error('PDF batch processing error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});

async function handleMergeJob(
  supabase: any,
  userId: string,
  jobId: string,
  instructions: MergeInstruction[],
) {
  // Mark job as processing
  await supabase.from('processing_jobs').update({ 
    status: 'processing',
    started_at: new Date().toISOString()
  }).eq('id', jobId);

  const zip = new JSZip();
  const allErrors: string[] = [];
  let processed = 0;
  const tempResources: Array<{ cleanup: () => void }> = [];

  try {
    for (const instruction of instructions) {
      try {
        const mergedPdf = await PDFDocument.create();
        const missingFiles: string[] = [];
        let metadataPreserved = false;

        for (const fileName of instruction.sourceFiles) {
          const path = `${userId}/${fileName}`;
          
          // Download file with retry
          const { data: fileData, error: dlErr } = await withRetry(async () => {
            const result = await supabase.storage
              .from('pdf-uploads')
              .download(path);
            
            if (result.error) {
              throw new Error(result.error.message);
            }
            
            return result;
          });
          
          if (dlErr || !fileData) {
            missingFiles.push(fileName);
            continue; // skip missing
          }

          // Validate file size
          const fileSize = fileData.size;
          if (!validateFileSize(fileSize, FILE_SIZE_LIMITS.MAX_PDF_SIZE)) {
            allErrors.push(`File ${fileName} is too large (${Math.round(fileSize / 1024 / 1024)}MB)`);
            missingFiles.push(fileName);
            continue;
          }

          const buf = await fileData.arrayBuffer();
          const srcPdf = await PDFDocument.load(buf);
          
          // Preserve metadata from first valid PDF
          if (!metadataPreserved && srcPdf.getPageCount() > 0) {
            try {
              const title = srcPdf.getTitle() || instruction.outputName.replace(/\.pdf$/i, '');
              mergedPdf.setTitle(title);
              mergedPdf.setProducer('Bulk PDF Processor');
              mergedPdf.setCreator('Bulk PDF Processor');
              mergedPdf.setModificationDate(new Date());
              metadataPreserved = true;
            } catch (metaError) {
              console.warn('Failed to preserve metadata:', metaError);
            }
          }
          
          const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
          pages.forEach((p) => mergedPdf.addPage(p));
          
          // Clean up PDF document
          tempResources.push({
            cleanup: () => {
              (srcPdf as any) = null;
            }
          });
        }

        // Even if some files were missing, we still save what we could merge
        if (mergedPdf.getPageCount() > 0) {
          const mergedBytes = await mergedPdf.save();
          const outName = ensureFileExtension(instruction.outputName, 'pdf');

          zip.file(outName, mergedBytes);

          if (missingFiles.length > 0) {
            allErrors.push(
              `Output ${outName}: missing ${missingFiles.length} file(s): ${missingFiles.join(', ')}`,
            );
          }
        } else {
          allErrors.push(`No valid pages found for ${instruction.outputName}`);
        }
        
      } catch (e) {
        allErrors.push(`Instruction failed (${instruction.outputName}): ${(e as Error).message}`);
      } finally {
        processed += 1;
        await supabase
          .from('processing_jobs')
          .update({ processed })
          .eq('id', jobId);
      }
    }

    // Generate the ZIP and upload to results
    const zipBlob = await zip.generateAsync({ 
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    const resultPath = `${userId}/${jobId}/result.zip`;

    const { error: upErr } = await supabase.storage
      .from('pdf-results')
      .upload(resultPath, zipBlob, { 
        contentType: 'application/zip',
        upsert: true 
      });

    if (upErr) throw upErr;

    await supabase
      .from('processing_jobs')
      .update({ 
        status: 'completed', 
        errors: allErrors, 
        result_path: resultPath,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
      
  } catch (finalErr) {
    console.error('Final error in merge job:', finalErr);
    await supabase
      .from('processing_jobs')
      .update({ 
        status: 'failed', 
        errors: allErrors.concat([(finalErr as Error).message]),
        failed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  } finally {
    // Cleanup temporary resources
    await Promise.allSettled(
      tempResources.map(resource => 
        Promise.resolve(resource.cleanup()).catch(error => 
          console.warn('Cleanup error:', error)
        )
      )
    );
  }
}