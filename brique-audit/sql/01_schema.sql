-- 01_schema.sql
-- Postgres schema for append-only audit events and batches
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,
  actor_id UUID,
  actor_role TEXT,
  module TEXT NOT NULL,
  payload JSONB NOT NULL,
  prev_hash TEXT,
  record_hash TEXT NOT NULL,
  signer_key_id TEXT,
  signature TEXT,
  uploaded BOOLEAN DEFAULT FALSE,
  s3_object_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_event_time ON audit_events(event_time);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_id ON audit_events(actor_id);

CREATE TABLE IF NOT EXISTS audit_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  start_event_id UUID,
  end_event_id UUID,
  merkle_root TEXT NOT NULL,
  record_count INT NOT NULL,
  s3_key TEXT NOT NULL,
  s3_etag TEXT,
  signer_key_id TEXT,
  signer_signature TEXT,
  uploaded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audit_batches_batch_time ON audit_batches(batch_time);
