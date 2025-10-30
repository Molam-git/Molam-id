-- ============================================================================
-- RBAC Seed Data - Roles and Permissions
-- ============================================================================

-- ============================================================================
-- 1. PERMISSIONS
-- ============================================================================

-- ID Module Permissions
INSERT INTO molam_permissions (id, code, description, module, resource_type, action) VALUES
(gen_random_uuid(), 'id.profile.read', 'Read own profile', 'id', 'profile', 'read'),
(gen_random_uuid(), 'id.profile.update', 'Update own profile', 'id', 'profile', 'update'),
(gen_random_uuid(), 'id.profile.delete', 'Delete own profile', 'id', 'profile', 'delete'),
(gen_random_uuid(), 'id.export.self', 'Export own data', 'id', 'export', 'execute'),
(gen_random_uuid(), 'id.export.any', 'Export any user data', 'id', 'export', 'execute'),
(gen_random_uuid(), 'id.users.read', 'Read user list', 'id', 'users', 'read'),
(gen_random_uuid(), 'id.users.create', 'Create users', 'id', 'users', 'create'),
(gen_random_uuid(), 'id.users.update', 'Update users', 'id', 'users', 'update'),
(gen_random_uuid(), 'id.users.delete', 'Delete users', 'id', 'users', 'delete'),
(gen_random_uuid(), 'id.audit.read', 'Read audit logs', 'id', 'audit', 'read')
ON CONFLICT (code) DO NOTHING;

-- Pay Module Permissions
INSERT INTO molam_permissions (id, code, description, module, resource_type, action) VALUES
(gen_random_uuid(), 'pay.transfer.create', 'Create P2P transfer', 'pay', 'transfer', 'create'),
(gen_random_uuid(), 'pay.transfer.read', 'Read transfers', 'pay', 'transfer', 'read'),
(gen_random_uuid(), 'pay.transfer.approve', 'Approve large transfers', 'pay', 'transfer', 'approve'),
(gen_random_uuid(), 'pay.cashin.create', 'Cash in', 'pay', 'cashin', 'create'),
(gen_random_uuid(), 'pay.cashout.create', 'Cash out', 'pay', 'cashout', 'create'),
(gen_random_uuid(), 'pay.merchant.payment', 'Pay merchant', 'pay', 'merchant', 'create'),
(gen_random_uuid(), 'pay.balance.read', 'Read balance', 'pay', 'balance', 'read'),
(gen_random_uuid(), 'pay.transactions.read', 'Read transaction history', 'pay', 'transactions', 'read'),
(gen_random_uuid(), 'pay.reports.read', 'Read financial reports', 'pay', 'reports', 'read'),
(gen_random_uuid(), 'pay.admin.manage', 'Manage Pay module', 'pay', 'admin', 'execute')
ON CONFLICT (code) DO NOTHING;

-- Eats Module Permissions
INSERT INTO molam_permissions (id, code, description, module, resource_type, action) VALUES
(gen_random_uuid(), 'eats.order.create', 'Create food order', 'eats', 'order', 'create'),
(gen_random_uuid(), 'eats.order.read', 'Read orders', 'eats', 'order', 'read'),
(gen_random_uuid(), 'eats.order.update', 'Update order status', 'eats', 'order', 'update'),
(gen_random_uuid(), 'eats.menu.read', 'Read restaurant menus', 'eats', 'menu', 'read'),
(gen_random_uuid(), 'eats.menu.manage', 'Manage restaurant menus', 'eats', 'menu', 'update'),
(gen_random_uuid(), 'eats.admin.manage', 'Manage Eats module', 'eats', 'admin', 'execute')
ON CONFLICT (code) DO NOTHING;

-- Talk Module Permissions
INSERT INTO molam_permissions (id, code, description, module, resource_type, action) VALUES
(gen_random_uuid(), 'talk.message.create', 'Send messages', 'talk', 'message', 'create'),
(gen_random_uuid(), 'talk.message.read', 'Read messages', 'talk', 'message', 'read'),
(gen_random_uuid(), 'talk.post.create', 'Create social posts', 'talk', 'post', 'create'),
(gen_random_uuid(), 'talk.post.delete', 'Delete posts', 'talk', 'post', 'delete'),
(gen_random_uuid(), 'talk.moderation.execute', 'Moderate content', 'talk', 'moderation', 'execute'),
(gen_random_uuid(), 'talk.admin.manage', 'Manage Talk module', 'talk', 'admin', 'execute')
ON CONFLICT (code) DO NOTHING;

-- Ads Module Permissions
INSERT INTO molam_permissions (id, code, description, module, resource_type, action) VALUES
(gen_random_uuid(), 'ads.campaign.create', 'Create ad campaigns', 'ads', 'campaign', 'create'),
(gen_random_uuid(), 'ads.campaign.read', 'Read campaigns', 'ads', 'campaign', 'read'),
(gen_random_uuid(), 'ads.campaign.update', 'Update campaigns', 'ads', 'campaign', 'update'),
(gen_random_uuid(), 'ads.campaign.delete', 'Delete campaigns', 'ads', 'campaign', 'delete'),
(gen_random_uuid(), 'ads.admin.manage', 'Manage Ads module', 'ads', 'admin', 'execute')
ON CONFLICT (code) DO NOTHING;

