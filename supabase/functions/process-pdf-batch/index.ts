// process-pdf-batch: Server-side PDF batch processing with background job
// Handles large merges reliably. Saves a ZIP to storage and updates a job row.

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

    // Create job row
    const { data: job, error: jobErr } = await supabase
      .from('processing_jobs')
      .insert({ user_id: userId, operation, status: 'queued', total: instructions.length, processed: 0 })
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
  await supabase.from('processing_jobs').update({ status: 'processing' }).eq('id', jobId);

  const zip = new JSZip();
  const allErrors: string[] = [];
  let processed = 0;

  for (const instruction of instructions) {
    try {
      const mergedPdf = await PDFDocument.create();
      const missingFiles: string[] = [];

      for (const fileName of instruction.sourceFiles) {
        const path = `${userId}/${fileName}`;
        const { data: fileData, error: dlErr } = await supabase.storage
          .from('pdf-uploads')
          .download(path);
        if (dlErr || !fileData) {
          missingFiles.push(fileName);
          continue; // skip missing
        }

        const buf = await fileData.arrayBuffer();
        const srcPdf = await PDFDocument.load(buf);
        const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        pages.forEach((p) => mergedPdf.addPage(p));
      }

      // Even if some files were missing, we still save what we could merge
      const mergedBytes = await mergedPdf.save();
      const outName = instruction.outputName.endsWith('.pdf')
        ? instruction.outputName
        : `${instruction.outputName}.pdf`;

      zip.file(outName, mergedBytes);

      if (missingFiles.length > 0) {
        allErrors.push(
          `Output ${outName}: missing ${missingFiles.length} file(s): ${missingFiles.join(', ')}`,
        );
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

  try {
    // Generate the ZIP and upload to results
    const zipBlob = await zip.generateAsync({ type: 'uint8array' });
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
      .update({ status: 'completed', errors: allErrors, result_path: resultPath })
      .eq('id', jobId);
  } catch (finalErr) {
    await supabase
      .from('processing_jobs')
      .update({ status: 'failed', errors: allErrors.concat([(finalErr as Error).message]) })
      .eq('id', jobId);
  }
}