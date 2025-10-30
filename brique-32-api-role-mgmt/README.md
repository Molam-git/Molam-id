# Brique 32 — API Role Management

> **Industrial-grade API for managing roles across subsidiaries/modules**
>
> Extension of Brique 31 (RBAC granularité) with delegation, search, and performance optimizations.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [API Reference](#api-reference)
6. [Service Layer](#service-layer)
7. [Installation & Setup](#installation--setup)
8. [Usage Examples](#usage-examples)
9. [Delegation Workflows](#delegation-workflows)
10. [Bulk Operations](#bulk-operations)
11. [Maintenance & Operations](#maintenance--operations)
12. [Security](#security)
13. [Testing](#testing)

---

## Overview

**Brique 32** provides a production-ready API for managing roles per subsidiary/module in the Molam ecosystem. It extends **Brique 31 (RBAC granularité)** with advanced features:

- **Role Delegation**: Temporary role delegation with expiration and audit trail
- **Advanced Search**: Search users by role, module, or text query
- **Performance**: Materialized views for fast role lookups
- **Bulk Operations**: Assign/revoke roles for multiple users at once
- **Enhanced Audit**: Detailed audit logs with idempotency support
- **Maintenance Tools**: Expire old roles, refresh cached views

### Key Principles

1. **Single Identity**: One user ID across all subsidiaries (Pay, Eats, Shop, Talk, Ads, Free, ID)
2. **Module Isolation**: Strict separation between subsidiaries/modules
3. **Delegation Support**: Admins can temporarily delegate roles with justification
4. **Complete Audit**: Every role operation is logged immutably
5. **Idempotency**: Safe retry of role operations using idempotency keys
6. **Security**: mTLS inter-service, JWT auth, rate limiting, strict validation

---

## Features

### Core Features

✅ **Role Management API**
- Assign/revoke roles with validation
- Module-scoped permissions
- Trust level enforcement (0-5)
- Temporal roles with expiration

✅ **Delegation Workflows**
- Temporary role delegation
- Mandatory expiration for delegations
- Delegation reason required
- Track delegator for audit

✅ **Search & Discovery**
- Search users by role/module
- Full-text search on email/phone/name
- Pagination support
- Role statistics by module

✅ **Performance Optimization**
- Materialized view for active roles
- Indexed queries for fast lookup
- Auto-refresh on role changes
- Batch processing support

✅ **Bulk Operations**
- Bulk assign roles (up to 100 users)
- Bulk revoke roles (up to 100 users)
- Partial success handling
- Detailed failure reporting

✅ **Audit & Compliance**
- Complete audit trail
- Idempotency key tracking
- IP address & user agent logging
- Queryable audit logs

✅ **Maintenance Tools**
- Auto-expire old roles
- Refresh materialized view
- Get expiring roles (alert)
- View delegation summary

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT APPLICATIONS                      │
│         (Web, Mobile, Desktop, Admin Dashboards)            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS + JWT
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      API GATEWAY                             │
│              (Rate Limiting + mTLS + Auth)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   ROLE MANAGEMENT API                        │
│                                                              │
│  Routes (Express):                                           │
│  - POST /api/id/rbac/:userId/assign                         │
│  - POST /api/id/rbac/:userId/revoke                         │
│  - GET  /api/id/rbac/search                                 │
│  - GET  /api/id/rbac/audit                                  │
│  - POST /api/id/rbac/bulk/assign                            │
│  - POST /api/id/rbac/bulk/revoke                            │
│  - POST /api/id/rbac/maintenance/expire                     │
│                                                              │
│  Validation (Zod):                                           │
│  - AssignRoleSchema                                          │
│  - RevokeRoleSchema                                          │
│  - SearchUsersSchema                                         │
│  - BulkAssignSchema                                          │
│                                                              │
│  Service Layer:                                              │
│  - ensureCallerCanManage() - Permission check               │
│  - assignRole() - Assign with delegation support            │
│  - revokeRole() - Revoke with audit                         │
│  - searchUsers() - Advanced search                          │
│  - getRoleStatistics() - Module statistics                  │
│  - bulkAssignRoles() - Batch operations                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   POSTGRESQL DATABASE                        │
│                                                              │
│  Tables (Extension of Brique 31):                            │
│  - molam_user_roles (+ delegation fields)                   │
│  - molam_role_management_audit (enhanced audit)             │
│                                                              │
│  Materialized View:                                          │
│  - mv_effective_user_roles (performance cache)              │
│                                                              │
│  Functions:                                                  │
│  - assign_role_with_delegation()                            │
│  - revoke_role_by_module()                                  │
│  - search_users_by_role()                                   │
│  - get_role_statistics_by_module()                          │
│  - expire_roles()                                           │
│  - refresh_effective_roles_view()                           │
│                                                              │
│  Views:                                                      │
│  - v_user_role_assignments (complete view)                  │
│  - v_delegation_summary (delegation tracking)               │
│                                                              │
│  Triggers:                                                   │
│  - notify_role_change (pg_notify for cache refresh)         │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Extended Tables

#### `molam_user_roles` (Extended from Brique 31)

New columns added:

```sql
ALTER TABLE molam_user_roles
  ADD COLUMN delegated_by UUID REFERENCES molam_users(user_id),
  ADD COLUMN delegation_reason TEXT,
  ADD COLUMN created_by UUID REFERENCES molam_users(user_id),
  ADD COLUMN updated_by UUID REFERENCES molam_users(user_id),
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
```

#### `molam_role_management_audit` (New Table)

Enhanced audit trail with idempotency support:

```sql
CREATE TABLE molam_role_management_audit (
  audit_id BIGSERIAL PRIMARY KEY,
  performed_by UUID NOT NULL,
  target_user UUID NOT NULL,
  action VARCHAR(20) NOT NULL, -- assign|revoke|update|delegate|expire
  module VARCHAR(20) NOT NULL,
  role_key VARCHAR(50) NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  reason TEXT,
  delegation_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  idempotency_key VARCHAR(255),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `mv_effective_user_roles` (Materialized View)

Optimized view for active roles:

```sql
CREATE MATERIALIZED VIEW mv_effective_user_roles AS
SELECT
  r.user_role_id,
  r.user_id,
  r.role_key,
  r.module,
  r.access_scope,
  r.trusted_level,
  r.assigned_at,
  r.expires_at,
  r.delegated_by,
  rd.role_name,
  rd.role_type
FROM molam_user_roles r
JOIN molam_role_definitions rd ON r.role_key = rd.role_key
WHERE
  r.is_active = true
  AND r.revoked_at IS NULL
  AND r.approval_status = 'approved'
  AND (r.expires_at IS NULL OR r.expires_at > NOW());
```

### Key Functions

#### `assign_role_with_delegation()`

Assigns a role with optional delegation support.

**Parameters:**
- `p_target_user` - User receiving the role
- `p_role_key` - Role to assign
- `p_module` - Module/subsidiary
- `p_access_scope` - read|write|admin|owner
- `p_trusted_level` - 0-5
- `p_expires_at` - Expiration date (NULL = permanent)
- `p_assigned_by` - User performing the assignment
- `p_delegated_by` - User delegating (for delegation)
- `p_delegation_reason` - Reason for delegation
- `p_reason` - General reason

**Returns:** `UUID` - user_role_id

**Validation:**
- Role must exist and be active
- delegation_reason required if delegated_by is set
- expires_at required for delegations

#### `search_users_by_role()`

Search users by role/module/text query.

**Parameters:**
- `p_module` - Filter by module (NULL = all)
- `p_role_key` - Filter by role (NULL = all)
- `p_search_query` - Text search on email/phone/name
- `p_limit` - Max results
- `p_offset` - Pagination offset

**Returns:** Table with user and role details

---

## API Reference

### Base URL

```
/api/id/rbac
```

### Authentication

All endpoints require JWT authentication:

```
Authorization: Bearer <jwt_token>
```

### Endpoints

#### 1. List User Roles

**GET** `/api/id/rbac/:userId/roles`

Get all roles for a user (effective or including expired).

```bash
curl -X GET "http://localhost:3000/api/id/rbac/user-123/roles?includeExpired=false" \
  -H "Authorization: Bearer <token>"
```

**Query Parameters:**
- `includeExpired` (boolean): Include expired roles (default: false)
- `module` (string): Filter by module

**Response:**
```json
{
  "user_id": "user-123",
  "roles": [
    {
      "user_role_id": "uuid-1",
      "role_key": "admin",
      "role_name": "Administrator",
      "module": "pay",
      "access_scope": "admin",
      "trusted_level": 4,
      "assigned_at": "2025-01-01T00:00:00Z",
      "expires_at": null,
      "delegated_by": null,
      "status": "active"
    }
  ],
  "count": 1
}
```

#### 2. Assign Role

**POST** `/api/id/rbac/:userId/assign`

Assign a role to a user.

```bash
curl -X POST http://localhost:3000/api/id/rbac/user-123/assign \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-request-id" \
  -d '{
    "module": "pay",
    "role": "admin",
    "access_scope": "admin",
    "trusted_level": 4,
    "reason": "Promoted to admin"
  }'
```

**Request Body:**
```json
{
  "module": "pay",
  "role": "admin",
  "access_scope": "admin",
  "trusted_level": 4,
  "expires_at": "2026-01-01T00:00:00Z", // Optional
  "delegation_reason": "Q1 2025 project", // Optional (requires expires_at)
  "reason": "Promotion"
}
```

**Response:**
```json
{
  "success": true,
  "user_role_id": "uuid-123",
  "idempotency_key": "unique-request-id",
  "message": "Role assigned successfully"
}
```

#### 3. Revoke Role

**POST** `/api/id/rbac/:userId/revoke`

Revoke a role from a user.

```bash
curl -X POST http://localhost:3000/api/id/rbac/user-123/revoke \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "module": "pay",
    "role": "admin",
    "reason": "Contract ended"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Role revoked successfully"
}
```

#### 4. Search Users by Role

**GET** `/api/id/rbac/search`

Search users by role/module/query.

```bash
curl -X GET "http://localhost:3000/api/id/rbac/search?module=pay&role=agent&q=john&page=1&pageSize=20" \
  -H "Authorization: Bearer <token>"
```

**Query Parameters:**
- `module` (optional): Filter by module
- `role` (optional): Filter by role
- `q` (optional): Text search on email/phone/name
- `page` (number): Page number (default: 1)
- `pageSize` (number): Results per page (default: 20, max: 200)

**Response:**
```json
{
  "results": [
    {
      "user_id": "user-123",
      "email": "john@example.com",
      "phone_e164": "+221701234567",
      "full_name": "John Doe",
      "module": "pay",
      "role_key": "agent",
      "role_name": "Agent Partenaire",
      "access_scope": "write",
      "trusted_level": 2,
      "expires_at": null
    }
  ],
  "count": 1,
  "page": 1,
  "page_size": 20
}
```

#### 5. Get Role Statistics

**GET** `/api/id/rbac/statistics`

Get role assignment statistics by module.

```bash
curl -X GET "http://localhost:3000/api/id/rbac/statistics?module=pay" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "statistics": [
    {
      "module": "pay",
      "role_key": "agent",
      "role_name": "Agent Partenaire",
      "total_users": 1523,
      "delegated_count": 45,
      "expiring_soon": 12
    }
  ],
  "count": 1
}
```

#### 6. Get Audit Logs

**GET** `/api/id/rbac/audit`

Get role change audit logs.

```bash
curl -X GET "http://localhost:3000/api/id/rbac/audit?userId=user-123&action=assign&limit=50" \
  -H "Authorization: Bearer <admin_token>"
```

**Query Parameters:**
- `userId` (optional): Filter by target user
- `performedBy` (optional): Filter by performer
- `module` (optional): Filter by module
- `action` (optional): Filter by action (assign|revoke|update|delegate|expire)
- `startDate` (optional): Start date (ISO 8601)
- `endDate` (optional): End date (ISO 8601)
- `limit` (number): Max results (default: 100, max: 500)
- `offset` (number): Pagination offset

**Response:**
```json
{
  "audit_logs": [
    {
      "audit_id": "123",
      "performed_by": "admin-456",
      "target_user": "user-123",
      "action": "assign",
      "module": "pay",
      "role_key": "admin",
      "new_state": {...},
      "reason": "Promotion",
      "ip_address": "192.168.1.1",
      "performed_at": "2025-01-15T10:00:00Z"
    }
  ],
  "count": 1
}
```

#### 7. Bulk Assign Roles

**POST** `/api/id/rbac/bulk/assign`

Assign a role to multiple users at once.

```bash
curl -X POST http://localhost:3000/api/id/rbac/bulk/assign \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": ["user-1", "user-2", "user-3"],
    "module": "pay",
    "role": "client",
    "access_scope": "write",
    "trusted_level": 1,
    "reason": "Onboarding batch"
  }'
```

**Request Body:**
```json
{
  "user_ids": ["user-1", "user-2", "user-3"],
  "module": "pay",
  "role": "client",
  "access_scope": "write",
  "trusted_level": 1,
  "expires_at": "2026-01-01T00:00:00Z", // Optional
  "reason": "Batch onboarding"
}
```

**Response:**
```json
{
  "success": true,
  "total": 3,
  "successful": 2,
  "failed": 1,
  "successful_users": ["user-1", "user-2"],
  "failed_users": [
    {
      "user_id": "user-3",
      "error": "User not found"
    }
  ]
}
```

#### 8. Get Expiring Roles

**GET** `/api/id/rbac/expiring`

Get roles expiring within N days.

```bash
curl -X GET "http://localhost:3000/api/id/rbac/expiring?days=7" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "expiring_roles": [
    {
      "user_role_id": "uuid-1",
      "user_id": "contractor-123",
      "role_key": "developer",
      "module": "global",
      "expires_at": "2025-01-20T00:00:00Z",
      "delegated_by": "admin-456"
    }
  ],
  "count": 1,
  "days_threshold": 7
}
```

#### 9. Expire Old Roles (Maintenance)

**POST** `/api/id/rbac/maintenance/expire`

Manually trigger expiration of roles past their expiration date.

```bash
curl -X POST http://localhost:3000/api/id/rbac/maintenance/expire \
  -H "Authorization: Bearer <admin_token>"
```

**Response:**
```json
{
  "success": true,
  "expired_count": 15,
  "message": "Expired 15 roles"
}
```

#### 10. Refresh Materialized View (Maintenance)

**POST** `/api/id/rbac/maintenance/refresh-view`

Manually refresh the materialized view.

```bash
curl -X POST http://localhost:3000/api/id/rbac/maintenance/refresh-view \
  -H "Authorization: Bearer <admin_token>"
```

**Response:**
```json
{
  "success": true,
  "message": "Materialized view refreshed successfully"
}
```

---

## Delegation Workflows

### What is Delegation?

Delegation allows an admin to temporarily assign a role to another user for a specific period. This is useful for:
- Contractors working on short-term projects
- Temporary coverage when an employee is unavailable
- Trial access for evaluation

### Delegation Requirements

1. **Mandatory Expiration**: Delegated roles MUST have an `expires_at` date
2. **Delegation Reason**: Must provide `delegation_reason` explaining why
3. **Audit Trail**: Delegator is tracked for compliance
4. **Auto-Expiration**: Roles expire automatically after the date

### Example: Delegate Developer Role

```bash
curl -X POST http://localhost:3000/api/id/rbac/contractor-123/assign \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "module": "global",
    "role": "developer",
    "access_scope": "write",
    "trusted_level": 3,
    "expires_at": "2025-03-31T23:59:59Z",
    "delegation_reason": "Q1 2025 contractor project - API development",
    "reason": "Temporary access for Q1 project"
  }'
```

### View All Delegations by an Admin

```bash
curl -X GET http://localhost:3000/api/id/rbac/delegations/admin-456 \
  -H "Authorization: Bearer <admin_token>"
```

---

## Bulk Operations

### Bulk Assign (up to 100 users)

Useful for:
- Onboarding batches of new users
- Migrating users to a new role
- Granting access to a group

```bash
curl -X POST http://localhost:3000/api/id/rbac/bulk/assign \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": ["user-1", "user-2", "user-3", "..."],
    "module": "pay",
    "role": "client",
    "access_scope": "write",
    "trusted_level": 1
  }'
```

### Bulk Revoke (up to 100 users)

Useful for:
- Revoking access after project completion
- Cleaning up inactive users
- Security response (revoke compromised accounts)

```bash
curl -X POST http://localhost:3000/api/id/rbac/bulk/revoke \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": ["user-1", "user-2", "user-3"],
    "module": "pay",
    "role": "client",
    "reason": "Batch deactivation"
  }'
```

---

## Maintenance & Operations

### Automatic Expiration (Cron Job)

Setup a cron job to expire old roles:

```bash
# crontab -e
# Run every hour
0 * * * * curl -X POST http://localhost:3000/api/id/rbac/maintenance/expire \
  -H "Authorization: Bearer <system_token>"
```

Or via Node.js:

```typescript
import cron from 'node-cron';

cron.schedule('0 * * * *', async () => {
  const result = await service.expireRoles();
  console.log(`[CRON] Expired ${result} roles`);
});
```

### Materialized View Refresh

The materialized view is automatically refreshed via `pg_notify` trigger. For manual refresh:

```bash
# Refresh every 5 minutes
*/5 * * * * curl -X POST http://localhost:3000/api/id/rbac/maintenance/refresh-view \
  -H "Authorization: Bearer <system_token>"
```

---

## Security

### Authentication & Authorization

- **JWT Tokens**: RS256 signed tokens with user_id claim
- **mTLS**: Mutual TLS for inter-service communication
- **Idempotency Keys**: Safe retry of mutations via `Idempotency-Key` header
- **Rate Limiting**:
  - Mutations: 10 requests/minute
  - Reads: 60 requests/minute

### Permission Checks

```typescript
// Superadmin can manage any module
// Module admin can only manage their own module

await service.ensureCallerCanManage(callerId, module);
// Throws PermissionDeniedError if denied
```

### Audit Trail

All operations are logged:
- Who performed the action
- Target user
- Action type (assign/revoke/delegate/expire)
- Previous and new state
- Reason provided
- IP address & user agent
- Idempotency key

### Compliance

- **GDPR**: Complete audit trail for data access
- **BCEAO**: Regulator access for compliance audits
- **SOC 2**: Least privilege, logging, monitoring

---

## Installation & Setup

### 1. Database Setup

Run the SQL migration:

```bash
psql $DATABASE_URL -f sql/032_role_management.sql
```

### 2. Install Dependencies

```bash
npm install pg express express-rate-limit zod
npm install --save-dev @types/node @types/pg @types/express
```

### 3. Environment Variables

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/molam_db
JWT_SECRET=your-jwt-secret
```

### 4. Integrate into Express App

```typescript
import express from 'express';
import { Pool } from 'pg';
import { createRoleManagementRouter } from './routes/role-management.routes';

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());
app.use(createRoleManagementRouter(pool));

app.listen(3000, () => {
  console.log('Role Management API listening on port 3000');
});
```

---

## Testing

### Run Structure Tests

```bash
cd brique-32-api-role-mgmt
node test_structure.cjs
```

**Expected output:**

```
✓ SQL: File exists
✓ SQL: Extends molam_user_roles with delegation fields
✓ SQL: Contains molam_role_management_audit table
...
✓ Routes: POST /api/id/rbac/bulk/assign
✓ Routes: POST /api/id/rbac/bulk/revoke

==================================================
📊 TEST SUMMARY
==================================================
Total tests: 74
✓ Passed: 74
✗ Failed: 0
Success rate: 100.0%
==================================================
```

### Manual Testing

```bash
# Assign a role
curl -X POST http://localhost:3000/api/id/rbac/user-123/assign \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{"module": "pay", "role": "admin", "access_scope": "admin", "trusted_level": 4}'

# Search users
curl -X GET "http://localhost:3000/api/id/rbac/search?module=pay&role=agent" \
  -H "Authorization: Bearer token"

# View audit logs
curl -X GET "http://localhost:3000/api/id/rbac/audit?module=pay&limit=50" \
  -H "Authorization: Bearer admin-token"
```

---

## Troubleshooting

### Common Issues

#### 1. Permission Denied

**Error:** `PERMISSION_DENIED: User does not have permission to manage roles in module: pay`

**Cause:** Caller doesn't have admin role in the module.

**Solution:**
- Superadmin can manage all modules
- Module admin can only manage their own module
- Assign appropriate admin role to the caller

#### 2. Delegation Requires Expiration

**Error:** `expires_at is required when delegation_reason is provided`

**Cause:** Delegated roles must have an expiration date.

**Solution:**
- Always provide `expires_at` when using `delegation_reason`

#### 3. Idempotency Key Collision

**Behavior:** Same response returned for duplicate request.

**Cause:** Idempotency key already used for a previous request.

**Solution:**
- This is expected behavior (idempotent)
- Use unique idempotency keys for different operations

---

## License

Proprietary - Molam Platform © 2025

---

## Support

For issues or questions:
- Internal: #team-platform on Slack
- Partners: support@molam.com
- Documentation: https://docs.molam.com/role-management