-- Shop Module Permissions
INSERT INTO molam_permissions (id, code, description, module, resource_type, action) VALUES
(gen_random_uuid(), 'shop.product.read', 'Browse products', 'shop', 'product', 'read'),
(gen_random_uuid(), 'shop.product.create', 'Create products', 'shop', 'product', 'create'),
(gen_random_uuid(), 'shop.order.create', 'Create orders', 'shop', 'order', 'create'),
(gen_random_uuid(), 'shop.order.read', 'Read orders', 'shop', 'order', 'read'),
(gen_random_uuid(), 'shop.admin.manage', 'Manage Shop module', 'shop', 'admin', 'execute')
ON CONFLICT (code) DO NOTHING;

-- Free Module Permissions
INSERT INTO molam_permissions (id, code, description, module, resource_type, action) VALUES
(gen_random_uuid(), 'free.content.read', 'Access free content', 'free', 'content', 'read'),
(gen_random_uuid(), 'free.admin.manage', 'Manage Free module', 'free', 'admin', 'execute')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. ROLES - EXTERNAL (Users)
-- ============================================================================

-- Client (Regular User)
INSERT INTO molam_roles_v2 (id, name, display_name, description, role_type, module_scope, priority, is_system) VALUES
(gen_random_uuid(), 'client', 'Client', 'Regular user with basic permissions', 'external', 'global', 10, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Agent (Cash in/out partner)
INSERT INTO molam_roles_v2 (id, name, display_name, description, role_type, module_scope, priority, is_system) VALUES
(gen_random_uuid(), 'agent', 'Agent Partenaire', 'Agent for cash in/out operations', 'external', 'pay', 20, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Merchant
INSERT INTO molam_roles_v2 (id, name, display_name, description, role_type, module_scope, priority, is_system) VALUES
(gen_random_uuid(), 'merchant', 'Marchand', 'Merchant for accepting payments', 'external', 'pay', 20, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Bank Partner
INSERT INTO molam_roles_v2 (id, name, display_name, description, role_type, module_scope, priority, is_system) VALUES
(gen_random_uuid(), 'bank', 'Banque Partenaire', 'Bank partner with limited reporting access', 'external', 'pay', 30, TRUE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 3. ROLES - INTERNAL (Employees)
-- ============================================================================

-- Super Admin (Global)
INSERT INTO molam_roles_v2 (id, name, display_name, description, role_type, module_scope, priority, is_system) VALUES
(gen_random_uuid(), 'super_admin', 'Super Admin', 'Global administrator with all permissions', 'internal', 'global', 100, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Pay Admin
INSERT INTO molam_roles_v2 (id, name, display_name, description, role_type, module_scope, priority, is_system) VALUES
(gen_random_uuid(), 'pay_admin', 'Admin Pay', 'Administrator for Pay module', 'internal', 'pay', 80, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Eats Admin
INSERT INTO molam_roles_v2 (id, name, display_name, description, role_type, module_scope, priority, is_system) VALUES
(gen_random_uuid(), 'eats_admin', 'Admin Eats', 'Administrator for Eats module', 'internal', 'eats', 80, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Talk Admin
INSERT INTO molam_roles_v2 (id, name, display_name, description, role_type, module_scope, priority, is_system) VALUES
(gen_random_uuid(), 'talk_admin', 'Admin Talk', 'Administrator for Talk module', 'internal', 'talk', 80, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Ads Admin
INSERT INTO molam_roles_v2 (id, name, display_name, description, role_type, module_scope, priority, is_system) VALUES
(gen_random_uuid(), 'ads_admin', 'Admin Ads', 'Administrator for Ads module', 'internal', 'ads', 80, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Shop Admin
INSERT INTO molam_roles_v2 (id, name, display_name, description, role_type, module_scope, priority, is_system) VALUES
(gen_random_uuid(), 'shop_admin', 'Admin Shop', 'Administrator for Shop module', 'internal', 'shop', 80, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Auditor
INSERT INTO molam_roles_v2 (id, name, display_name, description, role_type, module_scope, priority, is_system) VALUES
(gen_random_uuid(), 'auditor', 'Auditeur', 'Read-only auditor with justification requirement', 'internal', 'global', 70, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Marketer
INSERT INTO molam_roles_v2 (id, name, display_name, description, role_type, module_scope, priority, is_system) VALUES
(gen_random_uuid(), 'marketer', 'Marketeur', 'Marketing team member', 'internal', 'ads', 50, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Commercial
INSERT INTO molam_roles_v2 (id, name, display_name, description, role_type, module_scope, priority, is_system) VALUES
(gen_random_uuid(), 'commercial', 'Commercial', 'Sales team member', 'internal', 'global', 50, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Support
INSERT INTO molam_roles_v2 (id, name, display_name, description, role_type, module_scope, priority, is_system) VALUES
(gen_random_uuid(), 'support', 'Support Client', 'Customer support agent', 'internal', 'global', 40, TRUE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 4. ROLE-PERMISSION ASSIGNMENTS
-- ============================================================================

-- CLIENT PERMISSIONS
INSERT INTO molam_role_permissions (role_id, perm_id)
SELECT
  (SELECT id FROM molam_roles_v2 WHERE name = 'client'),
  p.id
FROM molam_permissions p
WHERE p.code IN (
  'id.profile.read',
  'id.profile.update',
  'id.export.self',
  'pay.transfer.create',
  'pay.transfer.read',
  'pay.balance.read',
  'pay.transactions.read',
  'pay.merchant.payment',
  'eats.order.create',
  'eats.order.read',
  'eats.menu.read',
  'talk.message.create',
  'talk.message.read',
  'talk.post.create',
  'shop.product.read',
  'shop.order.create',
  'shop.order.read',
  'free.content.read'
)
ON CONFLICT DO NOTHING;

-- AGENT PERMISSIONS
INSERT INTO molam_role_permissions (role_id, perm_id)
SELECT
  (SELECT id FROM molam_roles_v2 WHERE name = 'agent'),
  p.id
FROM molam_permissions p
WHERE p.code IN (
  'id.profile.read',
  'id.profile.update',
  'pay.cashin.create',
  'pay.cashout.create',
  'pay.transactions.read',
  'pay.balance.read'
)
ON CONFLICT DO NOTHING;

-- MERCHANT PERMISSIONS
INSERT INTO molam_role_permissions (role_id, perm_id)
SELECT
  (SELECT id FROM molam_roles_v2 WHERE name = 'merchant'),
  p.id
FROM molam_permissions p
WHERE p.code IN (
  'id.profile.read',
  'id.profile.update',
  'pay.transactions.read',
  'pay.balance.read',
  'pay.reports.read',
  'eats.menu.manage',
  'eats.order.read',
  'eats.order.update',
  'shop.product.create',
  'shop.order.read'
)
ON CONFLICT DO NOTHING;

-- BANK PERMISSIONS
INSERT INTO molam_role_permissions (role_id, perm_id)
SELECT
  (SELECT id FROM molam_roles_v2 WHERE name = 'bank'),
  p.id
FROM molam_permissions p
WHERE p.code IN (
  'pay.reports.read'
)
ON CONFLICT DO NOTHING;

-- SUPER_ADMIN PERMISSIONS (all permissions)
INSERT INTO molam_role_permissions (role_id, perm_id)
SELECT
  (SELECT id FROM molam_roles_v2 WHERE name = 'super_admin'),
  p.id
FROM molam_permissions p
ON CONFLICT DO NOTHING;

-- PAY_ADMIN PERMISSIONS
INSERT INTO molam_role_permissions (role_id, perm_id)
SELECT
  (SELECT id FROM molam_roles_v2 WHERE name = 'pay_admin'),
  p.id
FROM molam_permissions p
WHERE p.module = 'pay' OR p.code LIKE 'id.%'
ON CONFLICT DO NOTHING;

-- EATS_ADMIN PERMISSIONS
INSERT INTO molam_role_permissions (role_id, perm_id)
SELECT
  (SELECT id FROM molam_roles_v2 WHERE name = 'eats_admin'),
  p.id
FROM molam_permissions p
WHERE p.module = 'eats' OR p.code LIKE 'id.%'
ON CONFLICT DO NOTHING;

-- TALK_ADMIN PERMISSIONS
INSERT INTO molam_role_permissions (role_id, perm_id)
SELECT
  (SELECT id FROM molam_roles_v2 WHERE name = 'talk_admin'),
  p.id
FROM molam_permissions p
WHERE p.module = 'talk' OR p.code LIKE 'id.%'
ON CONFLICT DO NOTHING;

-- AUDITOR PERMISSIONS (read-only)
INSERT INTO molam_role_permissions (role_id, perm_id)
SELECT
  (SELECT id FROM molam_roles_v2 WHERE name = 'auditor'),
  p.id
FROM molam_permissions p
WHERE p.action IN ('read', 'audit')
ON CONFLICT DO NOTHING;

-- SUPPORT PERMISSIONS
INSERT INTO molam_role_permissions (role_id, perm_id)
SELECT
  (SELECT id FROM molam_roles_v2 WHERE name = 'support'),
  p.id
FROM molam_permissions p
WHERE p.code IN (
  'id.users.read',
  'id.profile.read',
  'pay.transactions.read',
  'eats.order.read',
  'shop.order.read'
)
ON CONFLICT DO NOTHING;
