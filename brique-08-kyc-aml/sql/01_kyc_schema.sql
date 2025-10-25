-- 01_kyc_schema.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- KYC request per user
CREATE TABLE IF NOT EXISTS molam_kyc_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES molam_users(id),
  requested_level TEXT NOT NULL DEFAULT 'P1', -- 'P1' or 'P2'
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, verified, rejected, needs_review
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_requests_user_id ON molam_kyc_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_requests_status ON molam_kyc_requests(status);

-- Documents uploaded for KYC
CREATE TABLE IF NOT EXISTS molam_kyc_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_request_id UUID REFERENCES molam_kyc_requests(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL, -- 'id_front','id_back','selfie','proof_address'
  s3_key TEXT NOT NULL,
  s3_etag TEXT,
  content_hash TEXT, -- sha256 base64
  uploaded_by UUID, -- user or agent id
  status TEXT DEFAULT 'uploaded', -- uploaded, processed, failed
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_docs_request_id ON molam_kyc_docs(kyc_request_id);
CREATE INDEX IF NOT EXISTS idx_kyc_docs_doc_type ON molam_kyc_docs(doc_type);

-- verification results (ocr, liveness, face match, sanctions)
CREATE TABLE IF NOT EXISTS molam_kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_request_id UUID REFERENCES molam_kyc_requests(id) ON DELETE CASCADE,
  ocr_data JSONB, -- extracted fields
  ocr_confidence NUMERIC(5,2),
  face_match_score NUMERIC(5,2),
  liveness_result TEXT, -- 'pass','fail','uncertain'
  sanctions_results JSONB, -- matches found
  risk_score NUMERIC(5,2) DEFAULT 50.0,
  final_decision TEXT, -- 'auto_verified','manual_review','rejected'
  processed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_verifications_request_id ON molam_kyc_verifications(kyc_request_id);

-- audit for kyc actions (append-only)
CREATE TABLE IF NOT EXISTS molam_kyc_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_request_id UUID,
  actor_id UUID, -- who triggered
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_audit_request_id ON molam_kyc_audit(kyc_request_id);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_created_at ON molam_kyc_audit(created_at);

-- KYC -> transaction limits mapping
CREATE TABLE IF NOT EXISTS molam_limits (
  id SERIAL PRIMARY KEY,
  kyc_level TEXT UNIQUE,
  daily_limit NUMERIC(20,2),
  per_tx_limit NUMERIC(20,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- sample defaults
INSERT INTO molam_limits (kyc_level,daily_limit,per_tx_limit)
VALUES ('P0', 10000.00, 5000.00)
ON CONFLICT (kyc_level) DO NOTHING;

INSERT INTO molam_limits (kyc_level,daily_limit,per_tx_limit)
VALUES ('P1', 100000.00, 50000.00)
ON CONFLICT (kyc_level) DO NOTHING;

INSERT INTO molam_limits (kyc_level,daily_limit,per_tx_limit)
VALUES ('P2', 10000000.00, 2000000.00)
ON CONFLICT (kyc_level) DO NOTHING;
