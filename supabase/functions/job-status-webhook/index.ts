// Job status webhook for real-time monitoring
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: any;
  old_record?: any;
  schema: string;
}

interface JobStatusWebhook {
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Verify webhook signature
    const signature = req.headers.get('X-Supabase-Signature');
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
    
    if (webhookSecret && signature) {
      const payload = await req.text();
      const expectedSignature = await generateSignature(payload, webhookSecret);
      
      if (signature !== expectedSignature) {
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      
      req = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: payload,
      });
    }

    const webhookPayload: WebhookPayload = await req.json();
    
    // Only process processing_jobs table events
    if (webhookPayload.table !== 'processing_jobs') {
      return new Response(JSON.stringify({ message: 'Ignored' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const job = webhookPayload.record;
    const oldJob = webhookPayload.old_record;
    
    // Determine event type
    let eventType = 'job.unknown';
    
    if (webhookPayload.type === 'INSERT') {
      eventType = 'job.created';
    } else if (webhookPayload.type === 'UPDATE') {
      if (oldJob?.status !== job.status) {
        eventType = `job.${job.status}`;
      } else if (job.processed > (oldJob?.processed || 0)) {
        eventType = 'job.progress';
      }
    } else if (webhookPayload.type === 'DELETE') {
      eventType = 'job.deleted';
    }

    // Get user's webhook configurations
    const { data: webhooks, error: webhookError } = await supabase
      .from('user_webhooks')
      .select('*')
      .eq('user_id', job.user_id)
      .eq('active', true);

    if (webhookError || !webhooks || webhooks.length === 0) {
      return new Response(JSON.stringify({ message: 'No webhooks configured' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Send webhook notifications
    const notifications = webhooks
      .filter(webhook => webhook.events.includes(eventType) || webhook.events.includes('*'))
      .map(webhook => sendWebhookNotification(webhook, eventType, job));

    const results = await Promise.allSettled(notifications);
    
    // Log webhook delivery status
    const deliveryLogs = results.map((result, index) => ({
      webhook_id: webhooks[index].id,
      job_id: job.id,
      event_type: eventType,
      status: result.status === 'fulfilled' ? 'success' : 'failed',
      error: result.status === 'rejected' ? result.reason?.message : null,
      delivered_at: new Date().toISOString(),
    }));

    await supabase
      .from('webhook_delivery_logs')
      .insert(deliveryLogs);

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    return new Response(JSON.stringify({ 
      message: 'Webhooks processed',
      delivered: successCount,
      failed: results.length - successCount,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error('Webhook error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});

async function sendWebhookNotification(
  webhook: JobStatusWebhook,
  eventType: string,
  job: any
): Promise<void> {
  const payload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data: {
      job_id: job.id,
      user_id: job.user_id,
      operation: job.operation,
      status: job.status,
      progress: {
        processed: job.processed,
        total: job.total,
        percentage: job.total > 0 ? (job.processed / job.total) * 100 : 0,
      },
      errors: job.errors,
      result_path: job.result_path,
      started_at: job.started_at,
      completed_at: job.completed_at,
      file_count: job.file_count,
      total_size_bytes: job.total_size_bytes,
    },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': eventType,
    'X-Webhook-Timestamp': payload.timestamp,
  };

  // Add signature if secret is configured
  if (webhook.secret) {
    const signature = await generateSignature(JSON.stringify(payload), webhook.secret);
    headers['X-Webhook-Signature'] = signature;
  }

  const response = await fetch(webhook.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
  }
}

async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const key = encoder.encode(secret);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}