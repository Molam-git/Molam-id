# Brique 22 — API Admin ID (superadmin global)

**Molam ID - Global Administration API for Multi-Tenant Management**

Version: 1.0.0
Status: Production-ready

## Overview

Brique 22 provides a comprehensive global administration layer for managing the entire Molam ID ecosystem. This superadmin-only API enables:

- **Multi-tenant management** - Countries/regions with localization settings
- **Module control** - Enable/disable/maintenance mode for subsidiaries per country
- **Global policies** - Configuration management with tenant overrides
- **Emergency locks** - Kill-switch mechanism for security incidents
- **Key rotation** - JWT signing key management with Vault/HSM integration
- **Audit trail** - Immutable logs with CSV/NDJSON export

## Key Features

### 🌍 Multi-Tenant Management

- Create and manage tenants (countries/regions)
- Configure timezone, currency, phone/email validation per tenant
- Activate/deactivate tenants
- Metadata support for custom tenant settings

### 🎛️ Module Control

Control which Molam modules are available in each country:
- **enabled** - Module fully operational
- **disabled** - Module not available
- **maintenance** - Temporarily offline with custom message
- **readonly** - Read-only mode, no writes allowed

Modules: `pay`, `eats`, `talk`, `ads`, `shop`, `free`, `id`

### ⚙️ Policy Management

Flexible configuration with global defaults and tenant-specific overrides:
- Password complexity requirements
- KYC minimum levels
- Session TTLs
- Attempt limits
- 2FA requirements

Policy format: `{tenant_id (nullable)}.{module_scope}.{key} → value`

### 🔴 Emergency Locks (Kill-Switch)

Temporary access restrictions with automatic expiration:
- **Global** - Block all access system-wide
- **Tenant** - Block specific country
- **Module** - Block module in specific country
- **Role** - Block specific role

TTL: 60 seconds to 7 days

### 🔑 Key Rotation

JWT signing key lifecycle management:
- Generate new keys via Vault/HSM
- Staging → Active → Retiring → Retired workflow
- JWKS endpoint for public key distribution
- Automatic key metadata tracking

### 📊 Audit & Observability

- Immutable append-only audit log
- CSV/NDJSON export for compliance
- Prometheus metrics
- Kafka event streaming

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   Global Admin Console                        │
│                  (Superadmin mTLS Client)                    │
└─────────────────────┬────────────────────────────────────────┘
                      │ HTTPS + JWT (Step-up 2FA)
                      ▼
┌──────────────────────────────────────────────────────────────┐
│                    Admin API Server                           │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ Auth       │→ │ Superadmin   │→ │ Emergency    │        │
│  │ Middleware │  │ Check        │  │ Locks Check  │        │
│  └────────────┘  └──────────────┘  └──────────────┘        │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  POST /v1/admin/tenants                              │   │
│  │  PATCH /v1/admin/tenants/:id/modules/:module         │   │
│  │  PUT /v1/admin/policies                              │   │
│  │  POST /v1/admin/locks                                │   │
│  │  POST /v1/admin/keys/rotate                          │   │
│  │  GET /v1/admin/audit/export                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────┬────────────────┬──────────────────────┘
                      │                 │
         ┌────────────▼────────┐  ┌────▼─────────┐
         │   PostgreSQL         │  │   Redis      │
         │   (Tenants, Modules, │  │   (Cache)    │
         │    Policies, Locks)  │  └──────────────┘
         └──────────────────────┘
                      │
         ┌────────────▼────────┐
         │   Vault/HSM          │
         │   (Key Material)     │
         └──────────────────────┘
```

## Installation

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Redis >= 6
- Vault/HSM (for key rotation)
- Kafka/Pulsar (optional, for events)

### Setup

```bash
# 1. Install dependencies
cd brique-22-admin-id
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 3. Run SQL migrations
psql -U molam -d molam_id -f sql/022_admin_id.sql

# 4. Build TypeScript
npm run build

# 5. Run tests
npm run structure-test

