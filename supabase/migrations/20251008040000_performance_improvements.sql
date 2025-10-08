-- Add indexes for better performance when handling large batches

-- Index on processing_jobs for faster status queries
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_status 
ON public.processing_jobs(user_id, status);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at 
ON public.processing_jobs(created_at DESC);

-- Index on user_credits for faster credit checks
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id 
ON public.user_credits(user_id);

-- Add job cleanup function to remove old completed/failed jobs
CREATE OR REPLACE FUNCTION public.cleanup_old_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete jobs older than 7 days
  DELETE FROM public.processing_jobs
  WHERE created_at < NOW() - INTERVAL '7 days'
  AND status IN ('completed', 'failed');
END;
$$;

-- Add a function to check and cleanup stuck jobs
CREATE OR REPLACE FUNCTION public.cleanup_stuck_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark jobs as failed if they've been processing for more than 1 hour
  UPDATE public.processing_jobs
  SET status = 'failed',
      errors = ARRAY['Job timeout - processing took too long'],
      updated_at = NOW()
  WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Add columns for better tracking
ALTER TABLE public.processing_jobs
ADD COLUMN IF NOT EXISTS file_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_size_bytes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Create a scheduled job to run cleanup (requires pg_cron extension)
-- Note: This needs to be enabled in Supabase dashboard
-- SELECT cron.schedule('cleanup-old-jobs', '0 2 * * *', 'SELECT public.cleanup_old_jobs();');
-- SELECT cron.schedule('cleanup-stuck-jobs', '*/30 * * * *', 'SELECT public.cleanup_stuck_jobs();');