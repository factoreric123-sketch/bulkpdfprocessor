// Unified PDF operations processor with enhanced reliability
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import JSZip from 'npm:jszip@3.10.1';
import { PDFDocument, PDFName } from 'npm:pdf-lib@1.17.1';
import { 
  withErrorHandling, 
  validateRequest, 
  rateLimit, 
  EdgeError, 
  ErrorCodes 
} from '../_shared/errorMiddleware.ts';

declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types for different operations
interface BaseInstruction {
  sourceFile: string;
  outputName: string;
}

interface DeletePagesInstruction extends BaseInstruction {
  pagesToDelete: number[];
}

interface SplitInstruction {
  sourceFile: string;
  pageRanges: { start: number; end: number }[];
  outputNames: string[];
}

interface ReorderInstruction extends BaseInstruction {
  newPageOrder: number[];
}

interface RenameInstruction {
  oldName: string;
  newName: string;
}

// Constants
const MAX_FILES_PER_JOB = 200;
const CHUNK_SIZE = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const OPERATION_TIMEOUT = 25 * 60 * 1000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

Deno.serve(withErrorHandling('process-pdf-operations', async (req) => {
  // Validate request
  await validateRequest(req, {
    method: 'POST',
    headers: ['Authorization'],
    body: {
      operation: 'string',
      instructions: 'array',
    },
  });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization')!;

  const authedClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  
  const { data: userData, error: userErr } = await authedClient.auth.getUser();
  if (userErr || !userData?.user) {
    throw new EdgeError(ErrorCodes.UNAUTHORIZED);
  }
  
  const userId = userData.user.id;
  
  // Apply rate limiting
  await rateLimit(req, {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 100 requests per hour
    keyGenerator: () => userId,
  });
  
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  
  const body = await req.json();
  const operation: 'delete' | 'split' | 'reorder' | 'rename' = body.operation;
  const instructions = body.instructions || [];

  // Validate batch size
  const totalFiles = Array.isArray(instructions) ? instructions.length : 0;
  if (totalFiles > MAX_FILES_PER_JOB) {
    throw new EdgeError(ErrorCodes.INVALID_REQUEST, {
      message: `Too many operations (${totalFiles}). Maximum ${MAX_FILES_PER_JOB} per batch.`,
    });
  }

    // Create job with enhanced tracking
    const { data: job, error: jobErr } = await supabase
      .from('processing_jobs')
      .insert({ 
        user_id: userId, 
        operation, 
        status: 'queued', 
        total: totalFiles, 
        processed: 0,
        file_count: totalFiles,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (jobErr || !job) {
      throw new EdgeError(ErrorCodes.PROCESSING_FAILED, {
        message: `Failed to create job: ${jobErr?.message}`,
      });
    }

    const jobId = job.id as string;

    // Run in background with timeout protection
    EdgeRuntime.waitUntil(
      Promise.race([
        processOperations(supabase, userId, jobId, operation, instructions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Job timeout')), OPERATION_TIMEOUT)
        )
      ]).catch(async (err) => {
        console.error(`Job ${jobId} failed:`, err);
        await supabase
          .from('processing_jobs')
          .update({ 
            status: 'failed', 
            errors: [err.message],
            updated_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      })
    );

    return new Response(JSON.stringify({ jobId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
}));

async function processOperations(
  supabase: any,
  userId: string,
  jobId: string,
  operation: string,
  instructions: any[]
) {
  await supabase
    .from('processing_jobs')
    .update({ 
      status: 'processing', 
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString() 
    })
    .eq('id', jobId);

  const zip = new JSZip();
  const allErrors: string[] = [];
  let processed = 0;
  let totalSizeBytes = 0;

  // Process in chunks for better memory management
  for (let i = 0; i < instructions.length; i += CHUNK_SIZE) {
    const chunk = instructions.slice(i, i + CHUNK_SIZE);
    
    // Process chunk in parallel with retry logic
    const chunkResults = await Promise.allSettled(
      chunk.map(async (instruction) => {
        let lastError: Error | null = null;
        
        // Retry logic
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            const result = await processInstruction(
              supabase, 
              userId, 
              operation, 
              instruction
            );
            return result;
          } catch (err) {
            lastError = err as Error;
            console.warn(`Attempt ${attempt + 1} failed:`, err);
            
            if (attempt < MAX_RETRIES - 1) {
              // Exponential backoff
              await new Promise(resolve => 
                setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt))
              );
            }
          }
        }
        
        throw lastError || new Error('Unknown error');
      })
    );

    // Handle results
    for (let j = 0; j < chunkResults.length; j++) {
      const result = chunkResults[j];
      const instruction = chunk[j];
      
      if (result.status === 'fulfilled' && result.value) {
        const files = Array.isArray(result.value) ? result.value : [result.value];
        
        for (const file of files) {
          if (file && file.data) {
            const fileName = file.name.endsWith('.pdf') ? file.name : `${file.name}.pdf`;
            zip.file(fileName, file.data);
            totalSizeBytes += file.data.length;
          }
        }
        
        if (result.value.errors?.length > 0) {
          allErrors.push(...result.value.errors);
        }
      } else {
        const error = result.status === 'rejected' ? result.reason : 'Unknown error';
        const fileName = instruction.sourceFile || instruction.oldName || 'unknown';
        allErrors.push(`Failed to process ${fileName}: ${error}`);
      }
      
      processed++;
      await supabase
        .from('processing_jobs')
        .update({ 
          processed,
          total_size_bytes: totalSizeBytes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }

    // Small delay between chunks
    if (i + CHUNK_SIZE < instructions.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Save results
  try {
    const zipBlob = await zip.generateAsync({ 
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      streamFiles: true,
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
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_size_bytes: totalSizeBytes,
      })
      .eq('id', jobId);

    // Track metrics
    await trackMetrics(supabase, operation, processed, totalSizeBytes, allErrors.length === 0);
  } catch (finalErr) {
    await supabase
      .from('processing_jobs')
      .update({ 
        status: 'failed', 
        errors: allErrors.concat([(finalErr as Error).message]),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}

async function processInstruction(
  supabase: any,
  userId: string,
  operation: string,
  instruction: any
): Promise<any> {
  switch (operation) {
    case 'delete':
      return await processDeletePages(supabase, userId, instruction);
    case 'split':
      return await processSplit(supabase, userId, instruction);
    case 'reorder':
      return await processReorder(supabase, userId, instruction);
    case 'rename':
      return await processRename(supabase, userId, instruction);
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

async function processDeletePages(
  supabase: any,
  userId: string,
  instruction: DeletePagesInstruction
): Promise<{ name: string; data: Uint8Array; errors: string[] }> {
  const sanitizedFileName = sanitizeFileName(instruction.sourceFile);
  const path = `${userId}/${sanitizedFileName}`;
  
  const { data: fileData, error: dlErr } = await supabase.storage
    .from('pdf-uploads')
    .download(path);
  
  if (dlErr || !fileData) {
    throw new Error(`File not found: ${instruction.sourceFile}`);
  }

  const buf = await fileData.arrayBuffer();
  const pdf = await PDFDocument.load(buf, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
  });
  
  // Sort pages to delete in descending order to avoid index shifting
  const sortedPages = [...instruction.pagesToDelete].sort((a, b) => b - a);
  
  for (const pageIndex of sortedPages) {
    if (pageIndex >= 0 && pageIndex < pdf.getPageCount()) {
      pdf.removePage(pageIndex);
    }
  }
  
  const data = await pdf.save({ useObjectStreams: false });
  return { 
    name: instruction.outputName, 
    data,
    errors: []
  };
}

async function processSplit(
  supabase: any,
  userId: string,
  instruction: SplitInstruction
): Promise<{ name: string; data: Uint8Array }[]> {
  const sanitizedFileName = sanitizeFileName(instruction.sourceFile);
  const path = `${userId}/${sanitizedFileName}`;
  
  const { data: fileData, error: dlErr } = await supabase.storage
    .from('pdf-uploads')
    .download(path);
  
  if (dlErr || !fileData) {
    throw new Error(`File not found: ${instruction.sourceFile}`);
  }

  const buf = await fileData.arrayBuffer();
  const sourcePdf = await PDFDocument.load(buf, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
  });
  
  const results: { name: string; data: Uint8Array }[] = [];
  
  for (let i = 0; i < instruction.pageRanges.length; i++) {
    const range = instruction.pageRanges[i];
    const outputName = instruction.outputNames[i] || `${instruction.sourceFile}_part${i + 1}.pdf`;
    
    const newPdf = await PDFDocument.create();
    
    for (let pageNum = range.start; pageNum <= range.end; pageNum++) {
      if (pageNum >= 0 && pageNum < sourcePdf.getPageCount()) {
        const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNum]);
        newPdf.addPage(copiedPage);
      }
    }
    
    const pdfBytes = await newPdf.save({ useObjectStreams: false });
    results.push({ 
      name: sanitizeFileName(outputName), 
      data: pdfBytes 
    });
    
    // Clear reference for garbage collection
    (newPdf as any).context = null;
  }
  
  // Clear source PDF reference
  (sourcePdf as any).context = null;
  
  return results;
}

async function processReorder(
  supabase: any,
  userId: string,
  instruction: ReorderInstruction
): Promise<{ name: string; data: Uint8Array; errors: string[] }> {
  const sanitizedFileName = sanitizeFileName(instruction.sourceFile);
  const path = `${userId}/${sanitizedFileName}`;
  
  const { data: fileData, error: dlErr } = await supabase.storage
    .from('pdf-uploads')
    .download(path);
  
  if (dlErr || !fileData) {
    throw new Error(`File not found: ${instruction.sourceFile}`);
  }

  const buf = await fileData.arrayBuffer();
  const sourcePdf = await PDFDocument.load(buf, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
  });
  
  const newPdf = await PDFDocument.create();
  
  for (const pageIndex of instruction.newPageOrder) {
    if (pageIndex >= 0 && pageIndex < sourcePdf.getPageCount()) {
      const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
      newPdf.addPage(copiedPage);
    }
  }
  
  const data = await newPdf.save({ useObjectStreams: false });
  
  // Clear references
  (sourcePdf as any).context = null;
  (newPdf as any).context = null;
  
  return { 
    name: instruction.outputName, 
    data,
    errors: []
  };
}

async function processRename(
  supabase: any,
  userId: string,
  instruction: RenameInstruction
): Promise<{ name: string; data: Uint8Array; errors: string[] }> {
  const sanitizedOldName = sanitizeFileName(instruction.oldName);
  const path = `${userId}/${sanitizedOldName}`;
  
  const { data: fileData, error: dlErr } = await supabase.storage
    .from('pdf-uploads')
    .download(path);
  
  if (dlErr || !fileData) {
    throw new Error(`File not found: ${instruction.oldName}`);
  }

  const buf = await fileData.arrayBuffer();
  const sourcePdf = await PDFDocument.load(buf, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
  });
  
  // Create new PDF to ensure clean metadata
  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
  copiedPages.forEach((p) => newPdf.addPage(p));

  const baseTitle = (instruction.newName.endsWith('.pdf')
    ? instruction.newName.slice(0, -4)
    : instruction.newName).trim();

  // Set metadata
  try {
    newPdf.setTitle(baseTitle);
    newPdf.setProducer('Bulk PDF Processor');
    newPdf.setCreator('Bulk PDF Processor');
    newPdf.setModificationDate(new Date());
  } catch (err) {
    console.warn('Failed to set PDF metadata:', err);
  }

  const data = await newPdf.save({ useObjectStreams: false });
  
  // Clear references
  (sourcePdf as any).context = null;
  (newPdf as any).context = null;
  
  return { 
    name: instruction.newName, 
    data,
    errors: []
  };
}

function sanitizeFileName(filename: string): string {
  // Remove path traversal attempts
  filename = filename.replace(/\.\./g, '');
  
  // Keep only safe characters
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function trackMetrics(
  supabase: any,
  operation: string,
  fileCount: number,
  totalSize: number,
  success: boolean
) {
  try {
    await supabase
      .from('app_metrics')
      .insert({
        operation: `pdf_${operation}`,
        duration: 0, // Will be calculated from job timestamps
        file_count: fileCount,
        total_size: totalSize,
        success,
        timestamp: new Date().toISOString(),
      });
  } catch (err) {
    console.error('Failed to track metrics:', err);
  }
}