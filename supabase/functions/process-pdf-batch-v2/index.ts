// Enhanced PDF batch processing with better memory management and chunking
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import JSZip from 'npm:jszip@3.10.1';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MergeInstruction {
  sourceFiles: string[];
  outputName: string;
}

// Constants for batch processing
const MAX_FILES_PER_JOB = 200;
const CHUNK_SIZE = 10; // Process 10 files at a time
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const OPERATION_TIMEOUT = 25 * 60 * 1000; // 25 minutes (Edge Function limit is 30)

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
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json();
    const operation: 'merge' = body.operation;
    const instructions: MergeInstruction[] = body.instructions || [];

    // Validate batch size
    const totalFiles = instructions.reduce((sum, inst) => sum + inst.sourceFiles.length, 0);
    if (totalFiles > MAX_FILES_PER_JOB) {
      throw new Error(`Too many files (${totalFiles}). Maximum ${MAX_FILES_PER_JOB} files per batch.`);
    }

    // Create job with timeout tracking
    const { data: job, error: jobErr } = await supabase
      .from('processing_jobs')
      .insert({ 
        user_id: userId, 
        operation, 
        status: 'queued', 
        total: instructions.length, 
        processed: 0,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (jobErr || !job) {
      throw new Error(`Failed to create job: ${jobErr?.message}`);
    }

    const jobId = job.id as string;

    // Run in background with timeout protection
    EdgeRuntime.waitUntil(
      Promise.race([
        handleMergeJobV2(supabase, userId, jobId, instructions),
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
          })
          .eq('id', jobId);
      })
    );

    return new Response(JSON.stringify({ jobId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});

async function handleMergeJobV2(
  supabase: any,
  userId: string,
  jobId: string,
  instructions: MergeInstruction[],
) {
  await supabase
    .from('processing_jobs')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', jobId);

  const zip = new JSZip();
  const allErrors: string[] = [];
  let processed = 0;

  // Process instructions in chunks
  for (let i = 0; i < instructions.length; i += CHUNK_SIZE) {
    const chunk = instructions.slice(i, i + CHUNK_SIZE);
    
    // Process chunk in parallel
    const chunkResults = await Promise.allSettled(
      chunk.map(instruction => processMergeInstruction(supabase, userId, instruction))
    );

    // Handle results
    for (let j = 0; j < chunkResults.length; j++) {
      const result = chunkResults[j];
      const instruction = chunk[j];
      
      if (result.status === 'fulfilled' && result.value) {
        const { data, missingFiles } = result.value;
        const outName = instruction.outputName.endsWith('.pdf')
          ? instruction.outputName
          : `${instruction.outputName}.pdf`;
        
        zip.file(outName, data);
        
        if (missingFiles.length > 0) {
          allErrors.push(
            `Output ${outName}: missing ${missingFiles.length} file(s): ${missingFiles.join(', ')}`
          );
        }
      } else {
        const error = result.status === 'rejected' ? result.reason : 'Unknown error';
        allErrors.push(`Failed to process ${instruction.outputName}: ${error}`);
      }
      
      processed++;
      await supabase
        .from('processing_jobs')
        .update({ 
          processed,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }

    // Small delay between chunks to avoid overwhelming the system
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  } catch (finalErr) {
    await supabase
      .from('processing_jobs')
      .update({ 
        status: 'failed', 
        errors: allErrors.concat([(finalErr as Error).message]),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}

async function processMergeInstruction(
  supabase: any,
  userId: string,
  instruction: MergeInstruction
): Promise<{ data: Uint8Array; missingFiles: string[] } | null> {
  try {
    const mergedPdf = await PDFDocument.create();
    const missingFiles: string[] = [];

    for (const fileName of instruction.sourceFiles) {
      try {
        const sanitizedFileName = sanitizeFileName(fileName);
        const path = `${userId}/${sanitizedFileName}`;
        
        // Check file size first
        const { data: fileInfo, error: infoErr } = await supabase.storage
          .from('pdf-uploads')
          .list(userId, { 
            limit: 1, 
            search: sanitizedFileName 
          });
        
        if (infoErr || !fileInfo || fileInfo.length === 0) {
          missingFiles.push(fileName);
          continue;
        }

        // Skip if file is too large
        if (fileInfo[0].metadata?.size > MAX_FILE_SIZE) {
          missingFiles.push(`${fileName} (exceeds size limit)`);
          continue;
        }

        const { data: fileData, error: dlErr } = await supabase.storage
          .from('pdf-uploads')
          .download(path);
        
        if (dlErr || !fileData) {
          missingFiles.push(fileName);
          continue;
        }

        const buf = await fileData.arrayBuffer();
        const srcPdf = await PDFDocument.load(buf, {
          ignoreEncryption: true,
          throwOnInvalidObject: false,
        });
        
        const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        pages.forEach((p) => mergedPdf.addPage(p));
        
        // Clear reference for garbage collection
        (srcPdf as any).context = null;
      } catch (fileErr) {
        console.error(`Error processing file ${fileName}:`, fileErr);
        missingFiles.push(fileName);
      }
    }

    const mergedBytes = await mergedPdf.save({ useObjectStreams: false });
    return { data: mergedBytes, missingFiles };
  } catch (err) {
    console.error('Merge instruction failed:', err);
    return null;
  }
}

function sanitizeFileName(filename: string): string {
  // Remove any path traversal attempts
  filename = filename.replace(/\.\./g, '');
  
  // Keep only safe characters
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}