# 6. Start server
npm start
```

## API Reference

### Base URL

```
https://api.molam.id/v1/admin
```

### Authentication

All endpoints require:
1. Valid JWT token with superadmin permissions
2. Permission: `id.admin.super` with scope `global`
3. Step-up 2FA (recommended for production)

```
Authorization: Bearer <superadmin_jwt_token>
```

### Endpoints

#### 1. Create Tenant

**POST** `/v1/admin/tenants`

```json
{
  "code": "SN",
  "name": "Senegal",
  "default_currency": "XOF",
  "timezone": "Africa/Dakar",
  "phone_country_code": "+221",
  "email_regex": "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
  "phone_regex": "^\\+221[23678]\\d{7}$",
  "is_active": true
}
```

**Response** (201):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "code": "SN",
  "name": "Senegal",
  "default_currency": "XOF",
  "timezone": "Africa/Dakar",
  "phone_country_code": "+221",
  "is_active": true,
  "created_at": "2025-01-15T10:30:00Z"
}
```

---

#### 2. List Tenants

**GET** `/v1/admin/tenants`

**Response** (200):
```json
{
  "tenants": [
    {
      "id": "...",
      "code": "SN",
      "name": "Senegal",
      "is_active": true
    }
  ],
  "count": 1
}
```

---

#### 3. Update Module Status

**PATCH** `/v1/admin/tenants/:tenantId/modules/:module`

```json
{
  "status": "maintenance",
  "maintenance_message": "Scheduled maintenance 22:00-22:15 UTC"
}
```

**Response** (200):
```json
{
  "id": "...",
  "tenant_id": "...",
  "module_scope": "pay",
  "status": "maintenance",
  "maintenance_message": "Scheduled maintenance 22:00-22:15 UTC",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

---

#### 4. Upsert Policy

**PUT** `/v1/admin/policies`

```json
{
  "tenant_id": null,
  "module_scope": "global",
  "key": "password.min_length",
  "value": { "min": 10 },
  "description": "Minimum password length requirement"
}
```

**Response** (200):
```json
{
  "id": "...",
  "tenant_id": null,
  "module_scope": "global",
  "key": "password.min_length",
  "value": { "min": 10 },
  "created_at": "2025-01-15T10:30:00Z"
}
```

---

#### 5. Create Emergency Lock

**POST** `/v1/admin/locks`

```json
{
  "scope": "module",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "module_scope": "pay",
  "reason": "Suspicious activity detected - investigating",
  "ttl_seconds": 900
}
```

**Response** (201):
```json
{
  "id": "...",
  "scope": "module",
  "tenant_id": "...",
  "module_scope": "pay",
  "reason": "Suspicious activity detected - investigating",
  "ttl_seconds": 900,
  "created_at": "2025-01-15T10:30:00Z",
  "expires_at": "2025-01-15T10:45:00Z"
}
```

---

#### 6. Rotate JWT Keys

**POST** `/v1/admin/keys/rotate`

```json
{
  "alg": "RS256"
}
```

**Response** (202):
```json
{
  "kid": "molam_jwt_1737024000_a1b2c3d4",
  "alg": "RS256",
  "status": "staging",
  "message": "Key rotation initiated. New key is staging. Activate manually after testing."
}
```

---

#### 7. Export Audit Logs

**GET** `/v1/admin/audit/export?from=2025-01-01T00:00:00Z&to=2025-01-15T23:59:59Z&format=csv`

**Response** (200):
```
Content-Type: text/csv
Content-Disposition: attachment; filename=admin_audit.csv

id,actor_id,action,target,reason,created_at
...
```

Or with `format=ndjson`:
```
Content-Type: application/x-ndjson

