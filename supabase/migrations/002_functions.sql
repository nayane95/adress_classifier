-- Database helper functions for analytics and caching

-- Function to update job statistics (triggered on job_rows changes)
CREATE OR REPLACE FUNCTION update_job_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE jobs
  SET
    processed_rows = (
      SELECT COUNT(*) FROM job_rows
      WHERE job_id = NEW.job_id AND row_status = 'COMPLETED'
    ),
    ai_rows = (
      SELECT COUNT(*) FROM job_rows
      WHERE job_id = NEW.job_id AND ai_used = TRUE
    ),
    ai_usage_percent = (
      SELECT CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND((COUNT(*) FILTER (WHERE ai_used = TRUE)::NUMERIC / COUNT(*) * 100), 2)
      END
      FROM job_rows
      WHERE job_id = NEW.job_id
    ),
    avg_confidence = (
      SELECT COALESCE(ROUND(AVG(confidence), 2), 0)
      FROM job_rows
      WHERE job_id = NEW.job_id AND confidence IS NOT NULL
    ),
    needs_review_count = (
      SELECT COUNT(*) FROM job_rows
      WHERE job_id = NEW.job_id AND needs_review = TRUE
    )
  WHERE id = NEW.job_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_job_stats
  AFTER INSERT OR UPDATE ON job_rows
  FOR EACH ROW
  EXECUTE FUNCTION update_job_stats();

-- Function to get job analytics
CREATE OR REPLACE FUNCTION get_job_analytics(p_job_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_rows', COUNT(*),
    'by_category', (
      SELECT json_object_agg(final_category, count)
      FROM (
        SELECT final_category, COUNT(*) as count
        FROM job_rows
        WHERE job_id = p_job_id AND final_category IS NOT NULL
        GROUP BY final_category
      ) cat_counts
    ),
    'by_country', (
      SELECT json_object_agg(country, count)
      FROM (
        SELECT normalized_json->>'Pays' as country, COUNT(*) as count
        FROM job_rows
        WHERE job_id = p_job_id
        GROUP BY normalized_json->>'Pays'
        ORDER BY count DESC
        LIMIT 10
      ) country_counts
    ),
    'by_city', (
      SELECT json_object_agg(city, count)
      FROM (
        SELECT normalized_json->>'Ville' as city, COUNT(*) as count
        FROM job_rows
        WHERE job_id = p_job_id
        GROUP BY normalized_json->>'Ville'
        ORDER BY count DESC
        LIMIT 10
      ) city_counts
    ),
    'confidence_distribution', (
      SELECT json_object_agg(bucket, count)
      FROM (
        SELECT
          CASE
            WHEN confidence >= 90 THEN '90-100'
            WHEN confidence >= 80 THEN '80-89'
            WHEN confidence >= 70 THEN '70-79'
            WHEN confidence >= 60 THEN '60-69'
            ELSE '0-59'
          END as bucket,
          COUNT(*) as count
        FROM job_rows
        WHERE job_id = p_job_id AND confidence IS NOT NULL
        GROUP BY bucket
      ) conf_dist
    ),
    'classification_methods', (
      SELECT json_object_agg(classification_method, count)
      FROM (
        SELECT classification_method, COUNT(*) as count
        FROM job_rows
        WHERE job_id = p_job_id AND classification_method IS NOT NULL
        GROUP BY classification_method
      ) method_counts
    )
  ) INTO result
  FROM job_rows
  WHERE job_id = p_job_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get enrichment cache
CREATE OR REPLACE FUNCTION get_enrichment_cache(p_cache_key TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT enrichment_data INTO result
  FROM enrichment_cache
  WHERE cache_key = p_cache_key
    AND expires_at > NOW();
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get AI cache
CREATE OR REPLACE FUNCTION get_ai_cache(p_input_hash TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT response_data INTO result
  FROM ai_cache
  WHERE input_hash = p_input_hash
    AND expires_at > NOW();
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM enrichment_cache WHERE expires_at < NOW();
  DELETE FROM ai_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean cache (requires pg_cron extension)
-- Uncomment if pg_cron is available
-- SELECT cron.schedule('clean-cache', '0 2 * * *', 'SELECT clean_expired_cache()');
