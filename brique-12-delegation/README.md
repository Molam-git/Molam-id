# Brique 12 — Delegated Access / Role by Context

Service de gestion des **délégations d'accès temporaires et contextuelles** pour Molam ID, permettant la délégation de rôles et permissions entre utilisateurs avec workflow d'approbation.

## 🎯 Objectifs

- **Délégations temporaires** : Accès limité dans le temps avec expiration automatique
- **Contextuelles** : Par module (Pay, Eats, Shop, etc.), pays, et scope (montants, opérations)
- **Workflow d'approbation** : Validation simple ou multiple (2+ signataires)
- **Multi-utilisateurs** : Particuliers, marchands, employés internes par filiale
- **Audit complet** : Traçabilité immuable de toutes les délégations

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Delegation Service (Port 3012)                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Create     │  │   Approve    │  │   Revoke     │      │
│  │  Delegation  │  │  (Workflow)  │  │  (Cancel)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   List Mine  │  │  Templates   │  │  Auto-Expire │      │
│  │  (Grantee)   │  │  (Presets)   │  │   (Cron)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                      Authorization                           │
│  • JWT RS256           • Scope-based (RBAC)                 │
│  • Multi-approval      • Context validation                  │
└─────────────────────────────────────────────────────────────┘
         │                           │
    PostgreSQL                    Redis
  (Delegations, Audit)       (Active cache)
