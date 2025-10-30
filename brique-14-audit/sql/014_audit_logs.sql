-- Brique 14: Audit logs centralisés
-- Journal d'audit immuable, multi-filiales, prouvable cryptographiquement

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Type ENUM pour actor_type
DO $$ BEGIN
  CREATE TYPE audit_actor_type AS ENUM ('user','employee','service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table parent (partitionnée par mois)
CREATE TABLE molam_audit_logs (
  id              UUID PRIMARY KEY,
  module          TEXT NOT NULL,                        -- 'id','pay','eats','talk','ads','shop','free'
  action          TEXT NOT NULL,                        -- e.g. 'auth.login.success','pay.refund.create'
  resource_type   TEXT,                                 -- e.g. 'user','wallet','kyc_doc','role','txn'
  resource_id     TEXT,                                 -- uuid/ulid/stripe-like id
  actor_type      audit_actor_type NOT NULL,
  actor_id        UUID,                                 -- user or employee id; NULL for 'service'
  actor_org       TEXT,                                 -- optional: bank partner code, merchant id, dept
  result          TEXT NOT NULL CHECK (result IN ('allow','deny','success','failure')),
  reason          TEXT,                                 -- short reason/decision
  ip              INET,
  user_agent      TEXT,
  device_id       TEXT,                                 -- fingerprint or device ref
  geo_country     TEXT,                                 -- ISO-2
  geo_city        TEXT,
  request_id      TEXT,                                 -- trace/correlation id
  session_id      UUID,                                 -- molam_sessions.id
  sira_score      NUMERIC(6,2),                         -- snapshot if relevant
  data_redacted   JSONB,                                -- non sensible, safe to show
  data_ciphertext BYTEA,                                -- encrypted blob (KMS/HSM)
  prev_hash       BYTEA,                                -- chain
  hash            BYTEA,                                -- digest over row + prev_hash
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create current month partition
DO $$
DECLARE
  start_ts TIMESTAMPTZ := date_trunc('month', now());
  end_ts   TIMESTAMPTZ := (date_trunc('month', now()) + INTERVAL '1 month');
  part_name TEXT := 'molam_audit_logs_' || to_char(start_ts,'YYYYMM');
BEGIN
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I PARTITION OF molam_audit_logs
    FOR VALUES FROM (%L) TO (%L)
  $f$, part_name, start_ts, end_ts);
END $$;

-- Indexes for performance
CREATE INDEX idx_audit_module_created ON molam_audit_logs(module, created_at DESC);
CREATE INDEX idx_audit_actor ON molam_audit_logs(actor_type, actor_id, created_at DESC);
CREATE INDEX idx_audit_resource ON molam_audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_result ON molam_audit_logs(result, created_at DESC);
CREATE INDEX idx_audit_request_id ON molam_audit_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_audit_session_id ON molam_audit_logs(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_audit_action ON molam_audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_gin_redacted ON molam_audit_logs USING GIN (data_redacted);

-- Immutability guard: forbid UPDATE/DELETE; only INSERT allowed
REVOKE UPDATE, DELETE ON molam_audit_logs FROM PUBLIC;

-- Trigger to block UPDATE/DELETE
CREATE OR REPLACE FUNCTION f_audit_no_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'molam_audit_logs is append-only - cannot UPDATE or DELETE';
END $$;

DROP TRIGGER IF EXISTS t_audit_no_update ON molam_audit_logs;
CREATE TRIGGER t_audit_no_update BEFORE UPDATE OR DELETE ON molam_audit_logs
  FOR EACH ROW EXECUTE FUNCTION f_audit_no_update();

-- Trigger to compute cryptographic hash (chaining)
CREATE OR REPLACE FUNCTION f_audit_compute_hash()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  payload TEXT;
BEGIN
  -- Build a stable representation (subset fields) to hash:
  payload :=
      coalesce(NEW.id::text,'') || '|' ||
      coalesce(NEW.module,'') || '|' ||
      coalesce(NEW.action,'') || '|' ||
      coalesce(NEW.resource_type,'') || '|' ||
      coalesce(NEW.resource_id,'') || '|' ||
      coalesce(NEW.actor_type::text,'') || '|' ||
      coalesce(NEW.actor_id::text,'') || '|' ||
      coalesce(NEW.result,'') || '|' ||
      coalesce(NEW.reason,'') || '|' ||
      coalesce(NEW.request_id,'') || '|' ||
      coalesce(NEW.session_id::text,'') || '|' ||
      coalesce(NEW.created_at::text,'') || '|' ||
      encode(coalesce(NEW.prev_hash,''::bytea),'hex');

  NEW.hash := digest(payload, 'sha256');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS t_audit_compute_hash ON molam_audit_logs;
CREATE TRIGGER t_audit_compute_hash BEFORE INSERT ON molam_audit_logs
  FOR EACH ROW EXECUTE FUNCTION f_audit_compute_hash();

-- Row-Level Security (RLS)
ALTER TABLE molam_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create roles
DO $$ BEGIN
  CREATE ROLE molam_auditor NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE molam_module_reader NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policy: auditors can read all
CREATE POLICY p_audit_read_all ON molam_audit_logs
  FOR SELECT TO molam_auditor
  USING (true);

-- Policy: module readers limited by current_setting
CREATE POLICY p_audit_read_module ON molam_audit_logs
  FOR SELECT TO molam_module_reader
  USING (module = current_setting('molam.current_module', true));

-- Helper function: verify chain integrity
CREATE OR REPLACE FUNCTION verify_audit_chain(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 day',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  is_valid BOOLEAN,
  broken_at UUID,
  total_checked BIGINT
) AS $$
DECLARE
  prev_hash_val BYTEA := NULL;
  curr_hash_val BYTEA;
  computed_hash BYTEA;
  payload TEXT;
  log_record RECORD;
  total BIGINT := 0;
BEGIN
  FOR log_record IN
    SELECT * FROM molam_audit_logs
    WHERE created_at >= p_start_date AND created_at < p_end_date
    ORDER BY created_at ASC
  LOOP
    total := total + 1;

    -- Compute expected hash
    payload :=
        coalesce(log_record.id::text,'') || '|' ||
        coalesce(log_record.module,'') || '|' ||
        coalesce(log_record.action,'') || '|' ||
        coalesce(log_record.resource_type,'') || '|' ||
        coalesce(log_record.resource_id,'') || '|' ||
        coalesce(log_record.actor_type::text,'') || '|' ||
        coalesce(log_record.actor_id::text,'') || '|' ||
        coalesce(log_record.result,'') || '|' ||
        coalesce(log_record.reason,'') || '|' ||
        coalesce(log_record.request_id,'') || '|' ||
        coalesce(log_record.session_id::text,'') || '|' ||
        coalesce(log_record.created_at::text,'') || '|' ||
        encode(coalesce(prev_hash_val,''::bytea),'hex');

    computed_hash := digest(payload, 'sha256');

    -- Check if computed matches stored
    IF computed_hash != log_record.hash THEN
      RETURN QUERY SELECT false, log_record.id, total;
      RETURN;
    END IF;

    -- Check if prev_hash matches
    IF prev_hash_val IS DISTINCT FROM log_record.prev_hash THEN
      RETURN QUERY SELECT false, log_record.id, total;
      RETURN;
    END IF;

    prev_hash_val := log_record.hash;
  END LOOP;

  RETURN QUERY SELECT true, NULL::UUID, total;
END;
$$ LANGUAGE plpgsql;

-- Function to create next month partition (call from cron)
CREATE OR REPLACE FUNCTION create_next_month_audit_partition()
RETURNS TEXT AS $$
DECLARE
  start_ts TIMESTAMPTZ := date_trunc('month', now() + INTERVAL '1 month');
  end_ts   TIMESTAMPTZ := (date_trunc('month', now() + INTERVAL '1 month') + INTERVAL '1 month');
  part_name TEXT := 'molam_audit_logs_' || to_char(start_ts,'YYYYMM');
BEGIN
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I PARTITION OF molam_audit_logs
    FOR VALUES FROM (%L) TO (%L)
  $f$, part_name, start_ts, end_ts);

  RETURN part_name;
END;
$$ LANGUAGE plpgsql;

-- Commentaires
COMMENT ON TABLE molam_audit_logs IS 'Journal d''audit centralisé immuable pour tout l''écosystème Molam';
COMMENT ON FUNCTION f_audit_no_update() IS 'Bloque UPDATE/DELETE pour immutabilité';
COMMENT ON FUNCTION f_audit_compute_hash() IS 'Calcule le hash cryptographique avec chaînage';
COMMENT ON FUNCTION verify_audit_chain(TIMESTAMPTZ, TIMESTAMPTZ) IS 'Vérifie l''intégrité de la chaîne cryptographique';
COMMENT ON FUNCTION create_next_month_audit_partition() IS 'Crée la partition du mois prochain (appeler via cron)';
