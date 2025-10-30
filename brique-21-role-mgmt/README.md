# Brique 21 — API Role Management (add/remove)

**Molam ID - Industrial-grade Role Management API with Approval Workflows**

Version: 1.0.0
Status: Production-ready

## Overview

Brique 21 provides a secure, traceable, and scalable API for managing roles across the Molam ecosystem. This service enables:

- **Role CRUD operations** with scope-based access control
- **Role assignment/revocation** to users with trust hierarchy enforcement
- **Approval workflows** for sensitive role grants (trusted_level ≥ 80)
- **Idempotency guarantees** via Idempotency-Key header
- **Immutable audit trail** for all operations
- **Cache invalidation** for real-time permission updates
- **Event-driven architecture** with Kafka integration

## Key Features

### 🔐 Security & Governance

- **Trust Level Hierarchy**: Prevents privilege escalation - actors can only manage roles with lower trust levels
- **Scope Boundaries**: Global admins manage global roles, module admins manage their specific modules
- **Self-Elevation Prevention**: SQL trigger prevents users from granting roles to themselves
- **Approval Workflows**: High-trust roles (≥80) require approval from higher authority
- **Permission-based Access**: All operations protected by RBAC permissions

### 📊 Module Scopes

- `global` - Super admins only
- `pay` - Molam Pay subsidiary
- `eats` - Molam Eats subsidiary
- `talk` - Molam Talk subsidiary
- `ads` - Molam Ads subsidiary
- `shop` - Molam Shop subsidiary
- `free` - Molam Free subsidiary
- `id` - Molam ID (identity platform)

### 👥 Trust Levels

| Level | Role Type | Examples |
|-------|-----------|----------|
| 100 | Super Admin | Global system administrator |
| 80-90 | Module Admin | pay_admin, eats_admin, talk_admin |
| 70 | Auditor | Security auditor, compliance officer |
| 50-60 | Internal Staff | Support, marketing, commercial |
| 30-40 | External Partners | Agents, merchants, banks |
| 10 | End Users | Clients (customers) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Applications                       │
│                     (Web, Mobile, Admin UI)                      │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTPS + JWT
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Role Management API                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Auth        │  │  RBAC        │  │  Error       │         │
│  │  Middleware  │→ │  Middleware  │→ │  Handler     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     Routes Layer                          │  │
│  │  POST /v1/roles                 (create/update role)     │  │
│  │  POST /v1/roles/grants          (grant role)             │  │
│  │  POST /v1/roles/grants/revoke   (revoke role)            │  │
│  │  POST /v1/roles/grants/approve  (approve grant)          │  │
│  │  GET  /v1/roles                 (list roles)             │  │
│  │  GET  /v1/roles/grants/pending  (pending approvals)      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Services Layer                           │  │
│  │  • createOrUpdateRole()  • grantRole()                   │  │
│  │  • revokeRole()          • approveGrant()                │  │
│  │  • withIdempotency()     • Security Guards               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Repository Layer                          │  │
│  │  • upsertRole()          • addGrant()                    │  │
│  │  • revokeGrant()         • canManageScope()              │  │
│  │  • hasHigherTrust()      • createApprovalRequest()       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────┬────────────────────┬─────────────────────┘
                      │                     │
         ┌────────────▼───────────┐  ┌─────▼──────┐
         │   PostgreSQL            │  │   Redis    │
         │   (Roles, Grants,       │  │   (Cache)  │
         │    Approvals, Audit)    │  └────────────┘
         └─────────────────────────┘
                      │
         ┌────────────▼───────────┐
         │   Kafka/Pulsar          │
         │   (Event Streaming)     │
         └─────────────────────────┘
```

## Installation

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Redis >= 6
- Kafka/Pulsar (optional, for events)

### Setup

```bash
# 1. Install dependencies
cd brique-21-role-mgmt
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Run SQL migrations
psql -U molam -d molam_id -f sql/021_role_mgmt.sql

# 4. Generate JWT keys (if not already done)
mkdir -p keys
ssh-keygen -t rsa -b 4096 -m PEM -f keys/jwt-rs256.key -N ""
openssl rsa -in keys/jwt-rs256.key -pubout -outform PEM -out keys/jwt-rs256.pub

