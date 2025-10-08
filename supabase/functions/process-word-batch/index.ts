// process-word-batch: Server-side Word/PDF conversion with background job
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import JSZip from 'https://esm.sh/jszip@3.10.1';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import mammoth from 'https://esm.sh/mammoth@1.8.0';
import { Document, Packer, Paragraph, TextRun } from 'https://esm.sh/docx@9.5.1';
import pdfParse from 'https://esm.sh/pdf-parse@1.1.1';

declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WordToPdfInstruction {
  sourceFile: string;
  outputName: string;
}

interface PdfToWordInstruction {
  sourceFile: string;
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
    const operation: 'word-to-pdf' | 'pdf-to-word' = body.operation;
    const instructions: (WordToPdfInstruction | PdfToWordInstruction)[] = body.instructions || [];

    const { data: job, error: jobErr } = await supabase
      .from('processing_jobs')
      .insert({ user_id: userId, operation, status: 'queued', total: instructions.length, processed: 0 })
      .select('id')
      .single();

    if (jobErr || !job) {
      throw new Error(`Failed to create job: ${jobErr?.message}`);
    }

    const jobId = job.id as string;

    if (operation === 'word-to-pdf') {
      EdgeRuntime.waitUntil(handleWordToPdfJob(supabase, userId, jobId, instructions as WordToPdfInstruction[]));
    } else {
      EdgeRuntime.waitUntil(handlePdfToWordJob(supabase, userId, jobId, instructions as PdfToWordInstruction[]));
    }

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

async function handleWordToPdfJob(
  supabase: any,
  userId: string,
  jobId: string,
  instructions: WordToPdfInstruction[],
) {
  await supabase.from('processing_jobs').update({ status: 'processing' }).eq('id', jobId);

  const zip = new JSZip();
  const allErrors: string[] = [];
  let processed = 0;

  for (const instruction of instructions) {
    try {
      const path = `${userId}/${instruction.sourceFile}`;
      const { data: fileData, error: dlErr } = await supabase.storage
        .from('pdf-uploads')
        .download(path);
      
      if (dlErr || !fileData) {
        allErrors.push(`Missing file: ${instruction.sourceFile}`);
        processed++;
        await supabase.from('processing_jobs').update({ processed }).eq('id', jobId);
        continue;
      }

      // Convert Word to HTML
      const buf = await fileData.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer: buf });
      const html = result.value;

      // Extract text from HTML (preserve structure)
      const textContent = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();

      // Create PDF with proper text wrapping
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 12;
      const lineHeight = fontSize * 1.3;
      const margin = 50;
      
      let currentPage = pdfDoc.addPage();
      let { width, height } = currentPage.getSize();
      let y = height - margin;
      const maxWidth = width - (margin * 2);

      const lines = textContent.split('\n');
      
      for (const line of lines) {
        // Handle empty lines (paragraph breaks)
        if (!line.trim()) {
          y -= lineHeight;
          if (y < margin) {
            currentPage = pdfDoc.addPage();
            y = height - margin;
          }
          continue;
        }

        // Word-wrap long lines
        const words = line.split(' ');
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const textWidth = font.widthOfTextAtSize(testLine, fontSize);
          
          if (textWidth > maxWidth && currentLine) {
            // Draw the current line
            currentPage.drawText(currentLine, {
              x: margin,
              y,
              size: fontSize,
              font,
              color: rgb(0, 0, 0),
            });
            y -= lineHeight;
            
            // Check if we need a new page
            if (y < margin) {
              currentPage = pdfDoc.addPage();
              y = height - margin;
            }
            
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        
        // Draw the remaining text of this line
        if (currentLine) {
          currentPage.drawText(currentLine, {
            x: margin,
            y,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
          y -= lineHeight;
          
          // Check if we need a new page
          if (y < margin) {
            currentPage = pdfDoc.addPage();
            y = height - margin;
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const outName = instruction.outputName.endsWith('.pdf')
        ? instruction.outputName
        : `${instruction.outputName}.pdf`;

      zip.file(outName, pdfBytes);
    } catch (e) {
      allErrors.push(`Failed (${instruction.outputName}): ${(e as Error).message}`);
    } finally {
      processed++;
      await supabase.from('processing_jobs').update({ processed }).eq('id', jobId);
    }
  }

  try {
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

async function handlePdfToWordJob(
  supabase: any,
  userId: string,
  jobId: string,
  instructions: PdfToWordInstruction[],
) {
  await supabase.from('processing_jobs').update({ status: 'processing' }).eq('id', jobId);

  const zip = new JSZip();
  const allErrors: string[] = [];
  let processed = 0;

  for (const instruction of instructions) {
    try {
      const path = `${userId}/${instruction.sourceFile}`;
      const { data: fileData, error: dlErr } = await supabase.storage
        .from('pdf-uploads')
        .download(path);
      
      if (dlErr || !fileData) {
        allErrors.push(`Missing file: ${instruction.sourceFile}`);
        processed++;
        await supabase.from('processing_jobs').update({ processed }).eq('id', jobId);
        continue;
      }

      // Parse PDF to extract text
      const buf = await fileData.arrayBuffer();
      const data = await pdfParse(new Uint8Array(buf));
      const text = data.text || '';

      // Create Word document with extracted text
      const paragraphs: Paragraph[] = [];
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.trim()) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  size: 24, // 12pt
                }),
              ],
            })
          );
        } else {
          paragraphs.push(new Paragraph({ children: [] }));
        }
      }

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs,
          },
        ],
      });

      const blob = await Packer.toBuffer(doc);
      const outName = instruction.outputName.endsWith('.docx')
        ? instruction.outputName
        : `${instruction.outputName}.docx`;

      zip.file(outName, blob);
    } catch (e) {
      allErrors.push(`Failed (${instruction.outputName}): ${(e as Error).message}`);
    } finally {
      processed++;
      await supabase.from('processing_jobs').update({ processed }).eq('id', jobId);
    }
  }

  try {
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
