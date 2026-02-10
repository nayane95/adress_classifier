-- Fix RLS policies to allow anonymous/public access for development
-- This allows the application to work without a user login flow

-- 1. Storage Policies (Fixes the 403 error on upload)
DROP POLICY IF EXISTS "Authenticated users can upload CSV files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;

CREATE POLICY "Public can upload CSV files"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'csv-uploads');

CREATE POLICY "Public can read CSV files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'csv-uploads');

-- 2. Database Table Policies (Fixes Realtime updates and reading jobs)

-- Jobs
DROP POLICY IF EXISTS "Allow all for authenticated users" ON jobs;
CREATE POLICY "Allow all public access" ON jobs
  FOR ALL USING (true);

-- Job Rows
DROP POLICY IF EXISTS "Allow all for authenticated users" ON job_rows;
CREATE POLICY "Allow all public access" ON job_rows
  FOR ALL USING (true);

-- Activity Feed
DROP POLICY IF EXISTS "Allow all for authenticated users" ON activity_feed;
CREATE POLICY "Allow all public access" ON activity_feed
  FOR ALL USING (true);

-- Enrichment Cache
DROP POLICY IF EXISTS "Allow all for authenticated users" ON enrichment_cache;
CREATE POLICY "Allow all public access" ON enrichment_cache
  FOR ALL USING (true);

-- AI Cache
DROP POLICY IF EXISTS "Allow all for authenticated users" ON ai_cache;
CREATE POLICY "Allow all public access" ON ai_cache
  FOR ALL USING (true);
