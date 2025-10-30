# Brique 20: RBAC Granular (Fine-Grained Access Control)

Système d'autorisations à granularité fine (RBAC avancé) couvrant tous les acteurs Molam internes et externes.

## Objectifs

- Autorisations granulaires pour tous les acteurs : clients, agents, marchands, banques, employés
- Modèle RBAC avancé : rôles, permissions, scopes, policies
- Audit immuable de toutes les décisions
- Cache Redis pour performance
- Policies versionnées (GitOps)
- Principes : least privilege, separation of duties, temporary access

## Architecture

```
brique-20-rbac-granular/
├── sql/
│   ├── 020_rbac_granular.sql          # Schema RBAC
│   └── seed_rbac.sql                  # Seed data (roles + permissions)
├── src/
│   ├── rbac/
│   │   └── check.ts                   # Permission checking logic
│   ├── middleware/
│   │   └── rbac.ts                    # Express middleware
│   ├── routes/
│   │   └── rbac.ts                    # RBAC management API
│   ├── util/
│   │   ├── pg.ts                      # PostgreSQL
│   │   ├── cache.ts                   # Redis cache
│   │   └── auth.ts                    # JWT auth
│   └── server.ts                      # Main server
├── policies/
│   └── rbac-policy-v1.yaml            # Policy definition (GitOps)
├── tests/
│   └── rbac.test.ts                   # Tests
├── package.json
├── tsconfig.json
└── README.md
```

## Modèle RBAC

### Acteurs Externes

**Client** - Utilisateur particulier
- Permissions: profil, transferts P2P, orders, messages
- Scope: global
- Priority: 10

**Agent** - Agent partenaire (cash-in/out)
- Permissions: cash-in, cash-out, transactions
- Scope: pay
- Priority: 20

**Merchant** - Marchand (pro, marketplace, ONG)
- Permissions: acceptation paiements, gestion menu/produits, rapports
- Scope: pay/eats/shop
- Priority: 20

**Bank** - Banque partenaire
- Permissions: rapports financiers agrégés uniquement
- Scope: pay
- Priority: 30

### Acteurs Internes (Employés Molam)

**Super Admin** - Administrateur global
- Permissions: toutes (wildcard *)
- Scope: global
- Priority: 100

**Pay Admin** - Administrateur module Pay
- Permissions: pay.*, id.users.read, id.audit.read
- Scope: pay
- Priority: 80

**Eats/Talk/Ads/Shop Admin** - Administrateurs modules
- Permissions: {module}.*, id.users.read, id.audit.read
- Scope: {module}
- Priority: 80

**Auditor** - Auditeur (lecture seule)
- Permissions: *.read, *.audit
- Scope: global
- Priority: 70
- **Contrainte:** Justification requise

**Support** - Support client
- Permissions: id.users.read, pay.transactions.read, {module}.order.read
- Scope: global
- Priority: 40

**Marketer** - Équipe marketing
- Permissions: ads.*
- Scope: ads
- Priority: 50

**Commercial** - Équipe commerciale
- Permissions: id.users.read, reports
- Scope: global
- Priority: 50

## Permissions

### Format
```
{module}.{resource}.{action}
```

**Modules:** id, pay, eats, talk, ads, shop, free, connect, go

**Actions:** create, read, update, delete, execute, approve, audit

### Exemples
```
id.profile.read
id.profile.update
id.export.self
id.export.any
id.users.create
id.audit.read

pay.transfer.create
pay.transfer.approve
pay.cashin.create
pay.cashout.create
pay.balance.read
pay.reports.read

eats.order.create
eats.menu.manage
eats.admin.manage

talk.message.create
talk.post.delete
talk.moderation.execute

ads.campaign.create
shop.product.create
```

### Wildcards
- `pay.*` - Toutes permissions Pay
- `*.read` - Toutes permissions lecture
- `*` - Toutes permissions (super_admin uniquement)

## API

### GET /v1/rbac/permissions/me
Récupérer ses propres permissions.

**Response:**
```json
{
  "user_id": "uuid",
  "permissions": ["id.profile.read", "pay.transfer.create", ...],
  "count": 15
}
```

### GET /v1/rbac/roles/me
Récupérer ses propres rôles.

**Response:**
```json
{
  "user_id": "uuid",
  "roles": [
    {
      "id": "uuid",
      "name": "client",
      "role_type": "external",
      "module_scope": "global",
      "priority": 10
    }
  ],
  "count": 1
}
```

### POST /v1/rbac/check
Vérifier une permission pour un utilisateur (admin/auditor uniquement).

**Request:**
```json
{
  "user_id": "uuid",
  "permission": "pay.transfer.create"
}
```

**Response:**
```json
{
  "allowed": true,
  "roles": ["client"],
  "matched_permission": "pay.transfer.create",
  "reason": "permission_granted"
}
```

### POST /v1/rbac/roles/grant
Attribuer un rôle à un utilisateur (admin uniquement).

**Request:**
```json
{
  "user_id": "uuid",
  "role_name": "auditor",
  "scope_constraint": "subsidiary:PAY",
  "expires_at": "2025-12-31T23:59:59Z",
  "justification": "Q1 2025 audit"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Role granted",
  "user_id": "uuid",
  "role_name": "auditor"
}
```

