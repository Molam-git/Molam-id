# Brique 13 — Blacklist & Suspensions

Service centralisé de gestion des **bannis, fraudes et suspensions** pour l'écosystème Molam, permettant le bannissement global ou par module avec audit complet et propagation d'événements vers SIRA.

## 🎯 Objectifs

- **Bannissement global** : Bloquer l'accès à tout l'écosystème Molam
- **Bannissement par module** : Suspendre l'accès à un module spécifique (Pay, Eats, Shop, etc.)
- **Temporaire ou permanent** : Suspensions avec expiration automatique ou bannissements permanents
- **Audit immuable** : Traçabilité complète de toutes les actions
- **Intégration SIRA** : Propagation d'événements vers le moteur d'analyse de risque

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Blacklist Service (Port 3013)                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Add to     │  │   Revoke     │  │    Check     │      │
│  │  Blacklist   │  │  Blacklist   │  │  Blacklist   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  List All    │  │ Auto-Expire  │  │ Event Emit   │      │
│  │  (Admin)     │  │   (Cron)     │  │   (SIRA)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                      Authorization                           │
│  • JWT RS256           • Scope-based (RBAC)                 │
│  • Global/Module scope • Status tracking                     │
└─────────────────────────────────────────────────────────────┘
         │                           │
    PostgreSQL                    Redis
  (Blacklist, Audit)          (Active cache)
         │
       SIRA
  (Event stream)
```

## 📊 Base de données

### Tables principales

#### `molam_blacklist`
Bannissements et suspensions.

```sql
CREATE TABLE molam_blacklist (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  scope suspension_scope,              -- 'global' ou 'module'
  module TEXT,                         -- NULL pour global, 'pay'/'eats' pour module
  reason TEXT NOT NULL,
  issued_by UUID NOT NULL,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,                  -- NULL = permanent
  status TEXT,                         -- 'active', 'revoked', 'expired'
  metadata JSONB,                      -- Contexte supplémentaire
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### `molam_blacklist_audit`
Audit trail immuable.

```sql
CREATE TABLE molam_blacklist_audit (
  id UUID PRIMARY KEY,
  blacklist_id UUID,
  action TEXT NOT NULL,                -- 'add', 'revoke', 'expire', 'check'
  actor_id UUID NOT NULL,
  detail JSONB,
  ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ
);
```

### Fonctions SQL

#### `expire_suspensions()`
Expire automatiquement les suspensions temporaires.

```sql
SELECT expire_suspensions();  -- Retourne le nombre de suspensions expirées
```

#### `is_user_blacklisted(user_id, module)`
Vérifie si un utilisateur est blacklisté.

```sql
SELECT * FROM is_user_blacklisted('user-uuid', 'pay');
-- Retourne: is_blacklisted, scope, reason, blacklist_id
```

## 🔌 API Endpoints

### Blacklist Management

#### POST /v1/blacklist
Ajouter un utilisateur à la blacklist.

**Headers:**
```
Authorization: Bearer <JWT>
X-Scope: id:blacklist:add
```

**Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "scope": "global",
  "reason": "Fraud detected - multiple chargebacks",
  "end_at": "2024-12-31T23:59:59Z",
  "metadata": {
    "fraud_score": 95,
    "incident_ids": ["inc-001", "inc-002"]
  }
}
```

**Module-specific:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "scope": "module",
  "module": "pay",
  "reason": "Payment abuse",
  "end_at": null
}
```

**Response (201):**
```json
{
  "blacklist_id": "blacklist-uuid",
  "status": "active",
  "message": "User added to blacklist"
}
```

#### POST /v1/blacklist/:id/revoke
Révoquer un bannissement.

**Body:**
```json
{
  "reason": "Appeal approved"
}
```

**Response (200):**
```json
{
  "message": "Blacklist entry revoked",
  "blacklist_id": "blacklist-uuid"
}
```

#### GET /v1/blacklist/check/:user_id
Vérifier si un utilisateur est blacklisté.

**Query params:**
- `module` (optionnel): Vérifier pour un module spécifique

**Response (200):**
```json
{
  "user_id": "user-uuid",
  "is_blacklisted": true,
  "scope": "global",
  "reason": "Fraud detected",
  "blacklist_id": "blacklist-uuid"
}
```

