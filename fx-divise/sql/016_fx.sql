



CREATE TABLE IF NOT EXISTS fx_rates (
id UUID PRIMARY KEY,
base TEXT NOT NULL REFERENCES fx_currencies(code),
quote TEXT NOT NULL REFERENCES fx_currencies(code),
rate NUMERIC(20,10) NOT NULL CHECK (rate > 0),
asof TIMESTAMPTZ NOT NULL,
source_slug TEXT NOT NULL REFERENCES fx_sources(slug),
quality INTEGER NOT NULL DEFAULT 80,
ingest_batch_id UUID,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
UNIQUE(base, quote, asof, source_slug)
);


CREATE MATERIALIZED VIEW IF NOT EXISTS fx_best_rates AS
SELECT DISTINCT ON (base, quote)
base, quote, rate, asof, source_slug, quality, created_at
FROM fx_rates
WHERE asof > NOW() - INTERVAL '48 hours'
ORDER BY base, quote, asof DESC, quality DESC;


CREATE TABLE IF NOT EXISTS fx_convert_audit (
id UUID PRIMARY KEY,
request_id UUID,
user_id UUID,
module_slug TEXT NOT NULL,
from_ccy TEXT NOT NULL,
to_ccy TEXT NOT NULL,
amount_in NUMERIC(30,10) NOT NULL,
amount_out NUMERIC(30,10) NOT NULL,
rate_used NUMERIC(20,10) NOT NULL,
rate_asof TIMESTAMPTZ NOT NULL,
path TEXT NOT NULL,
source_slug TEXT NOT NULL,
country_code TEXT,
rounding_rule JSONB,
proof_hash TEXT NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Seeds (exemples)
INSERT INTO fx_currencies(code,name,symbol,minor_unit,cash_rounding,cash_rule) VALUES
('XOF','Franc CFA BCEAO','CFA',0,1,'nearest') ON CONFLICT DO NOTHING,
('XAF','Franc CFA BEAC','CFA',0,1,'nearest') ON CONFLICT DO NOTHING,
('USD','US Dollar','$',2,NULL,'nearest') ON CONFLICT DO NOTHING,
('EUR','Euro','€',2,0.05,'nearest') ON CONFLICT DO NOTHING,
('GNF','Guinean Franc','FG',0,100,'nearest') ON CONFLICT DO NOTHING;


INSERT INTO fx_sources(id,slug,display_name,priority,reliability,enabled)
VALUES (gen_random_uuid(),'cb_sn','Banque Centrale UEMOA/BCEAO',1,95,TRUE)
ON CONFLICT DO NOTHING;


INSERT INTO fx_country_rules(id,country_code,currency_code,cash_rounding,cash_rule,status)
VALUES (gen_random_uuid(),'SN','XOF',1,'nearest','active')
ON CONFLICT DO NOTHING;