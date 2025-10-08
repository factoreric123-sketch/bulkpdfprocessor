-- Create user webhooks table
CREATE TABLE IF NOT EXISTS public.user_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['job.completed', 'job.failed'],
  active BOOLEAN NOT NULL DEFAULT true,
  secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX idx_user_webhooks_user_id ON public.user_webhooks(user_id);
CREATE INDEX idx_user_webhooks_active ON public.user_webhooks(active);

-- Enable RLS
ALTER TABLE public.user_webhooks ENABLE ROW LEVEL SECURITY;

-- Users can manage their own webhooks
CREATE POLICY "Users can view own webhooks"
  ON public.user_webhooks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own webhooks"
  ON public.user_webhooks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own webhooks"
  ON public.user_webhooks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own webhooks"
  ON public.user_webhooks FOR DELETE
  USING (auth.uid() = user_id);

-- Webhook delivery logs
CREATE TABLE IF NOT EXISTS public.webhook_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.user_webhooks(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.processing_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL, -- success, failed
  error TEXT,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying delivery history
CREATE INDEX idx_webhook_delivery_logs_webhook_id ON public.webhook_delivery_logs(webhook_id);
CREATE INDEX idx_webhook_delivery_logs_job_id ON public.webhook_delivery_logs(job_id);
CREATE INDEX idx_webhook_delivery_logs_delivered_at ON public.webhook_delivery_logs(delivered_at DESC);

-- Enable RLS
ALTER TABLE public.webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Users can view delivery logs for their webhooks
CREATE POLICY "Users can view own webhook delivery logs"
  ON public.webhook_delivery_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_webhooks
      WHERE user_webhooks.id = webhook_delivery_logs.webhook_id
      AND user_webhooks.user_id = auth.uid()
    )
  );

-- Create trigger to send webhooks on job status changes
CREATE OR REPLACE FUNCTION public.notify_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notify webhook function via pg_notify
  PERFORM pg_notify('job_status_change', json_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    'schema', TG_TABLE_SCHEMA
  )::text);
  
  RETURN NEW;
END;
$$;

-- Create trigger on processing_jobs
CREATE TRIGGER on_processing_job_change
  AFTER INSERT OR UPDATE OR DELETE ON public.processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_job_status_change();

-- Cleanup old webhook delivery logs
CREATE OR REPLACE FUNCTION public.cleanup_webhook_delivery_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete logs older than 30 days
  DELETE FROM public.webhook_delivery_logs
  WHERE delivered_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Schedule cleanup
SELECT cron.schedule(
  'cleanup-webhook-delivery-logs',
  '0 3 * * *',
  $$SELECT public.cleanup_webhook_delivery_logs();$$
);

-- Add sample webhook events documentation
COMMENT ON TABLE public.user_webhooks IS 'User-configured webhooks for job status notifications. Supported events: job.created, job.queued, job.processing, job.completed, job.failed, job.progress, job.deleted, * (all events)';