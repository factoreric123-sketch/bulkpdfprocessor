-- Create rate limit logs table for distributed rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_rate_limit_logs_lookup 
ON public.rate_limit_logs(user_id, key, created_at DESC);

-- Enable RLS
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own rate limit logs
CREATE POLICY "Users can view own rate limits"
  ON public.rate_limit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Only allow inserts for authenticated users
CREATE POLICY "Authenticated users can log requests"
  ON public.rate_limit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to clean up old rate limit logs
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete logs older than 2 hours (no need to keep them longer)
  DELETE FROM public.rate_limit_logs
  WHERE created_at < NOW() - INTERVAL '2 hours';
END;
$$;

-- Schedule cleanup to run every hour
SELECT cron.schedule(
  'cleanup-rate-limit-logs',
  '0 * * * *',
  $$SELECT public.cleanup_rate_limit_logs();$$
);

-- Add rate limit headers to Edge Function responses
CREATE OR REPLACE FUNCTION public.get_rate_limit_info(
  p_user_id UUID,
  p_key TEXT,
  p_max_requests INT,
  p_window_minutes INT
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INT,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  
  SELECT COUNT(*)
  INTO v_count
  FROM public.rate_limit_logs
  WHERE user_id = p_user_id
  AND key = p_key
  AND created_at >= v_window_start;
  
  RETURN QUERY
  SELECT 
    v_count < p_max_requests AS allowed,
    GREATEST(0, p_max_requests - v_count) AS remaining,
    v_window_start + (p_window_minutes || ' minutes')::INTERVAL AS reset_at;
END;
$$;