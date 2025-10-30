-- Brique 16: Multidevise (conversion automatique via API forex)
-- Référentiel devises, taux multi-sources, conversion traçable

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des devises (ISO 4217)
CREATE TABLE IF NOT EXISTS fx_currencies (
  code            TEXT PRIMARY KEY,         -- 'XOF','USD','EUR','GNF','MAD','XAF','GBP','NGN'
  name            TEXT NOT NULL,
  symbol          TEXT,                     -- 'CFA','$', '€'
  minor_unit      INTEGER NOT NULL,         -- ISO 4217 decimals (e.g. 2, 0)
  cash_rounding   NUMERIC(10,6) DEFAULT NULL,  -- minimal cash rounding unit (e.g. 0.05)
  cash_rule       TEXT DEFAULT 'nearest',   -- 'nearest'|'up'|'down'
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Règles spécifiques par pays (contraintes cash, suspensions)
CREATE TABLE IF NOT EXISTS fx_country_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_code    TEXT NOT NULL,            -- 'SN','CI','CM','FR'
  currency_code   TEXT NOT NULL REFERENCES fx_currencies(code),
  cash_rounding   NUMERIC(10,6),            -- override per country
  cash_rule       TEXT,
  price_step      NUMERIC(10,6),            -- minimal price tick (optional)
  status          TEXT NOT NULL DEFAULT 'active', -- 'active'|'suspended'
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(country_code, currency_code)
);

