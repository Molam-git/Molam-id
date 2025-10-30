-- Brique 9 - Géolocalisation & Fuseaux horaires
-- Multi-pays, privacy by design

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: User geo preferences (opt-in, precision, currency, locale)
CREATE TABLE IF NOT EXISTS molam_user_geo_prefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,

  -- Privacy settings
  gps_opt_in BOOLEAN DEFAULT FALSE,               -- GPS permission granted
  precision_level TEXT DEFAULT 'city' CHECK (precision_level IN ('country','region','city','precise')),

  -- Preferences
  preferred_country TEXT,                         -- ISO 3166-1 alpha-2 (SN, CI, GH, etc.)
  preferred_currency TEXT,                        -- ISO 4217 (XOF, GHS, NGN, EUR)
  preferred_locale TEXT,                          -- fr_SN, wo_SN, en_GH, etc.
  preferred_timezone TEXT,                        -- Africa/Dakar, Africa/Abidjan, etc.

  -- Multi-number support
  home_country TEXT,                              -- Primary country of residence

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_geo_prefs_user ON molam_user_geo_prefs(user_id);
CREATE INDEX idx_user_geo_prefs_country ON molam_user_geo_prefs(preferred_country);

-- Table 2: Last known geo context (for fraud detection, USSD routing)
CREATE TABLE IF NOT EXISTS molam_geo_last_context (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,

  -- Source
  source TEXT CHECK (source IN ('ip','mcc_mnc','gps','manual')),

  -- Location data (privacy-aware)
  country TEXT,                                   -- ISO 3166-1 alpha-2
  region TEXT,                                    -- State/Province
  city TEXT,
  geohash TEXT,                                   -- Geohash for approximate location
  latitude NUMERIC(10,7),                         -- Only if GPS opt-in + precise
  longitude NUMERIC(10,7),                        -- Only if GPS opt-in + precise
  accuracy_meters INTEGER,                        -- GPS accuracy

  -- IP context
  ip_address INET,
  asn BIGINT,                                     -- Autonomous System Number
  asn_org TEXT,                                   -- ISP/Org name
  is_vpn BOOLEAN DEFAULT FALSE,                  -- VPN/proxy detected
  is_mobile BOOLEAN DEFAULT FALSE,                -- Mobile network

  -- Mobile network context
  mcc INTEGER,                                    -- Mobile Country Code
  mnc INTEGER,                                    -- Mobile Network Code
  carrier TEXT,                                   -- Orange SN, MTN GH, etc.

  -- Timezone
  timezone TEXT,                                  -- IANA timezone
  utc_offset INTEGER,                             -- Offset in minutes

  -- Timestamp
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,                         -- For ephemeral GPS data

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES molam_user_geo_prefs(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_geo_context_user ON molam_geo_last_context(user_id);
CREATE INDEX idx_geo_context_captured ON molam_geo_last_context(captured_at DESC);
CREATE INDEX idx_geo_context_expires ON molam_geo_last_context(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_geo_context_country ON molam_geo_last_context(country);

-- Table 3: Geo events (audit trail for geo-based decisions)
CREATE TABLE IF NOT EXISTS molam_geo_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,

  -- Event type
  event_type TEXT CHECK (event_type IN (
    'location_captured',
    'country_mismatch',
    'vpn_detected',
    'impossible_travel',
    'ussd_routed',
    'currency_switched',
    'timezone_updated'
  )),

  -- Context
  from_country TEXT,
  to_country TEXT,
  from_ip INET,
  to_ip INET,
  distance_km INTEGER,                            -- For impossible travel detection
  time_delta_minutes INTEGER,                     -- Time between events

  -- Decision
  action_taken TEXT,                              -- block, allow, step_up, log_only
  risk_score NUMERIC(5,2),                        -- 0-100

  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_geo_events_user ON molam_geo_events(user_id);
CREATE INDEX idx_geo_events_type ON molam_geo_events(event_type);
CREATE INDEX idx_geo_events_created ON molam_geo_events(created_at DESC);

-- Table 4: GPS ephemeral storage (RGPD compliant, auto-purge)
CREATE TABLE IF NOT EXISTS molam_gps_ephemeral (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,

  -- Encrypted precise location
  latitude_enc BYTEA NOT NULL,                    -- AES-256-GCM encrypted
  longitude_enc BYTEA NOT NULL,
  accuracy_meters INTEGER,

  -- Purpose
  purpose TEXT CHECK (purpose IN ('step_up','fraud_check','support_request')),

  -- Auto-purge
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,                -- Max 24h
  purged BOOLEAN DEFAULT FALSE,

  CONSTRAINT fk_user_gps FOREIGN KEY (user_id) REFERENCES molam_user_geo_prefs(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_gps_ephemeral_user ON molam_gps_ephemeral(user_id);
CREATE INDEX idx_gps_ephemeral_expires ON molam_gps_ephemeral(expires_at) WHERE NOT purged;

-- Table 5: Country matrix (multi-country config)
CREATE TABLE IF NOT EXISTS molam_country_matrix (
  id SERIAL PRIMARY KEY,

  -- Country
  country_code TEXT UNIQUE NOT NULL,              -- ISO 3166-1 alpha-2
  country_name TEXT NOT NULL,

  -- Currency
  currency_code TEXT NOT NULL,                    -- ISO 4217
  currency_symbol TEXT,

  -- Timezone(s)
  timezones TEXT[] NOT NULL,                      -- Multiple zones for large countries
  default_timezone TEXT NOT NULL,

  -- USSD config
  ussd_prefix TEXT,                               -- *131# pattern
  ussd_gateway_url TEXT,                          -- USSD provider endpoint

  -- Phone format
  phone_prefix TEXT NOT NULL,                     -- +221, +225, +233, etc.
  phone_regex TEXT,                               -- Validation pattern
  phone_example TEXT,                             -- Display example

  -- Locale
  default_locale TEXT NOT NULL,                   -- fr_SN, en_GH, etc.
  supported_locales TEXT[],                       -- [fr_SN, wo_SN, en_SN]

  -- Flags
  is_active BOOLEAN DEFAULT TRUE,
  supports_ussd BOOLEAN DEFAULT TRUE,
  supports_mobile_money BOOLEAN DEFAULT FALSE,

  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_country_matrix_code ON molam_country_matrix(country_code);
CREATE INDEX idx_country_matrix_active ON molam_country_matrix(is_active) WHERE is_active = TRUE;

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_geo_prefs_updated
BEFORE UPDATE ON molam_user_geo_prefs
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_country_matrix_updated
BEFORE UPDATE ON molam_country_matrix
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-purge expired GPS data (run daily via cron/k8s job)
CREATE OR REPLACE FUNCTION purge_expired_gps()
RETURNS INTEGER AS $$
DECLARE
  purged_count INTEGER;
BEGIN
  UPDATE molam_gps_ephemeral
  SET purged = TRUE
  WHERE expires_at < NOW() AND NOT purged;

  GET DIAGNOSTICS purged_count = ROW_COUNT;
  RETURN purged_count;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE molam_user_geo_prefs IS 'User geo preferences and privacy settings';
COMMENT ON TABLE molam_geo_last_context IS 'Last known geo context for fraud detection and routing';
COMMENT ON TABLE molam_geo_events IS 'Audit trail for geo-based decisions';
COMMENT ON TABLE molam_gps_ephemeral IS 'Ephemeral GPS storage (auto-purge after 24h)';
COMMENT ON TABLE molam_country_matrix IS 'Multi-country configuration matrix';
