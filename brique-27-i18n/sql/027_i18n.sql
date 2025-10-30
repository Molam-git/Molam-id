-- 027_i18n.sql
-- Brique 27: Infrastructure i18n industrielle pour Molam super app
-- Support: fr, en, wo, ar, es avec fallback vers en
-- Multi-plateformes: Web, iOS, Android, HarmonyOS, Desktop

-- ============================================================================
-- 1. TABLE: molam_translations
-- ============================================================================
-- Stocke toutes les traductions avec clé unique par langue

CREATE TABLE IF NOT EXISTS molam_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL, -- ex: "auth.login.title", "home.welcome"
  lang TEXT NOT NULL CHECK (lang IN ('fr','en','wo','ar','es')),
  value TEXT NOT NULL,
  category TEXT, -- ex: "auth", "home", "settings", "errors"
  platform TEXT, -- "all", "web", "mobile", "desktop" (optional filtering)
  notes TEXT, -- Context for translators
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES molam_users(id),
  updated_by UUID REFERENCES molam_users(id),
  UNIQUE (key, lang)
);

-- Index pour recherche rapide
CREATE INDEX idx_translations_lang ON molam_translations(lang);
CREATE INDEX idx_translations_key ON molam_translations(key);
CREATE INDEX idx_translations_category ON molam_translations(category);
CREATE INDEX idx_translations_updated ON molam_translations(updated_at DESC);

COMMENT ON TABLE molam_translations IS 'Centralisation des traductions pour toute la super app Molam';
COMMENT ON COLUMN molam_translations.key IS 'Clé unique de traduction (format: module.screen.element)';
COMMENT ON COLUMN molam_translations.lang IS 'Code langue ISO 639-1 (fr, en, wo, ar, es)';
COMMENT ON COLUMN molam_translations.value IS 'Texte traduit';
COMMENT ON COLUMN molam_translations.category IS 'Catégorie pour organisation (auth, home, settings, etc.)';
COMMENT ON COLUMN molam_translations.platform IS 'Plateforme cible (all, web, mobile, desktop)';

-- ============================================================================
-- 2. TABLE: molam_translation_history
-- ============================================================================
-- Audit trail pour toutes les modifications de traductions

CREATE TABLE IF NOT EXISTS molam_translation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id UUID NOT NULL REFERENCES molam_translations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  lang TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES molam_users(id),
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_translation_history_translation ON molam_translation_history(translation_id);
CREATE INDEX idx_translation_history_changed_at ON molam_translation_history(changed_at DESC);

-- ============================================================================
-- 3. TABLE: molam_translation_cache
-- ============================================================================
-- Cache des bundles de traductions pour distribution CDN