{"id":"...","actor_id":"...","action":"tenant.create",...}
{"id":"...","actor_id":"...","action":"module.status.update",...}
```

## Database Schema

### Tables

1. **molam_tenants** - Countries/regions configuration
2. **molam_tenant_modules** - Module status per tenant
3. **molam_policies** - Global and tenant-specific policies
4. **molam_emergency_locks** - Kill-switch mechanism
5. **molam_key_registry** - JWT key metadata
6. **molam_admin_audit** - Immutable audit log
7. **molam_admin_approvals** - Dual-control approvals (optional)

### Key Functions

- `is_locked(tenant_id, module_scope, role_ids)` - Check for active locks
- `get_policy_value(tenant_id, module_scope, key)` - Get effective policy
- `cleanup_expired_locks()` - Remove expired locks (cron)

### Views

- `v_active_locks` - Currently active emergency locks
- `v_tenant_modules_overview` - Module status across all tenants
- `v_active_keys` - Active JWT keys for JWKS

## Security

### Access Control

- **Superadmin only**: `id.admin.super` permission required
- **Step-up 2FA**: Recommended for production
- **mTLS**: Admin console uses mutual TLS
- **Short tokens**: JWT TTL ≤ 10 minutes
- **IP whitelisting**: Optional admin IP restrictions

### Audit Trail

All operations logged with:
- Actor ID and email
- Action performed
- Target resource (full record)
- Diff (old/new values for updates)
- Reason/justification
- IP address and user agent
- Timestamp

### Emergency Locks

Locks are checked at request time:
- Global lock → deny all requests
- Tenant lock → deny requests for that tenant
- Module lock → deny requests for tenant+module
- Role lock → deny requests from users with that role

## Events

### Published Events

| Event | Payload | Description |
|-------|---------|-------------|
| `id.admin.tenant.created` | tenant_id, code, by | New tenant created |
| `id.admin.module.updated` | tenant_id, module, status, by | Module status changed |
| `id.admin.policy.updated` | id, key, tenant_id, by | Policy created/updated |
| `id.admin.lock.created` | id, scope, reason, by | Emergency lock activated |
| `id.admin.lock.deleted` | id, by | Lock manually removed |
| `id.admin.keys.rotated` | kid, alg, status, by | Key rotation initiated |

## Observability

### Prometheus Metrics

```
# Tenant operations
id_admin_tenant_changes_total{actor}
id_admin_module_status_total{module,status}

# Policy management
id_admin_policy_updates_total{module_scope,key}

# Emergency locks
id_admin_locks_active{scope}
id_admin_locks_created_total{scope}

# Key rotation
id_admin_key_rotation_total
id_admin_key_rotation_duration_seconds
```

### Logs

Structured JSON logs:
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "level": "info",
  "operation": "tenant.create",
  "actor_id": "admin-user-id",
  "tenant_code": "SN",
  "result": "success"
}
```

## Testing

```bash
# Structure tests
npm run structure-test

# Unit tests
npm test

# Build
npm run build
```

## Deployment

### Docker

```bash
docker build -t molam/admin-id:1.0.0 .
docker run -p 3022:3022 --env-file .env molam/admin-id:1.0.0
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: molam-admin-id
spec:
  replicas: 2
  selector:
    matchLabels:
      app: molam-admin-id
  template:
    spec:
      containers:
      - name: admin-id
        image: molam/admin-id:1.0.0
        ports:
        - containerPort: 3022
        env:
        - name: REQUIRE_STEP_UP_2FA
          value: "true"
```

## Examples

### Create Senegal Tenant

```bash
curl -X POST https://api.molam.id/v1/admin/tenants \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SN",
    "name": "Senegal",
    "default_currency": "XOF",
    "timezone": "Africa/Dakar",
    "phone_country_code": "+221",
    "email_regex": "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
    "phone_regex": "^\\+221[23678]\\d{7}$"
  }'
```

### Put Module in Maintenance Mode

```bash
curl -X PATCH https://api.molam.id/v1/admin/tenants/$TENANT_ID/modules/pay \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "maintenance",
    "maintenance_message": "Scheduled ledger upgrade 22:00-22:15 UTC"
  }'
```

### Create Global Password Policy

```bash
curl -X PUT https://api.molam.id/v1/admin/policies \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "module_scope": "global",
    "key": "password.min_length",
    "value": {"min": 10}
  }'
```

### Emergency Lock (Kill-Switch)

```bash
curl -X POST https://api.molam.id/v1/admin/locks \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "module",
    "tenant_id": "'$TENANT_ID'",
    "module_scope": "pay",
    "reason": "Security incident - unusual transaction patterns detected",
    "ttl_seconds": 900
  }'
```

### Rotate JWT Keys

```bash
curl -X POST https://api.molam.id/v1/admin/keys/rotate \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN"
```

## Troubleshooting

### Common Issues

**Issue**: `Forbidden: Superadmin access required`
- **Solution**: Ensure user has `id.admin.super` permission with global scope

**Issue**: `Emergency lock active`
- **Solution**: Check active locks with `GET /v1/admin/locks` and remove if needed

**Issue**: `Tenant code already exists`
- **Solution**: Tenant codes must be unique (ISO 3166-1 alpha-2)

## License

Proprietary - Molam Corporation

---

**For security issues, contact: security@molam.sn**