-- Sources de taux (registre)
CREATE TABLE IF NOT EXISTS fx_sources (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            TEXT UNIQUE NOT NULL,     -- 'cb_sn','ecb','oer','twelvedata'
  display_name    TEXT NOT NULL,
  priority        INTEGER NOT NULL,         -- lower = higher priority
  reliability     INTEGER NOT NULL DEFAULT 80, -- quality score 0..100
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Taux (normalisés par paire + timestamp)
CREATE TABLE IF NOT EXISTS fx_rates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base            TEXT NOT NULL REFERENCES fx_currencies(code),
  quote           TEXT NOT NULL REFERENCES fx_currencies(code),
  rate            NUMERIC(20,10) NOT NULL CHECK (rate > 0),
  asof            TIMESTAMPTZ NOT NULL,     -- provider timestamp
  source_slug     TEXT NOT NULL REFERENCES fx_sources(slug),
  quality         INTEGER NOT NULL DEFAULT 80,
  ingest_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(base, quote, asof, source_slug)
);

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_fx_rates_pair ON fx_rates(base, quote, asof DESC);
CREATE INDEX IF NOT EXISTS idx_fx_rates_source ON fx_rates(source_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fx_rates_asof ON fx_rates(asof DESC);
CREATE INDEX IF NOT EXISTS idx_fx_country_rules_country ON fx_country_rules(country_code);

-- Vue matérialisée : meilleur taux par paire (freshness + priority)
CREATE MATERIALIZED VIEW IF NOT EXISTS fx_best_rates AS
SELECT DISTINCT ON (base, quote)
  base, quote, rate, asof, source_slug, quality, created_at
FROM fx_rates
WHERE asof > NOW() - INTERVAL '48 hours'
  AND rate > 0
ORDER BY base, quote, asof DESC, quality DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fx_best_rates_pair ON fx_best_rates(base, quote);

-- Audit des conversions (WORM-friendly)
CREATE TABLE IF NOT EXISTS fx_convert_audit (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id      UUID,                     -- upstream trace id
  user_id         UUID,
  module_slug     TEXT NOT NULL,            -- 'id','pay','eats'
  from_ccy        TEXT NOT NULL,
  to_ccy          TEXT NOT NULL,
  amount_in       NUMERIC(30,10) NOT NULL,
  amount_out      NUMERIC(30,10) NOT NULL,
  rate_used       NUMERIC(20,10) NOT NULL,
  rate_asof       TIMESTAMPTZ NOT NULL,
  path            TEXT NOT NULL,            -- 'direct'|'USD pivot'|'EUR pivot'
  source_slug     TEXT NOT NULL,
  country_code    TEXT,
  rounding_rule   JSONB,
  proof_hash      TEXT NOT NULL,            -- hash chain for immutability
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fx_convert_audit_user ON fx_convert_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fx_convert_audit_module ON fx_convert_audit(module_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fx_convert_audit_pair ON fx_convert_audit(from_ccy, to_ccy, created_at DESC);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_fx_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

CREATE TRIGGER trigger_fx_currencies_updated
  BEFORE UPDATE ON fx_currencies
  FOR EACH ROW EXECUTE FUNCTION update_fx_timestamp();

CREATE TRIGGER trigger_fx_country_rules_updated
  BEFORE UPDATE ON fx_country_rules
  FOR EACH ROW EXECUTE FUNCTION update_fx_timestamp();

-- Fonction : refresh best rates (appelée après ingestion)
CREATE OR REPLACE FUNCTION refresh_best_rates()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY fx_best_rates;
END;
$$ LANGUAGE plpgsql;

-- Seeds : devises principales
INSERT INTO fx_currencies(code, name, symbol, minor_unit, cash_rounding, cash_rule, enabled) VALUES
  ('XOF', 'Franc CFA BCEAO', 'CFA', 0, 1, 'nearest', TRUE),
  ('XAF', 'Franc CFA BEAC', 'CFA', 0, 1, 'nearest', TRUE),
  ('USD', 'US Dollar', '$', 2, NULL, 'nearest', TRUE),
  ('EUR', 'Euro', '€', 2, 0.01, 'nearest', TRUE),
  ('GNF', 'Guinean Franc', 'FG', 0, 100, 'nearest', TRUE),
  ('MAD', 'Moroccan Dirham', 'DH', 2, 0.01, 'nearest', TRUE),
  ('NGN', 'Nigerian Naira', '₦', 2, 0.01, 'nearest', TRUE),
  ('GBP', 'British Pound', '£', 2, 0.01, 'nearest', TRUE),
  ('GHS', 'Ghanaian Cedi', 'GH₵', 2, 0.01, 'nearest', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Seeds : sources de taux
INSERT INTO fx_sources(slug, display_name, priority, reliability, enabled) VALUES
  ('cb_sn', 'Banque Centrale UEMOA/BCEAO', 1, 95, TRUE),
  ('ecb', 'European Central Bank', 2, 90, TRUE),
  ('oer', 'Open Exchange Rates', 3, 85, TRUE),
  ('twelvedata', 'Twelve Data API', 4, 80, TRUE),
  ('manual', 'Manual Entry', 99, 100, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Seed : règles pays (exemple Sénégal)
INSERT INTO fx_country_rules(country_code, currency_code, cash_rounding, cash_rule, status, notes)
VALUES ('SN', 'XOF', 1, 'nearest', 'active', 'Arrondi au franc près pour cash')
ON CONFLICT (country_code, currency_code) DO NOTHING;

-- Commentaires
COMMENT ON TABLE fx_currencies IS 'Référentiel devises ISO 4217 avec règles d''arrondi';
COMMENT ON TABLE fx_country_rules IS 'Règles spécifiques par pays (arrondi cash, suspensions)';
COMMENT ON TABLE fx_sources IS 'Sources de taux de change avec priorités';
COMMENT ON TABLE fx_rates IS 'Taux de change historiques multi-sources';
COMMENT ON MATERIALIZED VIEW fx_best_rates IS 'Meilleurs taux par paire (fraîcheur + qualité)';
COMMENT ON TABLE fx_convert_audit IS 'Audit WORM des conversions avec hash chain';
COMMENT ON FUNCTION refresh_best_rates() IS 'Rafraîchir la vue matérialisée des meilleurs taux';
