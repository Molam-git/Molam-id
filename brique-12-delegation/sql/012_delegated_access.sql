-- 012_delegated_access.sql
-- Brique 12: Delegated Access / Role by Context

CREATE TYPE delegation_status AS ENUM ('pending','active','revoked','expired');

-- Délégations d'accès temporaires et contextuelles
CREATE TABLE IF NOT EXISTS molam_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  granter_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  grantee_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,                          -- pay, eats, shop, ads, talk, free
  role TEXT NOT NULL,                            -- ex: 'cashier', 'auditor', 'pay_admin'
  country_code CHAR(3) NOT NULL,                 -- ISO3 ex: SEN, CIV, GHA
  scope JSONB,                                   -- ex: {"limit":100000,"currency":"XOF","operations":["view","approve"]}
  start_at TIMESTAMPTZ DEFAULT NOW(),
  end_at TIMESTAMPTZ,
  status delegation_status DEFAULT 'pending',
  approvers UUID[],                              -- utilisateurs qui doivent valider
  approval_required_count SMALLINT DEFAULT 1,     -- nombre d'approbations requises
  approvals_received SMALLINT DEFAULT 0,          -- nombre d'approbations reçues
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_at IS NULL OR end_at > start_at),
  CONSTRAINT valid_approval_count CHECK (approval_required_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_delegation_grantee ON molam_delegations(grantee_id, status);
CREATE INDEX IF NOT EXISTS idx_delegation_granter ON molam_delegations(granter_id);
CREATE INDEX IF NOT EXISTS idx_delegation_status ON molam_delegations(status);
CREATE INDEX IF NOT EXISTS idx_delegation_module ON molam_delegations(module, status);
CREATE INDEX IF NOT EXISTS idx_delegation_expiry ON molam_delegations(end_at) WHERE status = 'active';

-- Approbations individuelles des délégations
CREATE TABLE IF NOT EXISTS molam_delegation_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id UUID NOT NULL REFERENCES molam_delegations(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  approved BOOLEAN NOT NULL,                     -- true = approved, false = rejected
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (delegation_id, approver_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_delegation ON molam_delegation_approvals(delegation_id);

-- Audit trail spécifique aux délégations
CREATE TABLE IF NOT EXISTS molam_delegation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id UUID REFERENCES molam_delegations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                          -- 'create','approve','reject','activate','revoke','expire','use'
  actor_id UUID,
  detail JSONB,
  ip INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delegation_audit_id ON molam_delegation_audit(delegation_id);
CREATE INDEX IF NOT EXISTS idx_delegation_audit_actor ON molam_delegation_audit(actor_id);
CREATE INDEX IF NOT EXISTS idx_delegation_audit_action ON molam_delegation_audit(action);
CREATE INDEX IF NOT EXISTS idx_delegation_audit_created ON molam_delegation_audit(created_at DESC);

-- Contextes de délégation prédéfinis (templates)
CREATE TABLE IF NOT EXISTS molam_delegation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  role TEXT NOT NULL,
  label TEXT NOT NULL,                           -- "Caissier temporaire", "Auditeur remplaçant"
  description TEXT,
  default_duration_hours INT,                    -- durée par défaut en heures
  default_scope JSONB,                           -- scope par défaut
  requires_approval BOOLEAN DEFAULT TRUE,
  min_approvers SMALLINT DEFAULT 1,
  allowed_granter_roles TEXT[],                  -- rôles autorisés à créer cette délégation
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_module ON molam_delegation_templates(module, is_active);

-- Fonction pour expirer automatiquement les délégations
CREATE OR REPLACE FUNCTION expire_delegations()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE molam_delegations
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active'
    AND end_at IS NOT NULL
    AND end_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  -- Log les expirations
  INSERT INTO molam_delegation_audit (id, delegation_id, action, detail)
  SELECT gen_random_uuid(), id, 'expire', jsonb_build_object('auto_expired', true)
  FROM molam_delegations
  WHERE status = 'expired'
    AND updated_at > NOW() - INTERVAL '1 minute';

  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Templates par défaut pour les modules principaux
INSERT INTO molam_delegation_templates (module, role, label, description, default_duration_hours, default_scope, requires_approval, min_approvers, allowed_granter_roles)
VALUES
  ('pay', 'cashier', 'Caissier temporaire', 'Délégation pour encaisser des paiements', 24, '{"limit": 50000, "currency": "XOF", "operations": ["view", "create_payment"]}', FALSE, 0, ARRAY['pay_admin', 'pay_manager']),
  ('pay', 'auditor', 'Auditeur remplaçant', 'Accès audit temporaire', 168, '{"operations": ["view", "export"]}', TRUE, 1, ARRAY['pay_admin']),
  ('pay', 'pay_admin', 'Admin Pay temporaire', 'Délégation admin complète', 48, '{"operations": ["*"]}', TRUE, 2, ARRAY['super_admin']),
  ('eats', 'delivery', 'Livreur temporaire', 'Accès livraison Eats', 72, '{"operations": ["view_orders", "update_status"]}', FALSE, 0, ARRAY['eats_manager']),
  ('shop', 'seller', 'Vendeur temporaire', 'Accès vente Shop', 48, '{"operations": ["view", "create_order"]}', FALSE, 0, ARRAY['shop_manager']),
  ('admin', 'support', 'Support client temporaire', 'Accès support utilisateurs', 24, '{"operations": ["view_users", "view_tickets"]}', TRUE, 1, ARRAY['admin'])
ON CONFLICT DO NOTHING;

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_delegation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_delegation_updated
BEFORE UPDATE ON molam_delegations
FOR EACH ROW EXECUTE FUNCTION update_delegation_updated_at();

-- Commentaires
COMMENT ON TABLE molam_delegations IS 'Délégations d''accès temporaires et contextuelles';
COMMENT ON TABLE molam_delegation_approvals IS 'Approbations individuelles des délégations';
COMMENT ON TABLE molam_delegation_audit IS 'Audit trail immuable des délégations';
COMMENT ON TABLE molam_delegation_templates IS 'Templates prédéfinis de délégations par module';
COMMENT ON FUNCTION expire_delegations() IS 'Fonction pour expirer automatiquement les délégations actives dépassant end_at';
