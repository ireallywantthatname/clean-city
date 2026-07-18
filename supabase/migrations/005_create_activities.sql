CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  type public.activity_type NOT NULL,
  message text NOT NULL DEFAULT '',
  created_by text,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activities_report_id_idx ON public.activities (report_id);
CREATE INDEX IF NOT EXISTS activities_created_at_idx ON public.activities (created_at DESC);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activities_select_all"
  ON public.activities FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "activities_insert_all"
  ON public.activities FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