# 5. Build TypeScript
npm run build

# 6. Run tests
npm run structure-test
npm test

# 7. Start server
npm start
```

## API Reference

### Base URL

```
https://api.molam.id/v1
```

### Authentication

All endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Endpoints

#### 1. Create/Update Role

**POST** `/v1/roles`

Create a new role or update an existing one.

**Requires Permission**: `id.role.manage`

**Request Body**:
```json
{
  "name": "pay_admin",
  "module_scope": "pay",
  "role_type": "internal",
  "description": "Pay subsidiary administrator",
  "trusted_level": 80,
  "priority": 100
}
```

**Response** (201):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "pay_admin",
  "module_scope": "pay",
  "role_type": "internal",
  "trusted_level": 80,
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

---

#### 2. Grant Role to User

**POST** `/v1/roles/grants`

Assign a role to a user. May trigger approval workflow for high-trust roles.

**Requires Permission**: `id.role.assign`

**Requires Header**: `Idempotency-Key: <unique_key>`

**Request Body**:
```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "role_id": "550e8400-e29b-41d4-a716-446655440000",
  "require_approval": false,
  "scope_constraint": "pay.senegal",
  "expires_at": "2025-12-31T23:59:59Z",
  "justification": "Temporary admin access for migration"
}
```

**Response** (201) - Immediate Grant:
```json
{
  "status": "granted",
  "message": "Role granted successfully"
}
```

**Response** (201) - Pending Approval:
```json
{
  "status": "pending",
  "request_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "message": "Role grant pending approval"
}
```

---

#### 3. Revoke Role from User

**POST** `/v1/roles/grants/revoke`

Remove a role assignment from a user.

**Requires Permission**: `id.role.revoke`

**Request Body**:
```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "role_id": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "Contract ended"
}
```

**Response** (200):
```json
{
  "status": "revoked",
  "message": "Role revoked successfully"
}
```

---

#### 4. Approve/Reject Role Grant

**POST** `/v1/roles/grants/approve`

Approve or reject a pending role grant request.

**Requires Permission**: `id.role.approve`

**Request Body**:
```json
{
  "request_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "approve": true,
  "reason": "Approved for Q1 operations"
}
```

**Response** (200):
```json
{
  "status": "approved",
  "granted": true,
  "message": "Role grant approved and assigned"
}
```

---

#### 5. List Roles

**GET** `/v1/roles?module_scope=pay&role_type=internal`

List all roles with optional filters.

**Requires Permission**: `id.role.read`

**Response** (200):
```json
{
  "roles": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "pay_admin",
      "module_scope": "pay",
      "role_type": "internal",
      "trusted_level": 80,
      "priority": 100,
      "description": "Pay subsidiary administrator"
    }
  ],
  "count": 1
}
```

---

#### 6. Get Pending Approvals

**GET** `/v1/roles/grants/pending`

List pending role grant approval requests.

**Requires Permission**: `id.role.approve`

**Response** (200):
```json
{
  "requests": [
    {
      "id": "...",
      "request_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "role_id": "550e8400-e29b-41d4-a716-446655440000",
      "requested_by": "admin-user-id",
      "status": "pending",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

---

#### 7. Get My Roles

**GET** `/v1/roles/me`

Get the authenticated user's roles.

**Requires**: Authentication only (no specific permission)

**Response** (200):
```json
{
  "roles": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "pay_admin",
      "module_scope": "pay",
      "trusted_level": 80
    }
  ],
  "count": 1
}
```

## Database Schema

### Tables

#### molam_roles_v2
Extended from Brique 20 with `trusted_level` column.

```sql
CREATE TABLE molam_roles_v2 (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  role_type TEXT NOT NULL,  -- 'external' | 'internal'
  module_scope TEXT NOT NULL,  -- 'global' | 'pay' | 'eats' | ...
  description TEXT,
  trusted_level SMALLINT DEFAULT 10 CHECK (trusted_level >= 0 AND trusted_level <= 100),
  priority INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### molam_role_grants_approvals
Tracks approval workflow for sensitive role grants.

```sql
CREATE TABLE molam_role_grants_approvals (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES molam_users(id),
  role_id UUID NOT NULL REFERENCES molam_roles_v2(id),
  requested_by UUID NOT NULL REFERENCES molam_users(id),
  approver_required BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID REFERENCES molam_users(id),
  approved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected' | 'cancelled'
  reason TEXT,
  justification TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### molam_idempotency_keys
Ensures exactly-once semantics for role operations.

```sql
CREATE TABLE molam_idempotency_keys (
  key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  response_code INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);
```

### Security Functions

#### can_manage_scope(actor_id, scope)
Checks if the actor can manage roles in the specified scope.

- Global scope requires `super_admin` with global scope
- Module scope requires corresponding module admin OR super_admin

#### has_higher_trust(actor_id, target_role_id)
Checks if the actor has strictly higher trust level than the target role.

- Prevents privilege escalation
- Actor's max trust level must be > target role's trust level

#### check_self_elevation()
Trigger function that prevents users from granting roles to themselves.

## Security Principles

### 1. Least Privilege
Users receive minimum necessary permissions for their role.

### 2. Separation of Duties
- Admins cannot grant roles to themselves
- Approvers must have higher trust than granted role
- Auditors cannot have admin roles

### 3. Trust Hierarchy
```
Super Admin (100)
    ↓
Module Admins (80-90)
    ↓
Auditors (70)
    ↓
Internal Staff (50-60)
    ↓
External Partners (30-40)
    ↓
End Users (10)
```

### 4. Approval Workflows
Roles with `trusted_level >= 80` require approval from higher authority.

### 5. Immutable Audit
All operations logged to `molam_rbac_audit` with full context.

## Events

### Published Events

| Event | Payload | Description |
|-------|---------|-------------|
| `id.role.changed` | role_id, role_name, by, ts | Role created/updated |
| `id.role.granted` | user_id, role_id, by, ts | Role granted to user |
| `id.role.revoked` | user_id, role_id, by, ts | Role revoked from user |
| `id.role.grant.requested` | request_id, user_id, role_id, requested_by | Grant pending approval |
| `id.role.grant.approved` | request_id, user_id, role_id, by | Grant approved |
| `id.role.grant.rejected` | request_id, user_id, role_id, by | Grant rejected |

## Observability

### Prometheus Metrics

```
# Role operations
id_role_grant_requests_total{scope,decision}
id_role_grant_latency_ms_bucket
id_role_revocations_total{scope}
id_role_cache_invalidation_total

# Approval workflow
id_role_approval_requests_total{decision}
id_role_approval_latency_ms_bucket

# Idempotency
id_role_idempotency_cache_hits_total
id_role_idempotency_cache_misses_total
```

### Logs

Structured JSON logs for all operations:
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "level": "info",
  "operation": "role_granted",
  "actor_id": "admin-user-id",
  "user_id": "target-user-id",
  "role_id": "role-uuid",
  "scope": "pay",
  "trusted_level": 80,
  "idempotency_key": "key-123"
}
```

## Testing

### Run Structure Tests
```bash
npm run structure-test
```

### Run Unit Tests
```bash
npm test
```

### Build
```bash
npm run build
```

## Deployment

### Docker
```bash
docker build -t molam/role-mgmt:1.0.0 .
docker run -p 3021:3021 --env-file .env molam/role-mgmt:1.0.0
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: molam-role-mgmt
spec:
  replicas: 3
  selector:
    matchLabels:
      app: molam-role-mgmt
  template:
    metadata:
      labels:
        app: molam-role-mgmt
    spec:
      containers:
      - name: role-mgmt
        image: molam/role-mgmt:1.0.0
        ports:
        - containerPort: 3021
        env:
        - name: PGHOST
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: host
        # ... more env vars
```

## Troubleshooting

### Common Issues

**Issue**: `Forbidden: Insufficient trust level to grant this role`
- **Solution**: Ensure your user has higher trust level than the target role

**Issue**: `Missing Idempotency-Key header`
- **Solution**: Include `Idempotency-Key: <unique-uuid>` header in grant requests

**Issue**: `Role grant pending approval`
- **Solution**: This is expected for high-trust roles (≥80). Approval required.

## License

Proprietary - Molam Corporation

---

**Generated with ❤️ by the Molam ID Team**
