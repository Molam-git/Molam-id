-- 02_functions.sql
-- helper functions: get_last_record_hash, mark_uploaded
CREATE OR REPLACE FUNCTION audit_get_last_record_hash()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  h TEXT;
BEGIN
  SELECT record_hash INTO h FROM audit_events ORDER BY created_at DESC LIMIT 1;
  RETURN h;
END;
$$;

CREATE OR REPLACE FUNCTION audit_mark_uploaded(ids UUID[], s3_key TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE audit_events SET uploaded = true, s3_object_key = s3_key WHERE id = ANY(ids);
END;
$$;
