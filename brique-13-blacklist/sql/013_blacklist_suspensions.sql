-- Brique 13: Blacklist & Suspensions
-- Service de gestion centralisée des bannis/suspensions Molam

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Type ENUM pour scope de suspension
CREATE TYPE suspension_scope AS ENUM ('global', 'module');

-- Table principale: blacklist
CREATE TABLE molam_blacklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  scope suspension_scope DEFAULT 'global',
  module TEXT,  -- pay, eats, shop, etc. (NULL = global)
  reason TEXT NOT NULL,
  issued_by UUID NOT NULL,
  start_at TIMESTAMPTZ DEFAULT NOW(),
  end_at TIMESTAMPTZ,  -- NULL = permanent
  status TEXT DEFAULT 'active',  -- active, revoked, expired
  metadata JSONB,  -- {"fraud_score": 95, "incident_ids": [...]}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT check_module_scope CHECK (
    (scope = 'module' AND module IS NOT NULL) OR
    (scope = 'global' AND module IS NULL)
  ),
  CONSTRAINT check_dates CHECK (end_at IS NULL OR end_at > start_at)
);

-- Table audit trail (immuable)
CREATE TABLE molam_blacklist_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blacklist_id UUID,  -- Peut être NULL si blacklist supprimé
  action TEXT NOT NULL,  -- add, revoke, expire, check, update
  actor_id UUID NOT NULL,
  detail JSONB,
  ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes pour performance
CREATE INDEX idx_blacklist_user_id ON molam_blacklist(user_id);
CREATE INDEX idx_blacklist_status ON molam_blacklist(status);
CREATE INDEX idx_blacklist_module ON molam_blacklist(module) WHERE module IS NOT NULL;
CREATE INDEX idx_blacklist_scope ON molam_blacklist(scope);
CREATE INDEX idx_blacklist_dates ON molam_blacklist(start_at, end_at);
CREATE INDEX idx_blacklist_audit_user ON molam_blacklist_audit(blacklist_id);
CREATE INDEX idx_blacklist_audit_actor ON molam_blacklist_audit(actor_id);
CREATE INDEX idx_blacklist_audit_created ON molam_blacklist_audit(created_at DESC);

-- Index composite pour vérification rapide
CREATE INDEX idx_blacklist_active_check
  ON molam_blacklist(user_id, status, scope, module)
  WHERE status = 'active';

-- Fonction pour expirer les suspensions temporaires
CREATE OR REPLACE FUNCTION expire_suspensions()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE molam_blacklist
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'active'
    AND end_at IS NOT NULL
    AND end_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  -- Audit log
  IF expired_count > 0 THEN
    INSERT INTO molam_blacklist_audit (id, action, actor_id, detail)
    VALUES (
      uuid_generate_v4(),
      'expire',
      '00000000-0000-0000-0000-000000000000',
      jsonb_build_object('expired_count', expired_count)
    );
  END IF;

  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier si un utilisateur est blacklisté
CREATE OR REPLACE FUNCTION is_user_blacklisted(
  p_user_id UUID,
  p_module TEXT DEFAULT NULL
)
RETURNS TABLE (
  is_blacklisted BOOLEAN,
  scope suspension_scope,
  reason TEXT,
  blacklist_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE as is_blacklisted,
    b.scope,
    b.reason,
    b.id as blacklist_id
  FROM molam_blacklist b
  WHERE b.user_id = p_user_id
    AND b.status = 'active'
    AND (b.start_at IS NULL OR b.start_at <= NOW())
    AND (b.end_at IS NULL OR b.end_at > NOW())
    AND (
      -- Global ban
      b.scope = 'global'
      OR
      -- Module-specific ban
      (b.scope = 'module' AND b.module = p_module)
    )
  ORDER BY
    CASE WHEN b.scope = 'global' THEN 1 ELSE 2 END,
    b.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_blacklist_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_blacklist_timestamp
  BEFORE UPDATE ON molam_blacklist
  FOR EACH ROW
  EXECUTE FUNCTION update_blacklist_timestamp();

-- Commentaires
COMMENT ON TABLE molam_blacklist IS 'Blacklist centralisée pour tous les modules Molam';
COMMENT ON TABLE molam_blacklist_audit IS 'Audit trail immuable des actions blacklist';
COMMENT ON FUNCTION expire_suspensions() IS 'Expire les suspensions temporaires (à appeler via cron)';
COMMENT ON FUNCTION is_user_blacklisted(UUID, TEXT) IS 'Vérifie si un utilisateur est blacklisté (global ou module)';
