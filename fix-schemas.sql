-- ============================================================================
-- MOLAM-ID - Correctifs pour les schémas SQL
-- ============================================================================
-- Ce fichier ajoute les tables et colonnes manquantes pour corriger les erreurs

-- ============================================================================
-- 1. Brique 8 - KYC/AML: Table molam_kyc_requests (manquante)
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_kyc_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES molam_users(id) ON DELETE CASCADE,
  requested_level TEXT NOT NULL DEFAULT 'P1',
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_requests_user_id ON molam_kyc_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_requests_status ON molam_kyc_requests(status);

-- Ajouter kyc_request_id à molam_kyc_docs si la colonne n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='molam_kyc_docs' AND column_name='kyc_request_id'
  ) THEN
    ALTER TABLE molam_kyc_docs ADD COLUMN kyc_request_id UUID REFERENCES molam_kyc_requests(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_kyc_docs_request_id ON molam_kyc_docs(kyc_request_id);
  END IF;
END $$;

-- ============================================================================
-- 2. Brique 10 - Device: Corriger la structure de molam_devices
-- ============================================================================
-- Ajouter device_pk si manquant (primary key alternative)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='molam_devices' AND column_name='device_pk'
  ) THEN
    ALTER TABLE molam_devices ADD COLUMN device_pk SERIAL UNIQUE;
  END IF;
END $$;

-- ============================================================================
-- 3. Brique 18 - Update Profile: Créer le rôle molam_app
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'molam_app') THEN
    CREATE ROLE molam_app;
  END IF;
END $$;

-- ============================================================================
-- 4. Brique 19 - Export Profile: Ajouter first_name et last_name
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='molam_users' AND column_name='first_name'
  ) THEN
    ALTER TABLE molam_users ADD COLUMN first_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='molam_users' AND column_name='last_name'
  ) THEN
    ALTER TABLE molam_users ADD COLUMN last_name TEXT;
  END IF;
END $$;

-- ============================================================================
-- 5. Brique 20 - RBAC: Ajouter colonne 'code' à molam_permissions
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='molam_permissions' AND column_name='code'
  ) THEN
    ALTER TABLE molam_permissions ADD COLUMN code TEXT;
    -- Générer des codes basés sur permission_name existant
    UPDATE molam_permissions SET code = permission_name WHERE code IS NULL;
  END IF;
END $$;

-- ============================================================================
-- 6. Brique 23 - Sessions Monitoring: Créer molam_tenants
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 7. Brique 24 - SDK Auth: Créer vue molam_sessions_active
-- ============================================================================
CREATE OR REPLACE VIEW molam_sessions_active AS
SELECT * FROM molam_sessions
WHERE expires_at > NOW()
  AND revoked_at IS NULL;

-- ============================================================================
-- 8. Brique 31 - RBAC Extended: Ajouter revoked_at à molam_sessions
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='molam_sessions' AND column_name='revoked_at'
  ) THEN
    ALTER TABLE molam_sessions ADD COLUMN revoked_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- 9. Brique 29/30/32 - Profile/Export/Role Mgmt: Tables avec bonnes colonnes
-- ============================================================================
-- Créer molam_user_profiles si elle n'existe pas
CREATE TABLE IF NOT EXISTS molam_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON molam_user_profiles(user_id);

-- ============================================================================
-- 10. Colonnes additionnelles pour molam_users
-- ============================================================================
DO $$
BEGIN
  -- Ajouter is_active pour brique 34
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='molam_users' AND column_name='is_active'
  ) THEN
    ALTER TABLE molam_users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- ============================================================================
-- FIN DES CORRECTIFS
-- ============================================================================
