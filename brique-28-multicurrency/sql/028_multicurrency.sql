-- 028_multicurrency.sql
-- Brique 28: Infrastructure multidevise industrielle avec conversion automatique
-- Support ISO-4217, taux de change multi-providers, caching Redis, snapshots journaliers
-- Overrides manuels avec traçabilité, règles d'arrondi, RBAC, observabilité Prometheus

-- ============================================================================
-- 1. TABLE: molam_currencies (catalogue ISO-4217)
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_currencies (
  code CHAR(3) PRIMARY KEY,                  -- ISO 4217 (USD, EUR, XOF, etc.)
  name TEXT NOT NULL,                        -- "US Dollar", "West African CFA franc"
  symbol TEXT NOT NULL,                      -- "$", "€", "F CFA"
  minor_unit SMALLINT NOT NULL CHECK (minor_unit BETWEEN 0 AND 4), -- decimals (0 for XOF, 2 for USD)
  cash_rounding INTEGER NOT NULL DEFAULT 1,  -- smallest cash unit (5 for CHF 0.05, 50 for GNF)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  min_amount_minor BIGINT DEFAULT 0,         -- minimum amount in minor units
  max_amount_minor BIGINT DEFAULT 9223372036854775807, -- maximum amount
  country_codes TEXT[],                      -- Associated countries (ISO 3166)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_currencies_active ON molam_currencies(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE molam_currencies IS 'Catalogue complet des devises supportées selon ISO-4217';
COMMENT ON COLUMN molam_currencies.minor_unit IS 'Nombre de décimales (0=XOF, 2=USD, 3=KWD)';
COMMENT ON COLUMN molam_currencies.cash_rounding IS 'Plus petite unité espèces (5=CHF 0.05, 50=GNF 50)';

-- ============================================================================
-- 2. TABLE: molam_fx_providers (registre des fournisseurs de taux)
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_fx_providers (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,                 -- 'BANK_PARTNER', 'ECB', 'OXR', 'INTERNAL'
  name TEXT NOT NULL,                        -- "European Central Bank", "OpenExchangeRates"
  priority SMALLINT NOT NULL,                -- 1 = highest priority (failover cascade)
  timeout_ms INTEGER NOT NULL DEFAULT 3000,  -- timeout per request
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  api_base_url TEXT,                         -- Base URL for API calls
  requires_auth BOOLEAN DEFAULT FALSE,       -- Whether API key is required
  requires_mtls BOOLEAN DEFAULT FALSE,       -- Whether mTLS client cert is required
  last_successful_fetch TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fx_providers_priority ON molam_fx_providers(priority) WHERE is_active = TRUE;

COMMENT ON TABLE molam_fx_providers IS 'Registre des fournisseurs de taux de change avec priorité et failover';
COMMENT ON COLUMN molam_fx_providers.priority IS 'Priorité (1=plus haute, cascade vers priorités inférieures en cas d''échec)';

-- ============================================================================
-- 3. TABLE: molam_fx_rates (taux live par provider)
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_fx_rates (
  id BIGSERIAL PRIMARY KEY,
  provider_code TEXT NOT NULL REFERENCES molam_fx_providers(code) ON DELETE CASCADE,
  base CHAR(3) NOT NULL REFERENCES molam_currencies(code),
  quote CHAR(3) NOT NULL REFERENCES molam_currencies(code),
  rate NUMERIC(20,10) NOT NULL CHECK (rate > 0),
  inverse_rate NUMERIC(20,10),               -- Cached inverse for performance
  as_of TIMESTAMPTZ NOT NULL,                -- Provider timestamp
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,                    -- Optional expiry
  UNIQUE(provider_code, base, quote),
  CHECK (base != quote)
);

CREATE INDEX idx_fx_rates_pair ON molam_fx_rates(base, quote);
CREATE INDEX idx_fx_rates_as_of ON molam_fx_rates(as_of DESC);
CREATE INDEX idx_fx_rates_provider ON molam_fx_rates(provider_code, received_at DESC);

COMMENT ON TABLE molam_fx_rates IS 'Taux de change live par fournisseur (dernière valeur)';
COMMENT ON COLUMN molam_fx_rates.as_of IS 'Timestamp du taux selon le fournisseur';
COMMENT ON COLUMN molam_fx_rates.inverse_rate IS 'Taux inverse mis en cache (1/rate)';

-- ============================================================================
-- 4. TABLE: molam_fx_snapshots (snapshots journaliers signés pour audit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_fx_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  base CHAR(3) NOT NULL REFERENCES molam_currencies(code),
  quote CHAR(3) NOT NULL REFERENCES molam_currencies(code),
  rate NUMERIC(20,10) NOT NULL CHECK (rate > 0),
  source TEXT NOT NULL,                      -- Provider résolu (BANK_PARTNER, ECB, etc.)
  signature BYTEA,                           -- HMAC/Vault signature pour preuve d'intégrité
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(snapshot_date, base, quote),
  CHECK (base != quote)
);

CREATE INDEX idx_fx_snapshots_date ON molam_fx_snapshots(snapshot_date DESC);
CREATE INDEX idx_fx_snapshots_pair ON molam_fx_snapshots(base, quote, snapshot_date DESC);

COMMENT ON TABLE molam_fx_snapshots IS 'Snapshots journaliers signés des taux pour audit et réconciliation';
COMMENT ON COLUMN molam_fx_snapshots.signature IS 'Signature HMAC pour preuve d''intégrité (réconciliation audit)';

-- ============================================================================
-- 5. TABLE: molam_fx_overrides (surcharges manuelles avec validité)
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_fx_overrides (
  id BIGSERIAL PRIMARY KEY,
  base CHAR(3) NOT NULL REFERENCES molam_currencies(code),
  quote CHAR(3) NOT NULL REFERENCES molam_currencies(code),
  rate NUMERIC(20,10) NOT NULL CHECK (rate > 0),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,                      -- Justification (trading desk, urgence)
  created_by UUID NOT NULL REFERENCES molam_users(id),
  approved_by UUID REFERENCES molam_users(id), -- Dual-control approval
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_from < valid_to),
  CHECK (base != quote)
);

CREATE INDEX idx_fx_overrides_valid ON molam_fx_overrides(base, quote, valid_from, valid_to);
CREATE INDEX idx_fx_overrides_active ON molam_fx_overrides(valid_from, valid_to) WHERE NOW() BETWEEN valid_from AND valid_to;

COMMENT ON TABLE molam_fx_overrides IS 'Surcharges manuelles des taux (trading desk) avec période de validité';
COMMENT ON COLUMN molam_fx_overrides.reason IS 'Justification obligatoire pour traçabilité audit';

-- ============================================================================
-- 6. TABLE: molam_fx_conversions_log (log des conversions pour réconciliation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_fx_conversions_log (
  id BIGSERIAL PRIMARY KEY,
  transaction_id UUID,                       -- Optional link to transaction
  user_id UUID REFERENCES molam_users(id),
  from_currency CHAR(3) NOT NULL REFERENCES molam_currencies(code),
  to_currency CHAR(3) NOT NULL REFERENCES molam_currencies(code),
  amount_minor_from BIGINT NOT NULL,
  amount_minor_to BIGINT NOT NULL,
  rate_used NUMERIC(20,10) NOT NULL,
  rate_source TEXT NOT NULL,                 -- LIVE:ECB, OVERRIDE, SNAP:BANK_PARTNER
  conversion_mode TEXT NOT NULL CHECK (conversion_mode IN ('accounting', 'cash')),
  converted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_fx_conversions_user ON molam_fx_conversions_log(user_id, converted_at DESC);
CREATE INDEX idx_fx_conversions_pair ON molam_fx_conversions_log(from_currency, to_currency, converted_at DESC);
CREATE INDEX idx_fx_conversions_transaction ON molam_fx_conversions_log(transaction_id) WHERE transaction_id IS NOT NULL;

COMMENT ON TABLE molam_fx_conversions_log IS 'Log de toutes les conversions pour réconciliation et audit';

-- ============================================================================
-- 7. TABLE: molam_fx_provider_stats (statistiques par provider pour observabilité)
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_fx_provider_stats (
  id BIGSERIAL PRIMARY KEY,
  provider_code TEXT NOT NULL REFERENCES molam_fx_providers(code),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms INTEGER,
  max_latency_ms INTEGER,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  UNIQUE(provider_code, date)
);

CREATE INDEX idx_fx_provider_stats_date ON molam_fx_provider_stats(date DESC);

-- ============================================================================
-- 8. FUNCTIONS
-- ============================================================================

-- 8.1. get_effective_rate: Résout le taux effectif (override > live > snapshot > identity)
CREATE OR REPLACE FUNCTION get_effective_rate(
  p_base CHAR(3),
  p_quote CHAR(3),
  p_when TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE(rate NUMERIC, source TEXT) AS $$
BEGIN
  -- Identity case
  IF p_base = p_quote THEN
    RETURN QUERY SELECT 1.0::NUMERIC(20,10), 'IDENTITY'::TEXT;
    RETURN;
  END IF;

  -- 1. Check active override
  RETURN QUERY
  SELECT o.rate, 'OVERRIDE'::TEXT
  FROM molam_fx_overrides o
  WHERE o.base = p_base
    AND o.quote = p_quote
    AND o.valid_from <= p_when
    AND o.valid_to >= p_when
  ORDER BY o.valid_from DESC
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- 2. Check live rate (most recent from highest priority provider)
  RETURN QUERY
  SELECT r.rate, ('LIVE:' || r.provider_code)::TEXT
  FROM molam_fx_rates r
  JOIN molam_fx_providers p ON p.code = r.provider_code
  WHERE r.base = p_base
    AND r.quote = p_quote
    AND p.is_active = TRUE
    AND (r.expires_at IS NULL OR r.expires_at > p_when)
  ORDER BY p.priority ASC, r.as_of DESC
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- 3. Check snapshot of the day
  RETURN QUERY
  SELECT s.rate, ('SNAP:' || s.source)::TEXT
  FROM molam_fx_snapshots s
  WHERE s.snapshot_date = p_when::DATE
    AND s.base = p_base
    AND s.quote = p_quote
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- 4. No rate available
  RAISE EXCEPTION 'No FX rate available for % / %', p_base, p_quote;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_effective_rate IS 'Résout le taux de change effectif avec hiérarchie: override > live > snapshot';

-- 8.2. update_fx_rate_timestamp: Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_fx_rate_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fx_rates_updated
BEFORE UPDATE ON molam_fx_rates
FOR EACH ROW EXECUTE FUNCTION update_fx_rate_timestamp();

CREATE TRIGGER trg_currencies_updated
BEFORE UPDATE ON molam_currencies
FOR EACH ROW EXECUTE FUNCTION update_fx_rate_timestamp();

CREATE TRIGGER trg_fx_providers_updated
BEFORE UPDATE ON molam_fx_providers
FOR EACH ROW EXECUTE FUNCTION update_fx_rate_timestamp();

-- 8.3. log_fx_conversion: Enregistre une conversion dans le log
CREATE OR REPLACE FUNCTION log_fx_conversion(
  p_transaction_id UUID,
  p_user_id UUID,
  p_from_currency CHAR(3),
  p_to_currency CHAR(3),
  p_amount_minor_from BIGINT,
  p_amount_minor_to BIGINT,
  p_rate_used NUMERIC,
  p_rate_source TEXT,
  p_conversion_mode TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO molam_fx_conversions_log (
    transaction_id, user_id, from_currency, to_currency,
    amount_minor_from, amount_minor_to, rate_used, rate_source,
    conversion_mode, ip_address, user_agent
  ) VALUES (
    p_transaction_id, p_user_id, p_from_currency, p_to_currency,
    p_amount_minor_from, p_amount_minor_to, p_rate_used, p_rate_source,
    p_conversion_mode, p_ip_address, p_user_agent
  );
END;
$$ LANGUAGE plpgsql;

-- 8.4. get_active_overrides_count: Compte les overrides actifs
CREATE OR REPLACE FUNCTION get_active_overrides_count()
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM molam_fx_overrides
  WHERE NOW() BETWEEN valid_from AND valid_to;
$$ LANGUAGE sql STABLE;

-- 8.5. get_currency_pairs_coverage: Vérifie la couverture des paires de devises
CREATE OR REPLACE FUNCTION get_currency_pairs_coverage(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
  total_pairs BIGINT,
  snapshot_pairs BIGINT,
  coverage_percent NUMERIC
) AS $$
DECLARE
  v_total BIGINT;
  v_snapshot BIGINT;
BEGIN
  -- Count all possible active currency pairs
  SELECT COUNT(*)
  INTO v_total
  FROM molam_currencies c1
  CROSS JOIN molam_currencies c2
  WHERE c1.is_active = TRUE
    AND c2.is_active = TRUE
    AND c1.code < c2.code; -- Avoid duplicates (USD/EUR = EUR/USD)

  -- Count pairs with snapshots
  SELECT COUNT(DISTINCT (s.base, s.quote))
  INTO v_snapshot
  FROM molam_fx_snapshots s
  WHERE s.snapshot_date = p_date;

  RETURN QUERY SELECT
    v_total,
    v_snapshot,
    CASE WHEN v_total > 0 THEN ROUND((v_snapshot::NUMERIC / v_total::NUMERIC) * 100, 2) ELSE 0 END;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 9. SEED DATA
-- ============================================================================

-- Insert common currencies
INSERT INTO molam_currencies (code, name, symbol, minor_unit, cash_rounding, country_codes) VALUES
  ('XOF', 'West African CFA franc', 'F CFA', 0, 5, ARRAY['SN', 'ML', 'CI', 'BF', 'NE', 'TG', 'BJ', 'GW']),
  ('XAF', 'Central African CFA franc', 'F CFA', 0, 5, ARRAY['CM', 'CF', 'TD', 'CG', 'GQ', 'GA']),
  ('USD', 'US Dollar', '$', 2, 1, ARRAY['US']),
  ('EUR', 'Euro', '€', 2, 1, ARRAY['FR', 'DE', 'IT', 'ES', 'PT', 'BE', 'NL', 'AT', 'FI', 'IE']),
  ('GNF', 'Guinean Franc', 'FG', 0, 50, ARRAY['GN']),
  ('CNY', 'Chinese Yuan', '¥', 2, 1, ARRAY['CN']),
  ('GBP', 'British Pound', '£', 2, 1, ARRAY['GB']),
  ('CHF', 'Swiss Franc', 'CHF', 2, 5, ARRAY['CH']),
  ('JPY', 'Japanese Yen', '¥', 0, 1, ARRAY['JP']),
  ('MGA', 'Malagasy Ariary', 'Ar', 0, 5, ARRAY['MG']),
  ('MAD', 'Moroccan Dirham', 'DH', 2, 1, ARRAY['MA']),
  ('TND', 'Tunisian Dinar', 'DT', 3, 1, ARRAY['TN']),
  ('NGN', 'Nigerian Naira', '₦', 2, 1, ARRAY['NG']),
  ('GHS', 'Ghanaian Cedi', '₵', 2, 1, ARRAY['GH']),
  ('KES', 'Kenyan Shilling', 'KSh', 2, 1, ARRAY['KE'])
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  symbol = EXCLUDED.symbol,
  minor_unit = EXCLUDED.minor_unit,
  cash_rounding = EXCLUDED.cash_rounding,
  country_codes = EXCLUDED.country_codes;

-- Insert FX providers
INSERT INTO molam_fx_providers (code, name, priority, timeout_ms, api_base_url, requires_auth) VALUES
  ('BANK_PARTNER', 'Primary Partner Bank', 1, 5000, NULL, TRUE),
  ('ECB', 'European Central Bank', 2, 3000, 'https://api.exchangerate.host', FALSE),
  ('OXR', 'OpenExchangeRates', 3, 3000, 'https://openexchangerates.org/api', TRUE),
  ('INTERNAL', 'Molam Derived Rates', 4, 1000, NULL, FALSE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  priority = EXCLUDED.priority,
  timeout_ms = EXCLUDED.timeout_ms,
  api_base_url = EXCLUDED.api_base_url,
  requires_auth = EXCLUDED.requires_auth;

-- ============================================================================
-- 10. ALTER molam_users (preferred_currency)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'molam_users' AND column_name = 'preferred_currency'
  ) THEN
    ALTER TABLE molam_users
      ADD COLUMN preferred_currency CHAR(3) REFERENCES molam_currencies(code) DEFAULT 'XOF';
  END IF;
END $$;

-- ============================================================================
-- 11. GRANTS (adjust as needed)
-- ============================================================================

-- Public read access to currencies
GRANT SELECT ON molam_currencies TO PUBLIC;

-- Finance admin full access
-- GRANT ALL ON molam_fx_overrides, molam_fx_snapshots TO finance_admin;

-- ============================================================================
-- 12. COMMENTS & DOCUMENTATION
-- ============================================================================

COMMENT ON DATABASE current_database() IS
'Brique 28: Infrastructure multidevise industrielle avec ISO-4217, multi-providers, snapshots journaliers, overrides manuels';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
