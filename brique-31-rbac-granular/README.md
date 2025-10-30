# Brique 31 — RBAC Granularité

> **Granular Role-Based Access Control for Multi-Subsidiary Platform**
>
> Module-scoped permissions, trust levels, temporal roles, and approval workflows for the Molam ecosystem.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Role Types & Trust Levels](#role-types--trust-levels)
4. [Modules](#modules)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [AuthZ Middleware](#authz-middleware)
8. [Installation & Setup](#installation--setup)
9. [Usage Examples](#usage-examples)
10. [Security & Compliance](#security--compliance)
11. [Testing](#testing)

---

## Overview

**Brique 31** implements a production-grade, granular RBAC (Role-Based Access Control) system designed for Molam's multi-subsidiary platform. It provides:

- **Module-Scoped Roles**: Users can have different roles per module (Pay, Eats, Shop, Talk, Ads, Free, ID, Global)
- **Fine-Grained Permissions**: Resource and action-level access control with conditional permissions
- **Trust Levels**: 0-5 trust levels for graduated access control
- **Temporal Roles**: Roles with expiration dates for contractors and temporary access
- **Approval Workflows**: Sensitive roles require approval before activation
- **Complete Audit Trail**: Every role operation is logged immutably
- **Row-Level Security**: PostgreSQL RLS ensures data isolation

### Key Features

✅ 12 predefined roles (client, agent, merchant, admin, auditor, bank, regulator, etc.)
✅ 100+ preloaded permissions covering all modules
✅ Trust-level based access control (0-5)
✅ Module separation (pay, eats, shop, talk, ads, free, id, global)
✅ Temporal roles with auto-expiration
✅ Approval workflow for sensitive roles
✅ Immutable audit logs
✅ PostgreSQL RLS for data isolation
✅ Express middleware for easy integration
✅ TypeScript with strict typing

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT APPLICATIONS                     │
│         (Web, Mobile, Desktop, HarmonyOS, Partners)         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                       API GATEWAY                            │
│              (Authentication + Rate Limiting)                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    AUTHZ MIDDLEWARE                          │
│  - requirePermission(module, resource, action)               │
│  - requireRole(roleKey, module)                              │
│  - requireTrustLevel(minLevel, module)                       │
│  - requireOwnership() / requireOwnershipOrPermission()       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      RBAC SERVICE                            │
│  - hasPermission(userId, module, resource, action, context)  │
│  - assignRole() / revokeRole()                               │
│  - approveRole() / rejectRole()                              │
│  - getUserRoles() / getUserPermissions()                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   POSTGRESQL DATABASE                        │
│  Tables:                                                     │
│  - molam_role_definitions (global role registry)            │
│  - molam_user_roles (user assignments per module)           │
│  - molam_role_permissions (fine-grained permissions)        │
│  - molam_role_audit (immutable audit log)                   │
│                                                              │
│  Functions:                                                  │
│  - has_permission() - Permission check with context         │
│  - assign_role() - Assign role to user                      │
│  - revoke_role() - Revoke role from user                    │
│  - expire_temporal_roles() - Auto-expire temporary roles    │
│                                                              │
│  Views:                                                      │
│  - v_active_roles - All active user roles                   │
│  - v_pending_role_approvals - Pending approval queue        │
│                                                              │
│  RLS: Enabled on all tables for subsidiary separation       │
└─────────────────────────────────────────────────────────────┘
```

---

## Role Types & Trust Levels

### Role Types

| Type       | Description                          | Examples                                    |
|------------|--------------------------------------|---------------------------------------------|
| `external` | External users (clients, partners)   | client, agent, merchant                     |
| `internal` | Molam employees                      | superadmin, admin, auditor, support         |
| `partner`  | Third-party integrations             | bank, regulator, auditor_external           |
| `system`   | Internal system roles                | api_key, service_account, cron_job          |

### Trust Levels (0-5)

| Level | Name              | Description                                      | Examples                       |
|-------|-------------------|--------------------------------------------------|--------------------------------|
| **0** | Unverified        | New user, no verification                        | New client                     |
| **1** | Email Verified    | Email confirmed                                  | Verified client                |
| **2** | KYC Basic         | Identity verified (ID card)                      | Client with KYC                |
| **3** | KYC Enhanced      | Enhanced verification (address, income)          | Agent, Merchant                |
| **4** | Employee          | Internal employee                                | Admin, Support, Marketer       |
| **5** | Super Admin       | Platform administrator                           | Superadmin                     |

### Predefined Roles

#### External Roles

| Role Key   | Name                     | Trust Level | Capabilities                                                     |
|------------|--------------------------|-------------|------------------------------------------------------------------|
| `client`   | Client                   | 0-2         | Send/receive money, pay bills, view transactions                 |
| `agent`    | Agent Partenaire         | 1-3         | Cash-in/cash-out operations, customer onboarding                 |
| `merchant` | Marchand/Professionnel   | 1-3         | Receive payments, view settlement reports, refunds               |

#### Internal Roles

| Role Key      | Name                       | Trust Level | Capabilities                                                  |
|---------------|----------------------------|-------------|---------------------------------------------------------------|
| `superadmin`  | Super Administrateur       | 5           | Full platform access, manage all subsidiaries                 |
| `admin`       | Administrateur Filiale     | 4-5         | Manage subsidiary (users, roles, config, reports)             |
| `auditor`     | Auditeur Interne           | 4-5         | Read-only access to all data, compliance reports              |
| `support`     | Support Client             | 4           | View customer data, resolve disputes, reset passwords         |
| `marketer`    | Marketing & Growth         | 4           | View analytics, manage campaigns, send notifications          |
| `developer`   | Développeur                | 4           | API access, logs, technical documentation                     |

#### Partner Roles

| Role Key            | Name                  | Trust Level | Capabilities                                    |
|---------------------|-----------------------|-------------|-------------------------------------------------|
| `bank`              | Banque Partenaire     | 4-5         | Float management, compliance reports            |
| `regulator`         | Régulateur (BCEAO)    | 5           | Read-only access for compliance audits          |
| `auditor_external`  | Auditeur Externe      | 4-5         | Audit reports for external compliance           |

---

## Modules

The RBAC system is module-scoped, meaning each user can have different roles per module:

| Module    | Description                        | Example Resources                                    |
|-----------|------------------------------------|------------------------------------------------------|
| `pay`     | Money transfers, payments          | transfers, bills, cash_operations, withdrawals       |
| `eats`    | Food delivery                      | restaurants, orders, deliveries, menus               |
| `shop`    | E-commerce                         | products, orders, cart, inventory                    |
| `talk`    | Messaging                          | conversations, messages, calls                       |
| `ads`     | Advertising platform               | campaigns, analytics, budgets                        |
| `free`    | Free services                      | news, community, events                              |
| `id`      | Identity & Authentication          | profiles, roles, permissions, exports                |
| `global`  | Cross-module operations            | subsidiaries, analytics, system_config               |

---

## Database Schema

### Tables

#### 1. `molam_role_definitions`

Global registry of available roles.

```sql
CREATE TABLE molam_role_definitions (
  role_id SERIAL PRIMARY KEY,
  role_key VARCHAR(50) UNIQUE NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  role_type VARCHAR(20) NOT NULL CHECK (role_type IN ('external', 'internal', 'partner', 'system')),
  description TEXT,
  min_trust_level INT NOT NULL DEFAULT 0 CHECK (min_trust_level BETWEEN 0 AND 5),
  max_trust_level INT NOT NULL DEFAULT 5 CHECK (max_trust_level BETWEEN 0 AND 5),
  is_assignable BOOLEAN NOT NULL DEFAULT TRUE,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 2. `molam_user_roles`

User role assignments per module.

```sql
CREATE TABLE molam_user_roles (
  user_role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role_key VARCHAR(50) NOT NULL REFERENCES molam_role_definitions(role_key),
  module VARCHAR(20) NOT NULL CHECK (module IN ('pay', 'eats', 'shop', 'talk', 'ads', 'free', 'id', 'global')),
  access_scope VARCHAR(20) NOT NULL DEFAULT 'read' CHECK (access_scope IN ('read', 'write', 'admin', 'owner')),
  trusted_level INT NOT NULL DEFAULT 0 CHECK (trusted_level BETWEEN 0 AND 5),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID NOT NULL,
  expires_at TIMESTAMPTZ,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  revoked_reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  UNIQUE(user_id, role_key, module)
);
```

#### 3. `molam_role_permissions`

Fine-grained permissions per role.

```sql
CREATE TABLE molam_role_permissions (
  permission_id BIGSERIAL PRIMARY KEY,
  role_key VARCHAR(50) NOT NULL REFERENCES molam_role_definitions(role_key),
  module VARCHAR(20) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  access_level VARCHAR(20) NOT NULL DEFAULT 'read' CHECK (access_level IN ('none', 'read', 'write', 'admin')),
  conditions JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  UNIQUE(role_key, module, resource, action)
);
```

**Example conditions:**
```json
{
  "own_only": true,
  "max_amount": 10000,
  "subsidiary_id": "abc-123"
}
```

#### 4. `molam_role_audit`

Immutable audit log for all role operations.

```sql
CREATE TABLE molam_role_audit (
  audit_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role_key VARCHAR(50),
  module VARCHAR(20),
  actor_id UUID,
  ip_address INET,
  user_agent TEXT,
  result VARCHAR(20),
  details JSONB
);
```

### Key Functions

#### `has_permission()`

Check if user has permission with contextual conditions.

```sql
SELECT has_permission(
  'user-123',           -- user_id
  'pay',                -- module
  'transfers',          -- resource
  'create',             -- action
  '{"max_amount": 5000}'::JSONB  -- context
);
-- Returns: true/false
```

#### `assign_role()`

Assign role to user.

```sql
SELECT assign_role(
  'user-123',           -- user_id
  'agent',              -- role_key
  'pay',                -- module
  'write',              -- access_scope
  2,                    -- trusted_level
  'admin-456',          -- assigned_by
  'Promoted to agent',  -- reason
  NULL                  -- expires_at (NULL = permanent)
);
-- Returns: user_role_id
```

#### `revoke_role()`

Revoke role from user.

```sql
SELECT revoke_role(
  'user-role-uuid',     -- user_role_id
  'admin-456',          -- revoked_by
  'Contract ended'      -- reason
);
-- Returns: true/false
```

#### `expire_temporal_roles()`

Auto-expire roles past their expiration date (for cron job).

```sql
SELECT expire_temporal_roles();
-- Returns: count of expired roles
```

---

## API Reference

### Base URL

```
/api/id/rbac
```

### Authentication

All endpoints require authentication via Bearer token:

```
Authorization: Bearer <jwt_token>
```

### Endpoints

#### 1. Get Role Definitions

**GET** `/api/id/rbac/roles`

Get all available role definitions.

```bash
curl -X GET http://localhost:3000/api/id/rbac/roles \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Query Parameters:**
- `type` (optional): Filter by role type (`external`, `internal`, `partner`, `system`)

**Response:**
```json
{
  "roles": [
    {
      "role_id": 1,
      "role_key": "client",
      "role_name": "Client",
      "role_type": "external",
      "description": "Regular customer/end-user",
      "min_trust_level": 0,
      "max_trust_level": 2,
      "is_assignable": true,
      "requires_approval": false,
      "is_active": true
    }
  ],
  "count": 12
}
```

#### 2. Get User's Own Roles

**GET** `/api/id/rbac/me/roles`

Get authenticated user's roles.

```bash
curl -X GET http://localhost:3000/api/id/rbac/me/roles \
  -H "Authorization: Bearer <token>"
```

**Query Parameters:**
- `module` (optional): Filter by module

**Response:**
```json
{
  "user_id": "user-123",
  "roles": [
    {
      "user_role_id": "uuid-1",
      "user_id": "user-123",
      "role_key": "client",
      "role_name": "Client",
      "module": "pay",
      "access_scope": "write",
      "trusted_level": 2,
      "assigned_at": "2025-01-15T10:00:00Z",
      "approval_status": "approved"
    }
  ],
  "count": 1
}
```

#### 3. Get User's Own Permissions

**GET** `/api/id/rbac/me/permissions`

Get authenticated user's effective permissions.

```bash
curl -X GET http://localhost:3000/api/id/rbac/me/permissions?module=pay \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "user_id": "user-123",
  "permissions": [
    {
      "module": "pay",
      "resource": "transfers",
      "action": "create",
      "access_level": "write",
      "conditions": {"max_amount": 10000}
    },
    {
      "module": "pay",
      "resource": "bills",
      "action": "pay",
      "access_level": "write"
    }
  ],
  "count": 2
}
```

#### 4. Check Specific Permission

**POST** `/api/id/rbac/me/check`

Check if authenticated user has a specific permission.

```bash
curl -X POST http://localhost:3000/api/id/rbac/me/check \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "module": "pay",
    "resource": "transfers",
    "action": "create",
    "context": {"max_amount": 5000}
  }'
```

**Response:**
```json
{
  "has_permission": true,
  "permission": {
    "module": "pay",
    "resource": "transfers",
    "action": "create"
  },
  "context": {"max_amount": 5000}
}
```

#### 5. Assign Role (Admin)

**POST** `/api/id/rbac/users/:userId/roles`

Assign role to a user. Requires `id:roles:assign` permission.

```bash
curl -X POST http://localhost:3000/api/id/rbac/users/user-123/roles \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "role_key": "agent",
    "module": "pay",
    "access_scope": "write",
    "trusted_level": 2,
    "reason": "Promoted to agent status",
    "expires_at": "2026-01-15T00:00:00Z"
  }'
```

**Response:**
```json
{
  "message": "Role assigned successfully",
  "user_role_id": "uuid-123",
  "user_id": "user-123",
  "role_key": "agent",
  "module": "pay",
  "assigned_by": "admin-456"
}
```

#### 6. Revoke Role (Admin)

**DELETE** `/api/id/rbac/user-roles/:userRoleId`

Revoke a specific role assignment. Requires `id:roles:revoke` permission.

```bash
curl -X DELETE http://localhost:3000/api/id/rbac/user-roles/uuid-123 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Contract ended"
  }'
```

**Response:**
```json
{
  "message": "Role revoked successfully",
  "user_role_id": "uuid-123",
  "revoked_by": "admin-456"
}
```

#### 7. Get Pending Approvals (Admin)

**GET** `/api/id/rbac/pending`

Get all roles pending approval. Requires `id:roles:approve` permission.

```bash
curl -X GET http://localhost:3000/api/id/rbac/pending \
  -H "Authorization: Bearer <admin_token>"
```

#### 8. Approve Role (Admin)

**POST** `/api/id/rbac/user-roles/:userRoleId/approve`

Approve a pending role. Requires `id:roles:approve` permission.

```bash
curl -X POST http://localhost:3000/api/id/rbac/user-roles/uuid-123/approve \
  -H "Authorization: Bearer <admin_token>"
```

#### 9. Reject Role (Admin)

**POST** `/api/id/rbac/user-roles/:userRoleId/reject`

Reject a pending role. Requires `id:roles:approve` permission.

```bash
curl -X POST http://localhost:3000/api/id/rbac/user-roles/uuid-123/reject \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Insufficient documentation"
  }'
```

#### 10. Get Role Statistics (Admin)

**GET** `/api/id/rbac/statistics`

Get role statistics. Requires `id:roles:read` permission.

```bash
curl -X GET http://localhost:3000/api/id/rbac/statistics?module=pay \
  -H "Authorization: Bearer <admin_token>"
```

#### 11. Get Audit Logs (Admin)

**GET** `/api/id/rbac/audit`

Get audit logs. Requires `id:audit:read` permission.

```bash
curl -X GET "http://localhost:3000/api/id/rbac/audit?user_id=user-123&limit=50" \
  -H "Authorization: Bearer <admin_token>"
```

**Query Parameters:**
- `user_id` (optional): Filter by user
- `event_type` (optional): Filter by event type
- `limit` (optional): Max results (default: 100, max: 500)

---

## AuthZ Middleware

The AuthZ middleware provides convenient Express middleware functions for protecting routes.

### Setup

```typescript
import { createAuthZMiddleware } from './middleware/authz';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const authz = createAuthZMiddleware(pool);

// Apply to all routes
app.use(authz.injectRBAC);
```

### Middleware Functions

#### 1. `requirePermission()`

Require specific permission to access route.

```typescript
app.get(
  '/api/pay/transactions',
  authenticate,
  authz.requirePermission('pay', 'transactions', 'read'),
  async (req, res) => {
    // User has permission to read transactions
    res.json({ transactions: [] });
  }
);
```

With custom context extractor:

```typescript
app.post(
  '/api/pay/transfer',
  authenticate,
  authz.requirePermission('pay', 'transfers', 'create', (req) => ({
    max_amount: req.body.amount
  })),
  async (req, res) => {
    // Permission check includes amount validation
    res.json({ success: true });
  }
);
```

#### 2. `requireRole()`

Require specific role to access route.

```typescript
app.post(
  '/api/pay/cash-out',
  authenticate,
  authz.requireRole('agent', 'pay'),
  async (req, res) => {
    // User has 'agent' role in 'pay' module
    res.json({ success: true });
  }
);
```

#### 3. `requireAnyRole()`

Require any of multiple roles to access route.

```typescript
app.get(
  '/api/admin/users',
  authenticate,
  authz.requireAnyRole(['superadmin', 'admin', 'support'], 'global'),
  async (req, res) => {
    // User has one of the specified roles
    res.json({ users: [] });
  }
);
```

#### 4. `requireTrustLevel()`

Require minimum trust level to access route.

```typescript
app.post(
  '/api/pay/large-transfer',
  authenticate,
  authz.requireTrustLevel(3, 'pay'),
  async (req, res) => {
    // User has trust level >= 3 in 'pay' module
    res.json({ success: true });
  }
);
```

#### 5. `requireOwnership()`

Ensure user can only access their own resource.

```typescript
import { UserIdExtractors } from './middleware/authz';

app.get(
  '/api/users/:userId/profile',
  authenticate,
  authz.requireOwnership(UserIdExtractors.fromParams('userId')),
  async (req, res) => {
    // User can only access their own profile
    res.json({ profile: {} });
  }
);
```

#### 6. `requireOwnershipOrPermission()`

Allow access if user owns the resource OR has required permission.

```typescript
app.put(
  '/api/users/:userId/profile',
  authenticate,
  authz.requireOwnershipOrPermission(
    UserIdExtractors.fromParams('userId'),
    'id',
    'profiles',
    'update'
  ),
  async (req, res) => {
    // User can update their own profile OR has admin permission
    res.json({ success: true });
  }
);
```

### Helper Functions

#### User ID Extractors

```typescript
import { UserIdExtractors } from './middleware/authz';

UserIdExtractors.fromParams('userId')  // Extract from req.params.userId
UserIdExtractors.fromQuery('userId')   // Extract from req.query.userId
UserIdExtractors.fromBody('user_id')   // Extract from req.body.user_id
UserIdExtractors.fromAuth()            // Use authenticated user ID
```

#### Context Extractors

```typescript
import { ContextExtractors } from './middleware/authz';

ContextExtractors.withAmount         // Include amount from body
ContextExtractors.withSubsidiary     // Include subsidiary_id
ContextExtractors.withOwnOnly        // Check if accessing own resource
```

---

## Installation & Setup

### 1. Database Setup

Run the SQL migration:

```bash
psql $DATABASE_URL -f sql/031_rbac.sql
```

### 2. Install Dependencies

```bash
npm install pg express express-rate-limit zod
npm install --save-dev @types/node @types/pg @types/express
```

### 3. Environment Variables

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/molam_db
```

### 4. Integrate into Express App

```typescript
import express from 'express';
import { Pool } from 'pg';
import { createRBACRouter } from './routes/rbac.routes';
import { createAuthZMiddleware } from './middleware/authz';

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Setup AuthZ
const authz = createAuthZMiddleware(pool);
app.use(authz.injectRBAC);

// Mount RBAC routes
app.use(createRBACRouter(pool));

// Protect other routes with AuthZ middleware
app.get(
  '/api/pay/transactions',
  authenticate,
  authz.requirePermission('pay', 'transactions', 'read'),
  (req, res) => res.json({ transactions: [] })
);

app.listen(3000, () => console.log('Server running on port 3000'));
```

### 5. Setup Cron Job for Temporal Role Expiration

```bash
# crontab -e
# Run every hour
0 * * * * psql $DATABASE_URL -c "SELECT expire_temporal_roles();"
```

Or via Node.js:

```typescript
import cron from 'node-cron';

cron.schedule('0 * * * *', async () => {
  const count = await rbacService.expireTemporalRoles();
  console.log(`[CRON] Expired ${count} temporal roles`);
});
```

---

## Usage Examples

### Example 1: Client Transfer Money

```typescript
// Client wants to transfer money
app.post(
  '/api/pay/transfer',
  authenticate,
  authz.requirePermission('pay', 'transfers', 'create', (req) => ({
    max_amount: req.body.amount
  })),
  async (req, res) => {
    // Permission check validates:
    // 1. User has 'client' role in 'pay' module
    // 2. User has 'transfers:create' permission
    // 3. Amount is within user's max_amount limit

    const { recipient_id, amount } = req.body;
    // ... process transfer
    res.json({ success: true });
  }
);
```

### Example 2: Agent Cash-Out Operation

```typescript
app.post(
  '/api/pay/cash-out',
  authenticate,
  authz.requireRole('agent', 'pay'),
  authz.requireTrustLevel(2, 'pay'),
  async (req, res) => {
    // Only agents with trust level >= 2 can perform cash-out
    const { customer_id, amount } = req.body;
    // ... process cash-out
    res.json({ success: true });
  }
);
```

### Example 3: Admin View All Users

```typescript
app.get(
  '/api/admin/users',
  authenticate,
  authz.requireAnyRole(['superadmin', 'admin', 'support'], 'global'),
  async (req, res) => {
    // Superadmin, admin, or support can view users
    const users = await getUserList();
    res.json({ users });
  }
);
```

### Example 4: Auditor Read-Only Access

```typescript
app.get(
  '/api/pay/audit-logs',
  authenticate,
  authz.requireRole('auditor', 'pay'),
  async (req, res) => {
    // Auditors have read-only access to audit logs
    const logs = await getAuditLogs();
    res.json({ logs });
  }
);
```

### Example 5: User Update Own Profile

```typescript
app.put(
  '/api/users/:userId/profile',
  authenticate,
  authz.requireOwnershipOrPermission(
    UserIdExtractors.fromParams('userId'),
    'id',
    'profiles',
    'update'
  ),
  async (req, res) => {
    // Users can update their own profile
    // OR admins/support can update any profile
    await updateProfile(req.params.userId, req.body);
    res.json({ success: true });
  }
);
```

### Example 6: Bank View Float Status

```typescript
app.get(
  '/api/pay/float',
  authenticate,
  authz.requireRole('bank', 'pay'),
  async (req, res) => {
    // Only bank partners can view float status
    const floatStatus = await getFloatStatus();
    res.json(floatStatus);
  }
);
```

### Example 7: Assign Temporal Role

```typescript
// Assign contractor role that expires in 30 days
const userRoleId = await rbacService.assignRole({
  user_id: 'contractor-123',
  role_key: 'developer',
  module: 'global',
  access_scope: 'write',
  trusted_level: 4,
  assigned_by: 'admin-456',
  reason: 'Contractor for Q1 2025 project',
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
});
```

---

## Security & Compliance

### Security Features

1. **Module Separation**: Roles are scoped per module to prevent cross-module privilege escalation
2. **Trust Levels**: Graduated access control based on verification level (0-5)
3. **Approval Workflows**: Sensitive roles require explicit approval before activation
4. **Temporal Roles**: Automatic expiration prevents forgotten access
5. **Immutable Audit Logs**: All role operations are logged permanently
6. **Row-Level Security**: PostgreSQL RLS ensures data isolation at database level
7. **Rate Limiting**: Prevents abuse of role management endpoints (30 ops/minute)
8. **Permission Context**: Conditional permissions (e.g., max_amount, own_only, subsidiary_id)

### Compliance

#### GDPR Compliance

- **Audit Trail**: Complete history of all role assignments and revocations
- **Data Access Control**: Users can only access data they have permission for
- **Right to be Forgotten**: Role revocation when user deletes account

#### BCEAO (Central Bank) Compliance

- **Regulator Role**: Special read-only role for BCEAO auditors
- **Audit Logs**: Immutable logs for regulatory investigations
- **Segregation of Duties**: Separate roles for operations vs. oversight

#### SOC 2 Compliance

- **Access Control**: Fine-grained RBAC with approval workflows
- **Logging & Monitoring**: Complete audit trail
- **Least Privilege**: Users only get minimum required permissions

### Best Practices

1. **Principle of Least Privilege**: Assign minimum required role
2. **Regular Audits**: Review role assignments monthly
3. **Temporal Roles**: Use expiration for contractors and temporary access
4. **Approval for Sensitive Roles**: Require approval for admin, developer, bank roles
5. **Trust Level Progression**: Increase trust level gradually based on verification
6. **Separation of Duties**: Don't assign conflicting roles (e.g., agent + auditor)

---

## Testing

### Run Structure Tests

```bash
cd brique-31-rbac-granular
node test_structure.cjs
```

**Expected output:**

```
✓ SQL: File exists
✓ SQL: Contains role_definitions table
✓ SQL: Contains user_roles table
...
✓ Middleware: Exports ContextExtractors
✓ Docs: README has security considerations

==================================================
📊 TEST SUMMARY
==================================================
Total tests: 103
✓ Passed: 103
✗ Failed: 0
Success rate: 100.0%
==================================================
```

### Manual Testing

#### 1. Assign Role

```bash
curl -X POST http://localhost:3000/api/id/rbac/users/user-123/roles \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "role_key": "agent",
    "module": "pay",
    "access_scope": "write",
    "trusted_level": 2
  }'
```

#### 2. Check Permission

```bash
curl -X POST http://localhost:3000/api/id/rbac/me/check \
  -H "Authorization: Bearer user-token" \
  -H "Content-Type: application/json" \
  -d '{
    "module": "pay",
    "resource": "cash_operations",
    "action": "cash_out",
    "context": {"amount": 5000}
  }'
```

#### 3. View Audit Logs

```bash
curl -X GET "http://localhost:3000/api/id/rbac/audit?user_id=user-123" \
  -H "Authorization: Bearer admin-token"
```

---

## Troubleshooting

### Common Issues

#### 1. Permission Denied

**Error:** `PERMISSION_DENIED: Permission denied: pay:transfers:create`

**Cause:** User doesn't have required role or permission.

**Solution:**
- Check user's roles: `GET /api/id/rbac/me/roles`
- Check user's permissions: `GET /api/id/rbac/me/permissions`
- Assign required role if missing

#### 2. Role Not Assignable

**Error:** `Role does not exist or is not assignable`

**Cause:** Role has `is_assignable = false` or doesn't exist.

**Solution:**
- Check role definition: `GET /api/id/rbac/roles/:roleKey`
- Enable assignability in database if needed

#### 3. Trust Level Insufficient

**Error:** `TRUST_LEVEL_INSUFFICIENT: Required: 3, Current: 1`

**Cause:** User's trust level is below requirement.

**Solution:**
- Complete KYC verification to increase trust level
- Admin can manually adjust trust level when assigning role

#### 4. Temporal Role Expired

**Cause:** Role has passed `expires_at` date.

**Solution:**
- Run expiration cron: `SELECT expire_temporal_roles();`
- Re-assign role with new expiration date

---

## License

Proprietary - Molam Platform © 2025

---

## Support

For issues or questions:
- Internal: #team-platform on Slack
- Partners: support@molam.com
- Documentation: https://docs.molam.com/rbac
