-- Contact Classification System - Initial Schema
-- This migration creates the core tables for the contact classification system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Jobs table: tracks CSV upload jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARSING', 'RULES', 'ENRICHING', 'AI_CLASSIFYING', 'COMPLETED', 'FAILED')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  ai_rows INTEGER NOT NULL DEFAULT 0,
  ai_usage_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
  needs_review_count INTEGER NOT NULL DEFAULT 0,
  search_calls_count INTEGER NOT NULL DEFAULT 0,
  ai_tokens_estimate INTEGER NOT NULL DEFAULT 0,
  ai_cost_estimate NUMERIC(10,4),
  current_step TEXT,
  current_batch_index INTEGER,
  error_message TEXT,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fr'))
);

-- Job rows table: stores individual contact rows with classification results
CREATE TABLE job_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  raw_json JSONB NOT NULL,
  normalized_json JSONB NOT NULL,
  final_category TEXT CHECK (final_category IN ('CLIENT', 'PRESCRIBER', 'SUPPLIER', 'A_QUALIFIER')),
  confidence NUMERIC(5,2),
  reason_en TEXT,
  reason_fr TEXT,
  public_signals_en TEXT,
  public_signals_fr TEXT,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  classification_method TEXT CHECK (classification_method IN ('RULES', 'AI', 'HYBRID')),
  ai_used BOOLEAN NOT NULL DEFAULT FALSE,
  model_used TEXT,
  ai_attempts INTEGER NOT NULL DEFAULT 0,
  enrichment_status TEXT CHECK (enrichment_status IN ('SEARCHING', 'CLASSIFYING', 'DONE', 'FAILED')),
  enrichment_attempts INTEGER NOT NULL DEFAULT 0,
  enrichment_json JSONB,
  manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  last_processing_step TEXT CHECK (last_processing_step IN ('PARSE', 'RULES', 'ENRICH', 'AI', 'EXPORT')),
  row_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (row_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  edited_by TEXT,
  edited_at TIMESTAMPTZ,
  previous_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, row_index)
);

-- Enrichment cache table: caches web enrichment results
CREATE TABLE enrichment_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key TEXT NOT NULL UNIQUE,
  enrichment_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- AI cache table: caches AI classification responses
CREATE TABLE ai_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  input_hash TEXT NOT NULL UNIQUE,
  response_data JSONB NOT NULL,
  model_used TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Activity feed table: stores real-time activity messages
CREATE TABLE activity_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'INFO' CHECK (message_type IN ('INFO', 'SUCCESS', 'WARNING', 'ERROR')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);

CREATE INDEX idx_job_rows_job_id ON job_rows(job_id);
CREATE INDEX idx_job_rows_row_status ON job_rows(row_status);
CREATE INDEX idx_job_rows_final_category ON job_rows(final_category);
CREATE INDEX idx_job_rows_needs_review ON job_rows(needs_review) WHERE needs_review = TRUE;
CREATE INDEX idx_job_rows_ai_used ON job_rows(ai_used);

CREATE INDEX idx_enrichment_cache_key ON enrichment_cache(cache_key);
CREATE INDEX idx_enrichment_cache_expires ON enrichment_cache(expires_at);

CREATE INDEX idx_ai_cache_hash ON ai_cache(input_hash);
CREATE INDEX idx_ai_cache_expires ON ai_cache(expires_at);

CREATE INDEX idx_activity_feed_job_id ON activity_feed(job_id);
CREATE INDEX idx_activity_feed_created_at ON activity_feed(created_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_rows_updated_at BEFORE UPDATE ON job_rows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for authenticated users - customize based on your auth strategy)
CREATE POLICY "Allow all for authenticated users" ON jobs
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON job_rows
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON enrichment_cache
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON ai_cache
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON activity_feed
  FOR ALL USING (true);

-- Enable Realtime for jobs and activity_feed
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_feed;