CREATE TABLE IF NOT EXISTS molam_translation_cache (
  lang TEXT PRIMARY KEY CHECK (lang IN ('fr','en','wo','ar','es')),
  bundle JSONB NOT NULL, -- {"key1": "value1", "key2": "value2", ...}
  version TEXT NOT NULL, -- Semantic version for cache busting
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE molam_translation_cache IS 'Cache des bundles JSON pour distribution via CDN';
COMMENT ON COLUMN molam_translation_cache.bundle IS 'Bundle JSON complet de toutes les traductions pour une langue';
COMMENT ON COLUMN molam_translation_cache.version IS 'Version pour cache busting (ex: 1.0.0, timestamp)';

-- ============================================================================
-- 4. TABLE: molam_user_language_prefs
-- ============================================================================
-- Préférences linguistiques utilisateur avec historique

CREATE TABLE IF NOT EXISTS molam_user_language_prefs (
  user_id UUID PRIMARY KEY REFERENCES molam_users(id) ON DELETE CASCADE,
  preferred_lang TEXT NOT NULL DEFAULT 'en' CHECK (preferred_lang IN ('fr','en','wo','ar','es')),
  fallback_lang TEXT DEFAULT 'en' CHECK (fallback_lang IN ('fr','en','wo','ar','es')),
  auto_detect BOOLEAN DEFAULT true, -- SIRA: auto-detect based on geo/history
  detected_lang TEXT CHECK (detected_lang IN ('fr','en','wo','ar','es')),
  detection_source TEXT, -- "geo", "browser", "phone", "history"
  last_changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_lang_prefs_lang ON molam_user_language_prefs(preferred_lang);

COMMENT ON TABLE molam_user_language_prefs IS 'Préférences linguistiques utilisateur avec support SIRA';
COMMENT ON COLUMN molam_user_language_prefs.auto_detect IS 'Active la détection automatique via SIRA (géo + historique)';
COMMENT ON COLUMN molam_user_language_prefs.detected_lang IS 'Langue détectée automatiquement par SIRA';

-- ============================================================================
-- 5. TABLE: molam_translation_stats
-- ============================================================================
-- Statistiques d'utilisation des traductions (observabilité)

CREATE TABLE IF NOT EXISTS molam_translation_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lang TEXT NOT NULL CHECK (lang IN ('fr','en','wo','ar','es')),
  key TEXT NOT NULL,
  request_count INTEGER DEFAULT 0,
  missing_count INTEGER DEFAULT 0, -- Clé demandée mais manquante
  last_requested_at TIMESTAMPTZ,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (lang, key, date)
);

CREATE INDEX idx_translation_stats_lang_date ON molam_translation_stats(lang, date DESC);
CREATE INDEX idx_translation_stats_missing ON molam_translation_stats(missing_count DESC) WHERE missing_count > 0;

COMMENT ON TABLE molam_translation_stats IS 'Métriques d''utilisation des traductions pour observabilité';
COMMENT ON COLUMN molam_translation_stats.missing_count IS 'Nombre de fois où la clé était manquante (alerte si > 5%)';

-- ============================================================================
-- 6. FUNCTIONS
-- ============================================================================

-- 6.1. get_translation: Récupère une traduction avec fallback
CREATE OR REPLACE FUNCTION get_translation(
  p_key TEXT,
  p_lang TEXT,
  p_fallback_lang TEXT DEFAULT 'en'
) RETURNS TEXT AS $$
DECLARE
  v_value TEXT;
BEGIN
  -- Try requested language
  SELECT value INTO v_value
  FROM molam_translations
  WHERE key = p_key AND lang = p_lang;

  IF v_value IS NOT NULL THEN
    RETURN v_value;
  END IF;

  -- Fallback to fallback_lang
  SELECT value INTO v_value
  FROM molam_translations
  WHERE key = p_key AND lang = p_fallback_lang;

  IF v_value IS NOT NULL THEN
    RETURN v_value;
  END IF;

  -- Return key if not found
  RETURN p_key;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_translation IS 'Récupère traduction avec fallback automatique vers langue de secours';

-- 6.2. get_translation_bundle: Génère bundle JSON pour une langue
CREATE OR REPLACE FUNCTION get_translation_bundle(p_lang TEXT)
RETURNS JSONB AS $$
DECLARE
  v_bundle JSONB;
BEGIN
  SELECT jsonb_object_agg(key, value)
  INTO v_bundle
  FROM molam_translations
  WHERE lang = p_lang;

  RETURN COALESCE(v_bundle, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_translation_bundle IS 'Génère bundle JSON complet pour une langue';

-- 6.3. refresh_translation_cache: Régénère le cache pour toutes les langues
CREATE OR REPLACE FUNCTION refresh_translation_cache()
RETURNS TABLE(lang TEXT, count INTEGER) AS $$
DECLARE
  v_lang TEXT;
  v_bundle JSONB;
  v_version TEXT;
  v_count INTEGER;
BEGIN
  v_version := EXTRACT(EPOCH FROM NOW())::TEXT; -- Timestamp as version

  FOR v_lang IN SELECT DISTINCT t.lang FROM molam_translations t LOOP
    v_bundle := get_translation_bundle(v_lang);
    v_count := jsonb_object_keys(v_bundle)::TEXT[] |> array_length(1);

    INSERT INTO molam_translation_cache (lang, bundle, version, generated_at)
    VALUES (v_lang, v_bundle, v_version, NOW())
    ON CONFLICT (lang) DO UPDATE
    SET bundle = EXCLUDED.bundle,
        version = EXCLUDED.version,
        generated_at = EXCLUDED.generated_at;

    RETURN QUERY SELECT v_lang, v_count;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_translation_cache IS 'Régénère le cache de tous les bundles de traductions';

-- 6.4. get_missing_translations: Identifie les clés manquantes pour une langue
CREATE OR REPLACE FUNCTION get_missing_translations(p_lang TEXT)
RETURNS TABLE(key TEXT, reference_lang TEXT, reference_value TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    t.key,
    'en'::TEXT AS reference_lang,
    t.value AS reference_value
  FROM molam_translations t
  WHERE t.lang = 'en'
    AND NOT EXISTS (
      SELECT 1 FROM molam_translations t2
      WHERE t2.key = t.key AND t2.lang = p_lang
    )
  ORDER BY t.key;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_missing_translations IS 'Liste les clés manquantes pour une langue (par rapport à l''anglais)';

-- 6.5. log_translation_change: Enregistre modification dans historique
CREATE OR REPLACE FUNCTION log_translation_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO molam_translation_history
      (translation_id, key, lang, old_value, new_value, changed_by, change_type, changed_at)
    VALUES
      (NEW.id, NEW.key, NEW.lang, NULL, NEW.value, NEW.created_by, 'create', NOW());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO molam_translation_history
      (translation_id, key, lang, old_value, new_value, changed_by, change_type, changed_at)
    VALUES
      (NEW.id, NEW.key, NEW.lang, OLD.value, NEW.value, NEW.updated_by, 'update', NOW());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO molam_translation_history
      (translation_id, key, lang, old_value, new_value, changed_by, change_type, changed_at)
    VALUES
      (OLD.id, OLD.key, OLD.lang, OLD.value, NULL, OLD.updated_by, 'delete', NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour audit automatique
CREATE TRIGGER trg_translation_changes
AFTER INSERT OR UPDATE OR DELETE ON molam_translations
FOR EACH ROW EXECUTE FUNCTION log_translation_change();

-- 6.6. update_translation_timestamp: Met à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_translation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_translation_timestamp
BEFORE UPDATE ON molam_translations
FOR EACH ROW EXECUTE FUNCTION update_translation_timestamp();

-- ============================================================================
-- 7. PRELOAD: Common translations for all 5 languages
-- ============================================================================

-- Common keys: Home
INSERT INTO molam_translations (key, lang, value, category, platform) VALUES
  -- Welcome messages
  ('home.welcome', 'en', 'Welcome to Molam', 'home', 'all'),
  ('home.welcome', 'fr', 'Bienvenue sur Molam', 'home', 'all'),
  ('home.welcome', 'wo', 'Dalal ak jamm ci Molam', 'home', 'all'),
  ('home.welcome', 'ar', 'مرحبا بك في مولام', 'home', 'all'),
  ('home.welcome', 'es', 'Bienvenido a Molam', 'home', 'all'),

  ('home.tagline', 'en', 'Your all-in-one super app', 'home', 'all'),
  ('home.tagline', 'fr', 'Votre super app tout-en-un', 'home', 'all'),
  ('home.tagline', 'wo', 'Sa super app bu am solo', 'home', 'all'),
  ('home.tagline', 'ar', 'تطبيقك الشامل الكل في واحد', 'home', 'all'),
  ('home.tagline', 'es', 'Tu super app todo en uno', 'home', 'all');

-- Auth keys
INSERT INTO molam_translations (key, lang, value, category, platform) VALUES
  ('auth.login.title', 'en', 'Log in', 'auth', 'all'),
  ('auth.login.title', 'fr', 'Connexion', 'auth', 'all'),
  ('auth.login.title', 'wo', 'Dugg', 'auth', 'all'),
  ('auth.login.title', 'ar', 'تسجيل الدخول', 'auth', 'all'),
  ('auth.login.title', 'es', 'Iniciar sesión', 'auth', 'all'),

  ('auth.login.email', 'en', 'Email or Phone', 'auth', 'all'),
  ('auth.login.email', 'fr', 'Email ou Téléphone', 'auth', 'all'),
  ('auth.login.email', 'wo', 'Email walla Telefon', 'auth', 'all'),
  ('auth.login.email', 'ar', 'البريد الإلكتروني أو الهاتف', 'auth', 'all'),
  ('auth.login.email', 'es', 'Correo o Teléfono', 'auth', 'all'),

  ('auth.login.password', 'en', 'Password', 'auth', 'all'),
  ('auth.login.password', 'fr', 'Mot de passe', 'auth', 'all'),
  ('auth.login.password', 'wo', 'Batal bu gaaw', 'auth', 'all'),
  ('auth.login.password', 'ar', 'كلمة المرور', 'auth', 'all'),
  ('auth.login.password', 'es', 'Contraseña', 'auth', 'all'),

  ('auth.login.submit', 'en', 'Sign in', 'auth', 'all'),
  ('auth.login.submit', 'fr', 'Se connecter', 'auth', 'all'),
  ('auth.login.submit', 'wo', 'Dugg', 'auth', 'all'),
  ('auth.login.submit', 'ar', 'دخول', 'auth', 'all'),
  ('auth.login.submit', 'es', 'Entrar', 'auth', 'all'),

  ('auth.signup.title', 'en', 'Create account', 'auth', 'all'),
  ('auth.signup.title', 'fr', 'Créer un compte', 'auth', 'all'),
  ('auth.signup.title', 'wo', 'Sos konte', 'auth', 'all'),
  ('auth.signup.title', 'ar', 'إنشاء حساب', 'auth', 'all'),
  ('auth.signup.title', 'es', 'Crear cuenta', 'auth', 'all'),

  ('auth.forgot_password', 'en', 'Forgot password?', 'auth', 'all'),
  ('auth.forgot_password', 'fr', 'Mot de passe oublié?', 'auth', 'all'),
  ('auth.forgot_password', 'wo', 'Fatte nga sa batal?', 'auth', 'all'),
  ('auth.forgot_password', 'ar', 'نسيت كلمة المرور؟', 'auth', 'all'),
  ('auth.forgot_password', 'es', '¿Olvidaste tu contraseña?', 'auth', 'all');

-- Settings keys
INSERT INTO molam_translations (key, lang, value, category, platform) VALUES
  ('settings.language', 'en', 'Language', 'settings', 'all'),
  ('settings.language', 'fr', 'Langue', 'settings', 'all'),
  ('settings.language', 'wo', 'Làkk', 'settings', 'all'),
  ('settings.language', 'ar', 'اللغة', 'settings', 'all'),
  ('settings.language', 'es', 'Idioma', 'settings', 'all'),

  ('settings.currency', 'en', 'Currency', 'settings', 'all'),
  ('settings.currency', 'fr', 'Devise', 'settings', 'all'),
  ('settings.currency', 'wo', 'Xaalis', 'settings', 'all'),
  ('settings.currency', 'ar', 'العملة', 'settings', 'all'),
  ('settings.currency', 'es', 'Moneda', 'settings', 'all'),

  ('settings.save', 'en', 'Save', 'settings', 'all'),
  ('settings.save', 'fr', 'Enregistrer', 'settings', 'all'),
  ('settings.save', 'wo', 'Dëkk', 'settings', 'all'),
  ('settings.save', 'ar', 'حفظ', 'settings', 'all'),
  ('settings.save', 'es', 'Guardar', 'settings', 'all'),

  ('settings.cancel', 'en', 'Cancel', 'settings', 'all'),
  ('settings.cancel', 'fr', 'Annuler', 'settings', 'all'),
  ('settings.cancel', 'wo', 'Dox', 'settings', 'all'),
  ('settings.cancel', 'ar', 'إلغاء', 'settings', 'all'),
  ('settings.cancel', 'es', 'Cancelar', 'settings', 'all');

-- Modules (Molam Pay, Eats, etc.)
INSERT INTO molam_translations (key, lang, value, category, platform) VALUES
  ('modules.pay', 'en', 'Pay', 'modules', 'all'),
  ('modules.pay', 'fr', 'Pay', 'modules', 'all'),
  ('modules.pay', 'wo', 'Pay', 'modules', 'all'),
  ('modules.pay', 'ar', 'الدفع', 'modules', 'all'),
  ('modules.pay', 'es', 'Pago', 'modules', 'all'),

  ('modules.eats', 'en', 'Eats', 'modules', 'all'),
  ('modules.eats', 'fr', 'Eats', 'modules', 'all'),
  ('modules.eats', 'wo', 'Eats', 'modules', 'all'),
  ('modules.eats', 'ar', 'الطعام', 'modules', 'all'),
  ('modules.eats', 'es', 'Comida', 'modules', 'all'),

  ('modules.shop', 'en', 'Shop', 'modules', 'all'),
  ('modules.shop', 'fr', 'Shop', 'modules', 'all'),
  ('modules.shop', 'wo', 'Shop', 'modules', 'all'),
  ('modules.shop', 'ar', 'التسوق', 'modules', 'all'),
  ('modules.shop', 'es', 'Tienda', 'modules', 'all'),

  ('modules.talk', 'en', 'Talk', 'modules', 'all'),
  ('modules.talk', 'fr', 'Talk', 'modules', 'all'),
  ('modules.talk', 'wo', 'Talk', 'modules', 'all'),
  ('modules.talk', 'ar', 'الدردشة', 'modules', 'all'),
  ('modules.talk', 'es', 'Chat', 'modules', 'all'),

  ('modules.ads', 'en', 'Ads', 'modules', 'all'),
  ('modules.ads', 'fr', 'Ads', 'modules', 'all'),
  ('modules.ads', 'wo', 'Ads', 'modules', 'all'),
  ('modules.ads', 'ar', 'الإعلانات', 'modules', 'all'),
  ('modules.ads', 'es', 'Anuncios', 'modules', 'all'),

  ('modules.free', 'en', 'Free', 'modules', 'all'),
  ('modules.free', 'fr', 'Free', 'modules', 'all'),
  ('modules.free', 'wo', 'Free', 'modules', 'all'),
  ('modules.free', 'ar', 'مجاني', 'modules', 'all'),
  ('modules.free', 'es', 'Gratis', 'modules', 'all');

-- Error messages
INSERT INTO molam_translations (key, lang, value, category, platform) VALUES
  ('errors.network', 'en', 'Network error. Please try again.', 'errors', 'all'),
  ('errors.network', 'fr', 'Erreur réseau. Veuillez réessayer.', 'errors', 'all'),
  ('errors.network', 'wo', 'Jumtukaay bu internet. Jéemaleen.', 'errors', 'all'),
  ('errors.network', 'ar', 'خطأ في الشبكة. يرجى المحاولة مرة أخرى.', 'errors', 'all'),
  ('errors.network', 'es', 'Error de red. Por favor, inténtalo de nuevo.', 'errors', 'all'),

  ('errors.invalid_credentials', 'en', 'Invalid email or password', 'errors', 'all'),
  ('errors.invalid_credentials', 'fr', 'Email ou mot de passe invalide', 'errors', 'all'),
  ('errors.invalid_credentials', 'wo', 'Email walla batal bu bon', 'errors', 'all'),
  ('errors.invalid_credentials', 'ar', 'البريد الإلكتروني أو كلمة المرور غير صحيحة', 'errors', 'all'),
  ('errors.invalid_credentials', 'es', 'Correo o contraseña inválidos', 'errors', 'all'),

  ('errors.server_error', 'en', 'Server error. Please try later.', 'errors', 'all'),
  ('errors.server_error', 'fr', 'Erreur serveur. Réessayez plus tard.', 'errors', 'all'),
  ('errors.server_error', 'wo', 'Jumtukaay bu serveur. Jéemaleen ci kanam.', 'errors', 'all'),
  ('errors.server_error', 'ar', 'خطأ في الخادم. يرجى المحاولة لاحقا.', 'errors', 'all'),
  ('errors.server_error', 'es', 'Error del servidor. Inténtalo más tarde.', 'errors', 'all');

-- Success messages
INSERT INTO molam_translations (key, lang, value, category, platform) VALUES
  ('success.saved', 'en', 'Successfully saved', 'success', 'all'),
  ('success.saved', 'fr', 'Enregistré avec succès', 'success', 'all'),
  ('success.saved', 'wo', 'Dëkkoon na bu baax', 'success', 'all'),
  ('success.saved', 'ar', 'تم الحفظ بنجاح', 'success', 'all'),
  ('success.saved', 'es', 'Guardado exitosamente', 'success', 'all'),

  ('success.login', 'en', 'Welcome back!', 'success', 'all'),
  ('success.login', 'fr', 'Bon retour!', 'success', 'all'),
  ('success.login', 'wo', 'Dalal ak jamm!', 'success', 'all'),
  ('success.login', 'ar', 'مرحبا بعودتك!', 'success', 'all'),
  ('success.login', 'es', '¡Bienvenido de nuevo!', 'success', 'all');

-- Language names (for language picker)
INSERT INTO molam_translations (key, lang, value, category, platform) VALUES
  ('lang.french', 'en', 'French', 'languages', 'all'),
  ('lang.french', 'fr', 'Français', 'languages', 'all'),
  ('lang.french', 'wo', 'Faransee', 'languages', 'all'),
  ('lang.french', 'ar', 'الفرنسية', 'languages', 'all'),
  ('lang.french', 'es', 'Francés', 'languages', 'all'),

  ('lang.english', 'en', 'English', 'languages', 'all'),
  ('lang.english', 'fr', 'Anglais', 'languages', 'all'),
  ('lang.english', 'wo', 'Angale', 'languages', 'all'),
  ('lang.english', 'ar', 'الإنجليزية', 'languages', 'all'),
  ('lang.english', 'es', 'Inglés', 'languages', 'all'),

  ('lang.wolof', 'en', 'Wolof', 'languages', 'all'),
  ('lang.wolof', 'fr', 'Wolof', 'languages', 'all'),
  ('lang.wolof', 'wo', 'Wolof', 'languages', 'all'),
  ('lang.wolof', 'ar', 'الولوفية', 'languages', 'all'),
  ('lang.wolof', 'es', 'Wolof', 'languages', 'all'),

  ('lang.arabic', 'en', 'Arabic', 'languages', 'all'),
  ('lang.arabic', 'fr', 'Arabe', 'languages', 'all'),
  ('lang.arabic', 'wo', 'Arab', 'languages', 'all'),
  ('lang.arabic', 'ar', 'العربية', 'languages', 'all'),
  ('lang.arabic', 'es', 'Árabe', 'languages', 'all'),

  ('lang.spanish', 'en', 'Spanish', 'languages', 'all'),
  ('lang.spanish', 'fr', 'Espagnol', 'languages', 'all'),
  ('lang.spanish', 'wo', 'Español', 'languages', 'all'),
  ('lang.spanish', 'ar', 'الإسبانية', 'languages', 'all'),
  ('lang.spanish', 'es', 'Español', 'languages', 'all');

-- ============================================================================
-- 8. INITIAL CACHE GENERATION
-- ============================================================================

-- Generate initial cache for all languages
SELECT * FROM refresh_translation_cache();

-- ============================================================================
-- 9. GRANTS (adjust as needed)
-- ============================================================================

-- Public can read translations
GRANT SELECT ON molam_translations TO PUBLIC;
GRANT SELECT ON molam_translation_cache TO PUBLIC;

-- Only authenticated users can see their own language prefs
-- (RLS policies can be added if needed)

-- ============================================================================
-- 10. COMMENTS & DOCUMENTATION
-- ============================================================================

COMMENT ON DATABASE current_database() IS
'Brique 27: Infrastructure i18n complète avec support fr, en, wo, ar, es + fallback';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
