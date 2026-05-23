-- Enable automatic cleanup cron jobs
-- Note: pg_cron extension must be enabled in Supabase dashboard first

-- Schedule cleanup of old completed/failed jobs (runs daily at 2 AM)
SELECT cron.schedule(
  'cleanup-old-jobs',
  '0 2 * * *',
  $$SELECT public.cleanup_old_jobs();$$
);

-- Schedule cleanup of stuck jobs (runs every 30 minutes)
SELECT cron.schedule(
  'cleanup-stuck-jobs',
  '*/30 * * * *',
  $$SELECT public.cleanup_stuck_jobs();$$
);

-- Schedule cleanup of old metrics (runs weekly on Sunday at 3 AM)
SELECT cron.schedule(
  'cleanup-old-metrics',
  '0 3 * * 0',
  $$SELECT public.cleanup_old_metrics();$$
);

-- Add function to cleanup orphaned storage files
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_files()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orphan_record RECORD;
BEGIN
  -- Find completed jobs older than 7 days with result paths
  FOR orphan_record IN 
    SELECT result_path, user_id
    FROM public.processing_jobs
    WHERE status IN ('completed', 'failed')
    AND created_at < NOW() - INTERVAL '7 days'
    AND result_path IS NOT NULL
  LOOP
    -- Attempt to delete the file from storage
    -- Note: This is a placeholder - actual storage cleanup requires Edge Function
    RAISE NOTICE 'Would cleanup file: %', orphan_record.result_path;
  END LOOP;
  
  -- Clean up old error logs
  DELETE FROM public.error_logs
  WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$;

-- Schedule orphaned file cleanup (runs daily at 4 AM)
SELECT cron.schedule(
  'cleanup-orphaned-files',
  '0 4 * * *',
  $$SELECT public.cleanup_orphaned_files();$$
);

-- Create view to monitor cron job status
CREATE OR REPLACE VIEW public.cron_job_status AS
SELECT 
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobid
FROM cron.job
ORDER BY jobname;

-- Grant access to authenticated users to view cron status
GRANT SELECT ON public.cron_job_status TO authenticated;