### POST /v1/rbac/roles/revoke
Révoquer un rôle d'un utilisateur (admin uniquement).

**Request:**
```json
{
  "user_id": "uuid",
  "role_name": "auditor"
}
```

### GET /v1/rbac/stats
Statistiques RBAC (auditor uniquement).

**Response:**
```json
{
  "total_permissions": 42,
  "total_roles": 11,
  "total_user_roles": 1523,
  "total_audit_entries": 150234,
  "allow_count": 148923,
  "deny_count": 1311
}
```

### GET /v1/rbac/roles
Lister tous les rôles (admin).

### GET /v1/rbac/permissions
Lister toutes les permissions (admin).

### GET /v1/rbac/audit
Consulter l'audit log (auditor).

**Query Parameters:**
- `user_id` - Filtrer par utilisateur
- `decision` - Filtrer par décision (allow/deny)
- `limit` - Nombre de résultats (max 1000)
- `offset` - Pagination

## Middleware Express

### requirePermission(permCode)
Requiert une permission spécifique.

```typescript
router.post(
  "/api/transfers",
  requirePermission("pay.transfer.create"),
  async (req, res) => {
    // ... create transfer
  }
);
```

### requireAnyPermission(permCodes[])
Requiert AU MOINS UNE des permissions.

```typescript
router.get(
  "/api/reports",
  requireAnyPermission(["pay.reports.read", "pay.admin.manage"]),
  async (req, res) => {
    // ... view reports
  }
);
```

### requireAllPermissions(permCodes[])
Requiert TOUTES les permissions.

```typescript
router.post(
  "/api/admin/bulk-approve",
  requireAllPermissions(["pay.transfer.approve", "pay.admin.manage"]),
  async (req, res) => {
    // ... bulk approve
  }
);
```

### requireRole(roleName)
Requiert un rôle spécifique.

```typescript
router.get(
  "/api/admin/dashboard",
  requireRole("super_admin"),
  async (req, res) => {
    // ... admin dashboard
  }
);
```

## Cache Redis

### Performance
- Permissions utilisateur mises en cache (10 min TTL)
- Permissions de rôle mises en cache (1 heure TTL)
- Invalidation automatique lors de modifications

### Keys
```
rbac:perms:{user_id}           # User permissions
rbac:role:{role_id}:perms      # Role permissions
```

## Audit Log

### Immutable
Toutes les décisions RBAC sont enregistrées dans `molam_rbac_audit` :
- `user_id` - Utilisateur concerné
- `perm_code` - Permission vérifiée
- `decision` - allow ou deny
- `reason` - Raison de la décision
- `context` - Contexte de la requête (path, method, IP, user agent)
- `created_at` - Timestamp

### Rétention
- Pas de suppression automatique
- Archivage recommandé après 1 an

## Policies GitOps

### Versionnement
Les policies RBAC sont versionnées dans `policies/rbac-policy-v{version}.yaml`.

### Validation CI/CD
1. Lint YAML
2. Validate structure
3. Sign with Ed25519
4. Store in `molam_policy_versions`
5. Activate

### Activation
```sql
UPDATE molam_policy_versions SET is_active = FALSE;
UPDATE molam_policy_versions SET is_active = TRUE WHERE version = '1.1.0';
```

## Sécurité

### Principes

**Least Privilege**
- Aucun droit implicite
- Permissions explicites uniquement

**Separation of Duties**
- Un auditeur ≠ un admin
- Règles de conflits (auditor + admin = interdit)

**Temporary Access**
- Support for `expires_at` on role assignments
- Auto-revocation on expiry

**Bank Roles**
- Accès limité aux rapports agrégés
- Pas d'accès aux données individuelles

### Justification
- Rôle `auditor` requiert une justification
- Stockée dans `molam_user_roles.justification`
- Auditée dans logs

## Installation

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env

# Run database migrations
psql -U molam -d molam_id -f sql/020_rbac_granular.sql
psql -U molam -d molam_id -f sql/seed_rbac.sql

# Development
npm run dev

# Production
npm run build
npm start
```

## Testing

```bash
# Run tests
npm test

# Structure tests
npm run structure-test
```

## Observability

### Metrics (Prometheus)
```
rbac_decision_total{decision="allow|deny", permission}
rbac_latency_ms{p50, p95}
rbac_cache_hit_rate
```

### Alerts
- Deny rate > 5% (possible misconfiguration)
- Latency p95 > 100ms
- Cache hit rate < 80%

## Example Usage

### Check Permission in Code
```typescript
import { checkPermission } from "./rbac/check";

const allowed = await checkPermission(
  userId,
  "pay.transfer.create",
  { path: req.path, method: req.method }
);

if (!allowed) {
  return res.status(403).json({ error: "Forbidden" });
}
```

### Grant Role Programmatically
```typescript
import { grantRole } from "./rbac/check";

await grantRole(
  userId,
  "auditor",
  adminUserId,
  {
    justification: "Q1 2025 compliance audit",
    expiresAt: new Date("2025-03-31"),
  }
);
```

### Get User Permissions
```typescript
import { getUserPermissions } from "./rbac/check";

const permissions = await getUserPermissions(userId);
console.log(permissions); // ["id.profile.read", "pay.transfer.create", ...]
```

## License

UNLICENSED - Propriété de Molam
