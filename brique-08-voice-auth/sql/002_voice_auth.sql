-- Brique 8 — Voice Auth (signature vocale, step-up vocal, accessibilité)
-- Zero audio storage: only derived embeddings (hashed + salted)
-- Multi-platform: Web, iOS, Android, IVR
-- Multi-language: Wolof, French, English, Arabic, etc.

-- Voice credentials: stores normalized embeddings (encrypted + salted)
CREATE TABLE IF NOT EXISTS molam_voice_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  channel TEXT CHECK (channel IN ('mobile_app','web','ivr')),
  phrase_hint TEXT,                      -- enrollment phrase text (local language)
  locale TEXT,                           -- fr_SN, en_GH, wo_SN, ar_MA, etc.
  embedding_algo TEXT,                   -- 'ecapa-tdnn@v1', 'xvector@v2', etc.
  embedding_norm BYTEA NOT NULL,         -- normalized vector encrypted (KMS envelope)
  embedding_hash BYTEA NOT NULL,         -- HMAC(K_salt, embedding_norm) for lookup
  salt BYTEA NOT NULL,                   -- random salt (encrypted at rest)
  quality_score NUMERIC(5,2),            -- SNR/quality score (0-100)
  spoofing_score NUMERIC(5,2),           -- anti-spoof score (0-100, lower = better)
  sign_count BIGINT DEFAULT 0,           -- number of successful verifications
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_voice_user ON molam_voice_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_hash ON molam_voice_credentials(embedding_hash);

COMMENT ON TABLE molam_voice_credentials IS 'Voice biometric credentials (embeddings only, no raw audio)';
COMMENT ON COLUMN molam_voice_credentials.embedding_norm IS 'Encrypted normalized embedding vector (AES-256-GCM)';
COMMENT ON COLUMN molam_voice_credentials.embedding_hash IS 'HMAC of embedding for duplicate detection';
COMMENT ON COLUMN molam_voice_credentials.quality_score IS 'Audio quality score (higher = better)';
COMMENT ON COLUMN molam_voice_credentials.spoofing_score IS 'Anti-spoofing score (lower = more genuine)';

-- User voice preferences
CREATE TABLE IF NOT EXISTS molam_voice_prefs (
  user_id UUID PRIMARY KEY,
  voice_enabled BOOLEAN DEFAULT FALSE,
  require_voice_for_sensitive BOOLEAN DEFAULT FALSE,  -- step-up enforcement
  similarity_threshold NUMERIC(6,4) DEFAULT 0.78,     -- cosine similarity minimum (0-1)
  spoofing_threshold NUMERIC(6,4) DEFAULT 0.35,       -- max acceptable spoofing score
  max_failures SMALLINT DEFAULT 5,                    -- lockout threshold
  cooldown_sec INT DEFAULT 900,                       -- cooldown after max failures (15min)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE molam_voice_prefs IS 'User voice authentication preferences and thresholds';
COMMENT ON COLUMN molam_voice_prefs.similarity_threshold IS 'Minimum cosine similarity for verification (default 0.78)';
COMMENT ON COLUMN molam_voice_prefs.spoofing_threshold IS 'Maximum acceptable spoofing score (default 0.35)';

-- Voice verification attempts (audit trail)
CREATE TABLE IF NOT EXISTS molam_voice_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  req_id UUID,                        -- correlation ID for request tracking
  success BOOLEAN NOT NULL,
  similarity NUMERIC(6,4),            -- computed cosine similarity
  spoofing NUMERIC(6,4),              -- computed spoofing score
  ip INET,
  user_agent TEXT,
  channel TEXT,
  geo_country TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_attempts_user ON molam_voice_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_attempts_success ON molam_voice_attempts(success, created_at DESC);

COMMENT ON TABLE molam_voice_attempts IS 'Audit log of all voice verification attempts';

-- Global auth events (if not already created in other briques)
CREATE TABLE IF NOT EXISTS molam_auth_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  device_id UUID,
  event_type TEXT NOT NULL,           -- 'voice_enroll_begin', 'voice_assert_ok', etc.
  ip INET,
  user_agent TEXT,
  geo_country TEXT,
  detail JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_user ON molam_auth_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_type ON molam_auth_events(event_type, created_at DESC);

COMMENT ON TABLE molam_auth_events IS 'Global authentication events audit log';

-- Voice phrases catalog (multi-language support)
CREATE TABLE IF NOT EXISTS molam_voice_phrases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale TEXT NOT NULL,               -- fr_SN, wo_SN, en_GH, ar_MA, etc.
  phrase_type TEXT CHECK (phrase_type IN ('enrollment','verification')),
  phrase_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_phrases_locale ON molam_voice_phrases(locale, phrase_type);

COMMENT ON TABLE molam_voice_phrases IS 'Catalog of voice authentication phrases in multiple languages';

-- Insert default phrases
INSERT INTO molam_voice_phrases (locale, phrase_type, phrase_text) VALUES
  ('fr_SN', 'enrollment', 'Je confirme être le propriétaire de ce compte Molam'),
  ('wo_SN', 'enrollment', 'Maa ngi dëgg ni lii mooy sama kompte Molam'),
  ('en_GH', 'enrollment', 'I confirm I am the owner of this Molam account'),
  ('ar_MA', 'enrollment', 'أؤكد أنني مالك هذا حساب مولام'),
  ('fr_SN', 'verification', 'Molam sécurise mon argent aujourd''hui'),
  ('fr_SN', 'verification', 'Je confirme l''opération Molam'),
  ('fr_SN', 'verification', 'Ma voix confirme ce paiement Molam'),
  ('wo_SN', 'verification', 'Molam dafa yégal sama xaalis tey'),
  ('en_GH', 'verification', 'Molam keeps my money safe today'),
  ('ar_MA', 'verification', 'مولام يحمي أموالي اليوم')
ON CONFLICT DO NOTHING;
