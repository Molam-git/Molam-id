-- Brique 15: Multilingue (i18n avec fallback)
-- Système d'internationalisation centralisé pour toute la super-app Molam

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des locales supportées
CREATE TABLE IF NOT EXISTS i18n_locales (
  code           TEXT PRIMARY KEY,            -- e.g. 'fr', 'fr-SN', 'en', 'ar', 'wol'
  name           TEXT NOT NULL,               -- display name
  is_rtl         BOOLEAN NOT NULL DEFAULT FALSE,
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des modules (filiales)
CREATE TABLE IF NOT EXISTS i18n_modules (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug           TEXT UNIQUE NOT NULL,        -- 'id','pay','eats','talk','ads','shop','free','shared'
  display_name   TEXT NOT NULL,
  default_locale TEXT NOT NULL REFERENCES i18n_locales(code),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Entrées de traduction (source of truth)
CREATE TABLE IF NOT EXISTS i18n_entries (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_slug    TEXT NOT NULL REFERENCES i18n_modules(slug),
  namespace      TEXT NOT NULL,               -- e.g. 'auth','wallet','ussd'
  key            TEXT NOT NULL,               -- e.g. 'login.title'
  locale         TEXT NOT NULL REFERENCES i18n_locales(code),
  pattern_icu    TEXT NOT NULL,               -- ICU MessageFormat string
  metadata       JSONB,                       -- {context:"...", lengthHint:160, channel:["app","ussd"]}
  hash_sha256    TEXT NOT NULL,               -- content hash for integrity
  version        INTEGER NOT NULL DEFAULT 1,  -- optimistic version
  created_by     UUID,                        -- employee id
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(module_slug, namespace, key, locale)
);

-- Type ENUM pour statut de release
CREATE TYPE i18n_release_status AS ENUM ('draft','staged','published','archived');

-- Releases (bundles logiques)
CREATE TABLE IF NOT EXISTS i18n_releases (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_slug    TEXT NOT NULL REFERENCES i18n_modules(slug),
  tag            TEXT NOT NULL,               -- e.g. 'pay_2025-03-rc1'
  status         i18n_release_status NOT NULL DEFAULT 'draft',
  locales        TEXT[] NOT NULL,             -- locales included
  version_seq    BIGSERIAL,                   -- monotonic
  notes          TEXT,
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(module_slug, tag)
);

-- Bundles matérialisés (snapshots pour CDN)
CREATE TABLE IF NOT EXISTS i18n_bundles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  release_id     UUID NOT NULL REFERENCES i18n_releases(id),
  locale         TEXT NOT NULL REFERENCES i18n_locales(code),
  json_payload   JSONB NOT NULL,              -- flattened { "auth.login.title": "..." }
  e_tag          TEXT NOT NULL,
  signature      BYTEA NOT NULL,              -- Ed25519 signature
  published_at   TIMESTAMPTZ,
  s3_key         TEXT,                        -- s3 path
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(release_id, locale)
);

-- Audit trail (qui a changé quoi)
CREATE TABLE IF NOT EXISTS i18n_audit (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_slug    TEXT NOT NULL,
  actor_id       UUID,
  action         TEXT NOT NULL,               -- 'entry.create','entry.update','release.publish'
  details        JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_i18n_entries_module_locale ON i18n_entries(module_slug, locale);
CREATE INDEX IF NOT EXISTS idx_i18n_entries_namespace_key ON i18n_entries(namespace, key);
CREATE INDEX IF NOT EXISTS idx_i18n_entries_locale ON i18n_entries(locale);
CREATE INDEX IF NOT EXISTS idx_i18n_releases_module_status ON i18n_releases(module_slug, status);
CREATE INDEX IF NOT EXISTS idx_i18n_bundles_release_locale ON i18n_bundles(release_id, locale);
CREATE INDEX IF NOT EXISTS idx_i18n_audit_module ON i18n_audit(module_slug, created_at DESC);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_i18n_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

CREATE TRIGGER trigger_i18n_locales_updated
  BEFORE UPDATE ON i18n_locales
  FOR EACH ROW EXECUTE FUNCTION update_i18n_timestamp();

CREATE TRIGGER trigger_i18n_modules_updated
  BEFORE UPDATE ON i18n_modules
  FOR EACH ROW EXECUTE FUNCTION update_i18n_timestamp();

CREATE TRIGGER trigger_i18n_entries_updated
  BEFORE UPDATE ON i18n_entries
  FOR EACH ROW EXECUTE FUNCTION update_i18n_timestamp();

CREATE TRIGGER trigger_i18n_releases_updated
  BEFORE UPDATE ON i18n_releases
  FOR EACH ROW EXECUTE FUNCTION update_i18n_timestamp();

-- Fonction helper: obtenir la chaîne de fallback pour une locale
CREATE OR REPLACE FUNCTION get_locale_fallback_chain(p_locale TEXT)
RETURNS TEXT[] AS $$
DECLARE
  chain TEXT[] := ARRAY[p_locale];
  base_lang TEXT;
BEGIN
  -- Si locale avec région (fr-SN), ajouter la base (fr)
  IF p_locale LIKE '%-%' THEN
    base_lang := split_part(p_locale, '-', 1);
    chain := chain || base_lang;
  END IF;

  -- Toujours ajouter 'en' comme fallback final
  IF p_locale != 'en' THEN
    chain := chain || 'en';
  END IF;

  RETURN chain;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction: résoudre une clé avec fallback
CREATE OR REPLACE FUNCTION resolve_i18n_key(
  p_module_slug TEXT,
  p_namespace TEXT,
  p_key TEXT,
  p_locale TEXT
)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
  fallback_chain TEXT[];
  loc TEXT;
BEGIN
  fallback_chain := get_locale_fallback_chain(p_locale);

  FOREACH loc IN ARRAY fallback_chain LOOP
    SELECT pattern_icu INTO result
    FROM i18n_entries
    WHERE module_slug = p_module_slug
      AND namespace = p_namespace
      AND key = p_key
      AND locale = loc
    LIMIT 1;

    IF result IS NOT NULL THEN
      RETURN result;
    END IF;
  END LOOP;

  -- Si aucune traduction trouvée, retourner la clé elle-même
  RETURN p_namespace || '.' || p_key;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction: compter les clés manquantes par locale
CREATE OR REPLACE FUNCTION count_missing_keys(
  p_module_slug TEXT,
  p_locale TEXT
)
RETURNS TABLE(
  namespace TEXT,
  missing_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.namespace,
    COUNT(*) as missing_count
  FROM (
    SELECT DISTINCT namespace, key
    FROM i18n_entries
    WHERE module_slug = p_module_slug
      AND locale = 'en'  -- Base locale
  ) e
  LEFT JOIN i18n_entries t ON
    t.module_slug = p_module_slug
    AND t.namespace = e.namespace
    AND t.key = e.key
    AND t.locale = p_locale
  WHERE t.id IS NULL
  GROUP BY e.namespace;
END;
$$ LANGUAGE plpgsql STABLE;

-- Seed: locales initiales
INSERT INTO i18n_locales(code, name, is_rtl, enabled) VALUES
  ('en', 'English', false, true),
  ('fr', 'Français', false, true),
  ('fr-SN', 'Français (Sénégal)', false, true),
  ('ar', 'العربية', true, true),
  ('he', 'עברית', true, true),
  ('wol', 'Wolof', false, true),
  ('pt', 'Português', false, true),
  ('es', 'Español', false, true)
ON CONFLICT (code) DO NOTHING;

-- Seed: modules initiaux
INSERT INTO i18n_modules(slug, display_name, default_locale) VALUES
  ('id', 'Molam ID', 'en'),
  ('pay', 'Molam Pay', 'en'),
  ('eats', 'Molam Eats', 'en'),
  ('talk', 'Molam Talk', 'en'),
  ('ads', 'Molam Ads', 'en'),
  ('shop', 'Molam Shop', 'en'),
  ('free', 'Molam Free', 'en'),
  ('shared', 'Shared Resources', 'en')
ON CONFLICT (slug) DO NOTHING;

-- Commentaires
COMMENT ON TABLE i18n_locales IS 'Locales supportées avec support RTL';
COMMENT ON TABLE i18n_modules IS 'Modules/filiales Molam (chaque filiale gère ses traductions)';
COMMENT ON TABLE i18n_entries IS 'Entrées de traduction (source of truth) avec versioning';
COMMENT ON TABLE i18n_releases IS 'Releases logiques pour bundling et déploiement';
COMMENT ON TABLE i18n_bundles IS 'Bundles matérialisés signés pour CDN';
COMMENT ON TABLE i18n_audit IS 'Audit trail de toutes les modifications i18n';
COMMENT ON FUNCTION get_locale_fallback_chain(TEXT) IS 'Obtient la chaîne de fallback (ex: fr-SN → fr → en)';
COMMENT ON FUNCTION resolve_i18n_key(TEXT, TEXT, TEXT, TEXT) IS 'Résout une clé avec fallback automatique';
COMMENT ON FUNCTION count_missing_keys(TEXT, TEXT) IS 'Compte les traductions manquantes par namespace';