```

## 📊 Base de données

### Tables principales

#### `molam_delegations`
Délégations d'accès avec workflow d'approbation.

```sql
CREATE TABLE molam_delegations (
  id UUID PRIMARY KEY,
  granter_id UUID NOT NULL,                -- celui qui délègue
  grantee_id UUID NOT NULL,                -- bénéficiaire
  module TEXT NOT NULL,                    -- pay, eats, shop, etc.
  role TEXT NOT NULL,                      -- cashier, auditor, pay_admin
  country_code CHAR(3) NOT NULL,           -- SEN, CIV, GHA
  scope JSONB,                             -- {"limit": 50000, "currency": "XOF"}
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status delegation_status,                -- pending, active, revoked, expired
  approvers UUID[],
  approval_required_count SMALLINT,
  approvals_received SMALLINT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### `molam_delegation_approvals`
Approbations individuelles des délégations.

```sql
CREATE TABLE molam_delegation_approvals (
  id UUID PRIMARY KEY,
  delegation_id UUID NOT NULL,
  approver_id UUID NOT NULL,
  approved BOOLEAN NOT NULL,               -- true/false (reject)
  comment TEXT,
  created_at TIMESTAMPTZ
);
```

#### `molam_delegation_audit`
Audit trail immuable.

```sql
CREATE TABLE molam_delegation_audit (
  id UUID PRIMARY KEY,
  delegation_id UUID,
  action TEXT NOT NULL,                    -- create, approve, reject, revoke, expire, use
  actor_id UUID,
  detail JSONB,
  ip INET,
  created_at TIMESTAMPTZ
);
```

#### `molam_delegation_templates`
Templates prédéfinis par module/rôle.

```sql
CREATE TABLE molam_delegation_templates (
  id UUID PRIMARY KEY,
  module TEXT NOT NULL,
  role TEXT NOT NULL,
  label TEXT NOT NULL,                     -- "Caissier temporaire"
  description TEXT,
  default_duration_hours INT,
  default_scope JSONB,
  requires_approval BOOLEAN,
  min_approvers SMALLINT,
  allowed_granter_roles TEXT[],
  is_active BOOLEAN
);
```

## 🔌 API Endpoints

### Délégations

#### POST /v1/delegations
Créer une nouvelle délégation.

**Headers:**
```
Authorization: Bearer <JWT>
X-Scope: id:delegation:create
```

**Body:**
```json
{
  "grantee_id": "550e8400-e29b-41d4-a716-446655440000",
  "module": "pay",
  "role": "cashier",
  "country_code": "SEN",
  "scope": {
    "limit": 50000,
    "currency": "XOF",
    "operations": ["view", "create_payment"]
  },
  "start_at": "2024-01-01T00:00:00Z",
  "end_at": "2024-01-02T00:00:00Z",
  "approvers": ["admin-uuid-1", "admin-uuid-2"],
  "template_id": "template-uuid"
}
```

**Response (201):**
```json
{
  "delegation_id": "delegation-uuid",
  "status": "pending",
  "requires_approval": true,
  "approvers_required": 2
}
```

#### POST /v1/delegations/:id/approve
Approuver une délégation (si dans la liste des approvers).

**Body:**
```json
{
  "comment": "Approved for 24h access"
}
```

**Response (200):**
```json
{
  "status": "active",
  "message": "Delegation activated"
}
```

#### POST /v1/delegations/:id/reject
Rejeter une délégation.

**Body:**
```json
{
  "comment": "Insufficient justification"
}
```

#### POST /v1/delegations/:id/revoke
Révoquer une délégation active (granter ou admin).

**Body:**
```json
{
  "reason": "Emergency revocation"
}
```

#### GET /v1/delegations/mine
Lister les délégations actives pour l'utilisateur actuel (en tant que grantee).

**Response (200):**
```json
{
  "delegations": [
    {
      "id": "delegation-uuid",
      "granter_id": "granter-uuid",
      "module": "pay",
      "role": "cashier",
      "country_code": "SEN",
      "scope": {"limit": 50000, "currency": "XOF"},
      "start_at": "2024-01-01T00:00:00Z",
      "end_at": "2024-01-02T00:00:00Z",
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### GET /v1/delegations/granted
Lister les délégations créées par l'utilisateur actuel (en tant que granter).

**Query params:**
- `status`: pending, active, revoked, expired (optionnel)

#### GET /v1/delegations/templates
Lister les templates de délégation disponibles.

**Response (200):**
```json
{
  "templates": [
    {
      "id": "template-uuid",
      "module": "pay",
      "role": "cashier",
      "label": "Caissier temporaire",
      "description": "Délégation pour encaisser des paiements",
      "default_duration_hours": 24,
      "default_scope": {"limit": 50000, "currency": "XOF"},
      "requires_approval": false,
      "min_approvers": 0,
      "allowed_granter_roles": ["pay_admin", "pay_manager"]
    }
  ]
}
```

#### GET /v1/delegations/:id
Obtenir les détails d'une délégation (granter, grantee, ou admin).

**Response (200):**
```json
{
  "delegation": {
    "id": "delegation-uuid",
    "granter_id": "granter-uuid",
    "grantee_id": "grantee-uuid",
    "module": "pay",
    "role": "cashier",
    "country_code": "SEN",
    "scope": {"limit": 50000, "currency": "XOF"},
    "status": "active",
    "approvals": [
      {
        "approver_id": "approver-uuid",
        "approved": true,
        "comment": "Approved",
        "created_at": "2024-01-01T10:00:00Z"
      }
    ],
    "audit_trail": [
      {
        "action": "create",
        "actor_id": "granter-uuid",
        "created_at": "2024-01-01T00:00:00Z"
      },
      {
        "action": "approve",
        "actor_id": "approver-uuid",
        "created_at": "2024-01-01T10:00:00Z"
      }
    ]
  }
}
```

## 🔐 Sécurité

### Authentication & Authorization
- **JWT RS256** avec scopes:
  - `id:delegation:create` - Créer une délégation
  - `id:delegation:approve` - Approuver/rejeter
  - `id:delegation:revoke` - Révoquer

### Workflow d'approbation
- **Simple**: Pas d'approbation requise (auto-active)
- **Multiple**: 1-N signataires requis

### Limites
- **Durée max**: 720 heures (30 jours)
- **Expiration automatique**: Vérification toutes les 5 minutes
- **Cache Redis**: Invalidation automatique lors de modifications

### Audit trail
- Tous les événements enregistrés dans `molam_delegation_audit`
- Actions: create, approve, reject, activate, revoke, expire, use
- IP + metadata conservés

## 📈 Cas d'usage

### 1. Caissier temporaire (Pay)
```json
{
  "grantee_id": "cashier-uuid",
  "module": "pay",
  "role": "cashier",
  "country_code": "SEN",
  "scope": {"limit": 50000, "currency": "XOF"},
  "end_at": "2024-01-02T23:59:59Z"
}
```
→ Employé peut encaisser jusqu'à 50,000 XOF pendant 24h

### 2. Auditeur remplaçant (Pay Admin)
```json
{
  "grantee_id": "auditor-uuid",
  "module": "pay",
  "role": "auditor",
  "country_code": "SEN",
  "scope": {"operations": ["view", "export"]},
  "end_at": "2024-01-08T00:00:00Z",
  "approvers": ["admin-uuid"],
  "template_id": "auditor-template"
}
```
→ Accès audit read-only pour 7 jours avec validation admin

### 3. Livreur multi-modules (Eats → Shop)
```json
{
  "grantee_id": "driver-uuid",
  "module": "shop",
  "role": "delivery",
  "country_code": "SEN",
  "scope": {"operations": ["view_orders", "update_status"]},
  "end_at": "2024-01-03T23:59:59Z"
}
```
→ Livreur Eats peut aussi livrer pour Shop temporairement

### 4. Accès USSD délégué (Particuliers)
Via `*131*99#` → Menu de délégation:
```
CON Déléguer accès
1. Compte proche (24h)
2. Caisse commerce (7j)
3. Consultation uniquement
```

## 🧪 Tests

```bash
# Install dependencies
npm install

# Run tests
npm test

# Structure tests
node test_structure.cjs
```

## 🚀 Déploiement

### Kubernetes

```bash
kubectl apply -f k8s/deployment.yaml
```

**Secrets requis:**
- `postgres-secret`: DATABASE_URL
- `redis-secret`: REDIS_URL
- `jwt-keys`: JWT_PUBLIC_KEY

### Cron Job (Auto-expiration)
Intégré dans le service - vérifie toutes les 5 minutes:
```typescript
setInterval(() => {
  query("SELECT expire_delegations()");
}, 5 * 60 * 1000);
```

## 📦 Intégrations

### Brique 3 (AuthZ)
Vérifier les délégations actives avant d'appliquer RBAC:
```typescript
// Check if user has active delegation for module/role
const delegation = await checkActiveDelegation(userId, module, role);
if (delegation) {
  // Apply delegated permissions within scope
  permissions = mergeDelegatedScope(permissions, delegation.scope);
}
```

### Brique 10 (Device)
Device trust level influence approbation:
```typescript
if (device_trust < 'medium' && delegation.role === 'pay_admin') {
  requires_approval = true;
  min_approvers = 2;
}
```

### SIRA (Risk)
Signaux de risque envoyés:
- Délégations inhabituelles (rôle élevé, durée longue)
- Approbations en cascade (même IP/device)
- Révocations fréquentes

## 🔧 Configuration

Voir `.env.example` pour les variables d'environnement requises.

**Limites par défaut:**
- Durée max: 720 heures (30 jours)
- Durée par défaut: 24 heures
- Cache TTL: 5 minutes
- Auto-expire check: 5 minutes

## 📚 Documentation

- [API Reference](docs/api.md)
- [Integration Guide](docs/integration.md)
- [Security Model](docs/security.md)

## 🆘 Support

- **Email**: support@molam.com
- **Docs**: https://docs.molam.com/delegation
- **Status**: https://status.molam.com

## 📄 License

PROPRIETARY - © 2024 Molam