#### GET /v1/blacklist
Lister les entrées de blacklist (admin uniquement).

**Query params:**
- `status`: active, revoked, expired (optionnel)
- `scope`: global, module (optionnel)
- `module`: pay, eats, etc. (optionnel)
- `limit`: nombre max de résultats (défaut: 50)
- `offset`: pagination (défaut: 0)

**Response (200):**
```json
{
  "blacklists": [
    {
      "id": "blacklist-uuid",
      "user_id": "user-uuid",
      "scope": "global",
      "reason": "Fraud detected",
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1,
  "limit": 50,
  "offset": 0
}
```

#### GET /v1/blacklist/:id
Obtenir les détails d'une entrée blacklist avec audit trail.

**Response (200):**
```json
{
  "blacklist": {
    "id": "blacklist-uuid",
    "user_id": "user-uuid",
    "scope": "global",
    "reason": "Fraud detected",
    "status": "active",
    "metadata": {
      "fraud_score": 95
    }
  },
  "audit_trail": [
    {
      "action": "add",
      "actor_id": "admin-uuid",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## 🔐 Sécurité

### Authentication & Authorization
- **JWT RS256** avec scopes:
  - `id:blacklist:add` - Ajouter à la blacklist
  - `id:blacklist:revoke` - Révoquer
  - `id:blacklist:check` - Vérifier statut
  - `id:blacklist:list` - Lister (admin)

### Audit trail
- Tous les événements enregistrés dans `molam_blacklist_audit`
- Actions: add, revoke, expire, check, update
- IP + user agent conservés
- Immuable (pas de DELETE/UPDATE)

### Cache Redis
- TTL: 5 minutes
- Invalidation automatique lors de modifications
- Key pattern: `id:blacklist:user:{user_id}:blacklist:{module|global}`

## 📈 Cas d'usage

### 1. Bannissement global (fraude avérée)
```json
{
  "user_id": "fraudster-uuid",
  "scope": "global",
  "reason": "Multiple fraud incidents confirmed",
  "end_at": null,
  "metadata": {
    "fraud_score": 98,
    "incident_count": 5
  }
}
```
→ L'utilisateur ne peut plus accéder à aucun module Molam

### 2. Suspension temporaire (Pay)
```json
{
  "user_id": "user-uuid",
  "scope": "module",
  "module": "pay",
  "reason": "KYC verification pending",
  "end_at": "2024-01-08T00:00:00Z"
}
```
→ L'utilisateur peut toujours accéder à Eats/Shop, mais pas Pay pendant 7 jours

### 3. Suspension permanente (module)
```json
{
  "user_id": "user-uuid",
  "scope": "module",
  "module": "eats",
  "reason": "Driver license revoked",
  "end_at": null
}
```
→ Le conducteur ne peut plus livrer pour Eats, mais peut utiliser d'autres modules

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
  query("SELECT expire_suspensions()");
}, 5 * 60 * 1000);
```

## 📦 Intégrations

### SIRA (Risk Analysis)
Événements émis:
- `blacklist.added` - Nouvelle entrée blacklist
- `blacklist.revoked` - Révocation

### Brique 3 (AuthZ)
Vérifier la blacklist avant d'appliquer RBAC:
```typescript
// Check if user is blacklisted
const check = await fetch(`${blacklistService}/v1/blacklist/check/${userId}?module=pay`);
if (check.is_blacklisted) {
  throw new Error("User is blacklisted");
}
```

### Brique 6 (Audit)
Audit centralisé de toutes les actions blacklist.

## 🔧 Configuration

Voir [.env.example](.env.example) pour les variables d'environnement requises.

**Limites par défaut:**
- Auto-expire check: 5 minutes
- Cache TTL: 5 minutes
- Default temp duration: 24 heures
- Max temp duration: 365 jours

## 📚 Documentation

- [API Reference](docs/api.md)
- [Integration Guide](docs/integration.md)
- [Security Model](docs/security.md)

## 🆘 Support

- **Email**: support@molam.com
- **Docs**: https://docs.molam.com/blacklist
- **Status**: https://status.molam.com

## 📄 License

PROPRIETARY - © 2024 Molam
