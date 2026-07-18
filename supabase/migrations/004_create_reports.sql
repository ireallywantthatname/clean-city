CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.report_type NOT NULL,
  status public.report_status NOT NULL DEFAULT 'NEW',
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  location geography(Point, 4326),
  notes text,
  before_photo_url text NOT NULL DEFAULT '',
  before_photo_path text,
  after_photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  assigned_at timestamptz,
  assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to_name text,
  triaged_at timestamptz,
  triaged_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  completion_notes text,
  priority public.priority_level,
  sla_due_at timestamptz,
  merged_into_report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  privacy_note text,
  geohash text,
  ai jsonb DEFAULT '{"status":"PENDING"}'::jsonb
);

CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status);
CREATE INDEX IF NOT EXISTS reports_type_idx ON public.reports (type);
CREATE INDEX IF NOT EXISTS reports_priority_idx ON public.reports (priority);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON public.reports (created_at DESC);
CREATE INDEX IF NOT EXISTS reports_assigned_to_idx ON public.reports (assigned_to_user_id);
CREATE INDEX IF NOT EXISTS reports_geohash_idx ON public.reports (geohash);
CREATE INDEX IF NOT EXISTS reports_location_gix ON public.reports USING gist (location);

CREATE OR REPLACE FUNCTION public.reports_set_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_set_location ON public.reports;
CREATE TRIGGER reports_set_location
  BEFORE INSERT OR UPDATE OF lat, lng ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_set_location();

DROP TRIGGER IF EXISTS reports_set_updated_at ON public.reports;
CREATE TRIGGER reports_set_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_insert_anon"
  ON public.reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "reports_select_all"
  ON public.reports FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "reports_update_all"
  ON public.reports FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "reports_delete_ops"
  ON public.reports FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ops'
    )
  );
