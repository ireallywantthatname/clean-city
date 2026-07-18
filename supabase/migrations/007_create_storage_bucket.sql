INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-photos',
  'report-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "report_photos_public_read" ON storage.objects;
CREATE POLICY "report_photos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'report-photos');

DROP POLICY IF EXISTS "report_photos_insert" ON storage.objects;
CREATE POLICY "report_photos_insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'report-photos');

DROP POLICY IF EXISTS "report_photos_update" ON storage.objects;
CREATE POLICY "report_photos_update"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'report-photos')
  WITH CHECK (bucket_id = 'report-photos');

DROP POLICY IF EXISTS "report_photos_delete_auth" ON storage.objects;
CREATE POLICY "report_photos_delete_auth"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'report-photos');
