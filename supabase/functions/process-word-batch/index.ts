// process-word-batch: Server-side Word/PDF conversion with improved error handling and memory management
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

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  MAX_PDF_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_WORD_SIZE: 50 * 1024 * 1024,  // 50MB
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

    // Validate instructions
    if (!instructions || instructions.length === 0) {
      throw new Error('No instructions provided');
    }

    // Validate batch size
    let totalEstimatedSize = 0;
    for (const instruction of instructions) {
      const maxFileSize = operation === 'word-to-pdf' ? FILE_SIZE_LIMITS.MAX_WORD_SIZE : FILE_SIZE_LIMITS.MAX_PDF_SIZE;
      totalEstimatedSize += maxFileSize; // Use max size as estimate
    }
    
    if (totalEstimatedSize > FILE_SIZE_LIMITS.MAX_BATCH_SIZE) {
      throw new Error(`Batch size too large. Estimated ${Math.round(totalEstimatedSize / 1024 / 1024)}MB exceeds limit of ${FILE_SIZE_LIMITS.MAX_BATCH_SIZE / 1024 / 1024}MB`);
    }

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
    console.error('Word batch processing error:', e);
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
        const path = `${userId}/${instruction.sourceFile}`;
        
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
          allErrors.push(`Missing file: ${instruction.sourceFile}`);
          processed++;
          await supabase.from('processing_jobs').update({ processed }).eq('id', jobId);
          continue;
        }

        // Validate file size
        const fileSize = fileData.size;
        if (!validateFileSize(fileSize, FILE_SIZE_LIMITS.MAX_WORD_SIZE)) {
          allErrors.push(`File ${instruction.sourceFile} is too large (${Math.round(fileSize / 1024 / 1024)}MB)`);
          processed++;
          await supabase.from('processing_jobs').update({ processed }).eq('id', jobId);
          continue;
        }

        // Convert Word to HTML with better error handling
        const buf = await fileData.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        const html = result.value;
        const warnings = result.messages.filter(m => m.type === 'warning');
        
        if (warnings.length > 0) {
          console.warn(`Conversion warnings for ${instruction.sourceFile}:`, warnings);
        }

        // Extract text from HTML with better structure preservation
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

        // Create PDF with proper text wrapping and formatting
        const pdfDoc = await PDFDocument.create();
        
        // Set metadata
        try {
          const outTitle = instruction.outputName.replace(/\.pdf$/i, '');
          pdfDoc.setTitle(outTitle);
          pdfDoc.setAuthor('Document Processor');
          pdfDoc.setCreator('process-word-batch');
          pdfDoc.setProducer('pdf-lib');
          pdfDoc.setCreationDate(new Date());
          pdfDoc.setModificationDate(new Date());
        } catch (metaError) {
          console.warn('Failed to set PDF metadata:', metaError);
        }
        
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontSize = 12;
        const lineHeight = fontSize * 1.3;
        const margin = 50;
        
        let currentPage = pdfDoc.addPage();
        let { width, height } = currentPage.getSize();
        let y = height - margin;
        let maxWidth = width - margin * 2;

        const lines = textContent.split('\n');

        const wrapLineToWidth = (line: string): string[] => {
          const parts: string[] = [];
          let current = '';
          const tokens = line.split(' ');
          for (const token of tokens) {
            const test = current ? `${current} ${token}` : token;
            if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
              current = test;
              continue;
            }
            if (current) parts.push(current);
            // Break overly long token into chunks that fit
            let chunk = '';
            for (const ch of token) {
              const t = chunk + ch;
              if (font.widthOfTextAtSize(t, fontSize) <= maxWidth) {
                chunk = t;
              } else {
                if (chunk) parts.push(chunk);
                chunk = ch;
              }
            }
            current = chunk;
          }
          if (current) parts.push(current);
          return parts.length ? parts : [''];
        };

        for (const line of lines) {
          const wrapped = line.trim() ? wrapLineToWidth(line) : [''];
          for (const part of wrapped) {
            if (!part.trim()) {
              y -= lineHeight;
              if (y < margin) {
                currentPage = pdfDoc.addPage();
                const sz = currentPage.getSize();
                width = sz.width;
                height = sz.height;
                y = height - margin;
                maxWidth = width - margin * 2;
              }
              continue;
            }

            currentPage.drawText(part, {
              x: margin,
              y,
              size: fontSize,
              font,
              color: rgb(0, 0, 0),
            });
            y -= lineHeight;

            if (y < margin) {
              currentPage = pdfDoc.addPage();
              const sz = currentPage.getSize();
              width = sz.width;
              height = sz.height;
              y = height - margin;
              maxWidth = width - margin * 2;
            }
          }
        }

        const pdfBytes = await pdfDoc.save();
        const outName = ensureFileExtension(instruction.outputName, 'pdf');

        zip.file(outName, pdfBytes);
        
      } catch (e) {
        allErrors.push(`Failed (${instruction.outputName}): ${(e as Error).message}`);
      } finally {
        processed++;
        await supabase.from('processing_jobs').update({ processed }).eq('id', jobId);
      }
    }

    // Generate ZIP and upload
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
    console.error('Final error in Word to PDF job:', finalErr);
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

async function handlePdfToWordJob(
  supabase: any,
  userId: string,
  jobId: string,
  instructions: PdfToWordInstruction[],
) {
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
        const path = `${userId}/${instruction.sourceFile}`;
        
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
          allErrors.push(`Missing file: ${instruction.sourceFile}`);
          processed++;
          await supabase.from('processing_jobs').update({ processed }).eq('id', jobId);
          continue;
        }

        // Validate file size
        const fileSize = fileData.size;
        if (!validateFileSize(fileSize, FILE_SIZE_LIMITS.MAX_PDF_SIZE)) {
          allErrors.push(`File ${instruction.sourceFile} is too large (${Math.round(fileSize / 1024 / 1024)}MB)`);
          processed++;
          await supabase.from('processing_jobs').update({ processed }).eq('id', jobId);
          continue;
        }

        // Parse PDF to extract text with better error handling
        const buf = await fileData.arrayBuffer();
        const data = await pdfParse(new Uint8Array(buf));
        const text = data.text || '';
        
        if (!text.trim()) {
          allErrors.push(`No text extracted from ${instruction.sourceFile}`);
          processed++;
          await supabase.from('processing_jobs').update({ processed }).eq('id', jobId);
          continue;
        }

        // Create Word document with extracted text and better formatting
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
                    font: 'Calibri'
                  }),
                ],
                spacing: { after: 200 } // 10pt spacing after paragraph
              })
            );
          } else {
            // Empty paragraph for spacing
            paragraphs.push(new Paragraph({ 
              children: [],
              spacing: { after: 100 }
            }));
          }
        }

        const doc = new Document({
          sections: [
            {
              properties: {
                page: {
                  margin: {
                    top: 720, // 0.5 inch
                    right: 720,
                    bottom: 720,
                    left: 720,
                  },
                },
              },
              children: paragraphs,
            },
          ],
        });

        const blob = await Packer.toBuffer(doc);
        const outName = ensureFileExtension(instruction.outputName, 'docx');

        zip.file(outName, blob);
        
      } catch (e) {
        allErrors.push(`Failed (${instruction.outputName}): ${(e as Error).message}`);
      } finally {
        processed++;
        await supabase.from('processing_jobs').update({ processed }).eq('id', jobId);
      }
    }

    // Generate ZIP and upload
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
    console.error('Final error in PDF to Word job:', finalErr);
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
