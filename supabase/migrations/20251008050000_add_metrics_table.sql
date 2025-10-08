-- Create simple metrics table for FREE monitoring
CREATE TABLE IF NOT EXISTS public.app_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL,
  duration NUMERIC NOT NULL,
  file_count INTEGER NOT NULL,
  total_size BIGINT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  memory_used BIGINT,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying metrics
CREATE INDEX idx_app_metrics_timestamp ON public.app_metrics(timestamp DESC);
CREATE INDEX idx_app_metrics_operation ON public.app_metrics(operation, timestamp DESC);

-- RLS policies
ALTER TABLE public.app_metrics ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their metrics
CREATE POLICY "Users can insert metrics"
  ON public.app_metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow viewing aggregate metrics (not user-specific for privacy)
CREATE POLICY "Users can view recent aggregate metrics"
  ON public.app_metrics FOR SELECT
  TO authenticated
  USING (timestamp > NOW() - INTERVAL '24 hours');

-- Create view for dashboard
CREATE OR REPLACE VIEW public.metrics_summary AS
SELECT 
  operation,
  COUNT(*) as total_operations,
  COUNT(*) FILTER (WHERE success = true) as successful_operations,
  AVG(duration)::NUMERIC(10,2) as avg_duration_ms,
  MAX(duration)::NUMERIC(10,2) as max_duration_ms,
  MIN(duration)::NUMERIC(10,2) as min_duration_ms,
  SUM(file_count) as total_files_processed,
  SUM(total_size) as total_bytes_processed,
  (COUNT(*) FILTER (WHERE success = false)::FLOAT / COUNT(*)::FLOAT * 100)::NUMERIC(5,2) as error_rate,
  DATE_TRUNC('hour', timestamp) as hour
FROM public.app_metrics
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY operation, DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC, operation;

-- Cleanup old metrics (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_old_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.app_metrics
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Create error tracking table
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  stack TEXT,
  component_stack TEXT,
  url TEXT NOT NULL,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for error queries
CREATE INDEX idx_error_logs_timestamp ON public.error_logs(timestamp DESC);
CREATE INDEX idx_error_logs_message ON public.error_logs(message);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert errors
CREATE POLICY "Users can insert error logs"
  ON public.error_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- View for error summary
CREATE OR REPLACE VIEW public.error_summary AS
SELECT 
  message,
  COUNT(*) as count,
  MAX(timestamp) as last_seen,
  MIN(timestamp) as first_seen
FROM public.error_logs
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY message
ORDER BY count DESC;