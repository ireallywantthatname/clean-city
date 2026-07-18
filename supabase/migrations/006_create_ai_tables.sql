CREATE TABLE IF NOT EXISTS public.ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  duration_ms integer NOT NULL,
  status text NOT NULL,
  error text,
  provider text NOT NULL DEFAULT 'gemini',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_runs_report_id_idx ON public.ai_runs (report_id);
CREATE INDEX IF NOT EXISTS ai_runs_created_at_idx ON public.ai_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_image_cache (
  image_hash text PRIMARY KEY,
  label text,
  confidence double precision,
  reason text,
  garbage_types text[],
  needs_human_review boolean,
  model text,
  prompt_version text,
  provider text DEFAULT 'gemini',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_weekly_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  summary text NOT NULL,
  top_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_areas text[] NOT NULL DEFAULT '{}',
  recommendations text[] NOT NULL DEFAULT '{}',
  total_reports integer NOT NULL DEFAULT 0,
  model text NOT NULL,
  generated_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_image_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_weekly_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_runs_select_auth" ON public.ai_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_runs_insert_all" ON public.ai_runs FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "ai_image_cache_select_auth" ON public.ai_image_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_image_cache_insert_all" ON public.ai_image_cache FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "ai_image_cache_update_all" ON public.ai_image_cache FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "ai_weekly_insights_select_all" ON public.ai_weekly_insights FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ai_weekly_insights_insert_all" ON public.ai_weekly_insights FOR INSERT TO anon, authenticated WITH CHECK (true);
