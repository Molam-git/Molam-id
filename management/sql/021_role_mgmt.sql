-- 1) Extension (si nécessaire)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2) Table des niveaux de confiance par rôle (empêche l'escalade)
ALTER TABLE IF EXISTS molam_roles_v2
  ADD COLUMN IF NOT EXISTS trusted_level SMALLINT DEFAULT 10 CHECK (trusted_level >= 0);

-- 3) Table d'approbation optionnelle pour les rôles sensibles
CREATE TABLE IF NOT EXISTS molam_role_grants_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role_id UUID NOT NULL,
  requested_by UUID NOT NULL,
  approver_required BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID NULL,
  approved_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (request_id)
);

-- 4) Table d'idempotence (anti-double clic)
CREATE TABLE IF NOT EXISTS molam_idempotency_keys (
  key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  response_code INT,
  response_body JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) Fonctions de garde (SECURITY DEFINER)

-- Vérifie que l'admin (actor_id) peut gérer le scope demandé
CREATE OR REPLACE FUNCTION can_manage_scope(actor_id UUID, scope TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  cnt INT;
BEGIN
  IF scope = 'global' THEN
    SELECT COUNT(*) INTO cnt
    FROM molam_user_roles ur
    JOIN molam_roles_v2 r ON r.id = ur.role_id
    WHERE ur.user_id = actor_id AND r.name = 'super_admin' AND r.module_scope='global';
    RETURN cnt > 0;
  ELSE
    SELECT COUNT(*) INTO cnt
    FROM molam_user_roles ur
    JOIN molam_roles_v2 r ON r.id = ur.role_id
    WHERE ur.user_id = actor_id AND r.name = scope || '_admin' AND r.module_scope = scope;
    RETURN cnt > 0;
  END IF;
END $$;

-- Vérifie la hiérarchie trusted_level
CREATE OR REPLACE FUNCTION has_higher_trust(actor_id UUID, target_role_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  actor_tl SMALLINT;
  target_tl SMALLINT;
BEGIN
  SELECT MIN(r.trusted_level) INTO actor_tl
  FROM molam_user_roles ur
  JOIN molam_roles_v2 r ON r.id = ur.role_id
  WHERE ur.user_id = actor_id;

  SELECT trusted_level INTO target_tl FROM molam_roles_v2 WHERE id = target_role_id;

  IF actor_tl IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN actor_tl > target_tl;
END $$;

-- 6) Vue pratique pour audit
CREATE OR REPLACE VIEW v_user_roles AS
SELECT u.id AS user_id, u.email, u.phone_e164, r.id AS role_id, r.name, r.module_scope, r.trusted_level,
       ur.created_at, ur.granted_by
FROM molam_user_roles ur
JOIN molam_users u ON u.id = ur.user_id
JOIN molam_roles_v2 r ON r.id = ur.role_id;

-- 7) Indexation
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON molam_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON molam_user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_roles_scope ON molam_roles_v2(module_scope, trusted_level);