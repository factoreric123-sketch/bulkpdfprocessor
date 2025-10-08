-- Create processing_jobs table for long-running PDF tasks
CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  operation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | processing | completed | failed
  total INTEGER NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  result_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.processing_jobs;
CREATE POLICY "Users can view their own jobs"
  ON public.processing_jobs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own jobs" ON public.processing_jobs;
CREATE POLICY "Users can insert their own jobs"
  ON public.processing_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own jobs" ON public.processing_jobs;
CREATE POLICY "Users can update their own jobs"
  ON public.processing_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- updated_at trigger (function already exists in project)
DROP TRIGGER IF EXISTS set_timestamp_processing_jobs ON public.processing_jobs;
CREATE TRIGGER set_timestamp_processing_jobs
BEFORE UPDATE ON public.processing_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage buckets for uploads and results
INSERT INTO storage.buckets (id, name, public) VALUES ('pdf-uploads', 'pdf-uploads', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('pdf-results', 'pdf-results', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for user-level isolation
-- pdf-uploads
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own pdf uploads'
  ) THEN
    CREATE POLICY "Users can upload their own pdf uploads"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'pdf-uploads' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own pdf uploads'
  ) THEN
    CREATE POLICY "Users can update their own pdf uploads"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'pdf-uploads' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can view their own pdf uploads'
  ) THEN
    CREATE POLICY "Users can view their own pdf uploads"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'pdf-uploads' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own pdf uploads'
  ) THEN
    CREATE POLICY "Users can delete their own pdf uploads"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'pdf-uploads' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- pdf-results (read access for owners)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can view their own pdf results'
  ) THEN
    CREATE POLICY "Users can view their own pdf results"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'pdf-results' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;