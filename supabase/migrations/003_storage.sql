-- Storage buckets for CSV files

-- Create buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('csv-uploads', 'csv-uploads', false),
  ('csv-exports', 'csv-exports', false);

-- Storage policies for csv-uploads bucket
CREATE POLICY "Public can upload CSV files"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'csv-uploads');

CREATE POLICY "Public can read CSV files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'csv-uploads');

CREATE POLICY "Public can delete CSV files"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'csv-uploads');

-- Storage policies for csv-exports bucket
CREATE POLICY "Authenticated users can create exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'csv-exports');

CREATE POLICY "Users can read their own exports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'csv-exports');

CREATE POLICY "Users can delete their own exports"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'csv-exports');
