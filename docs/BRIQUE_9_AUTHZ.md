# Brique 9 - AuthZ ext_authz / Envoy Integration (OPA-based)

## 📋 Vue d'ensemble

La **Brique 9** implémente un système centralisé d'autorisation (AuthZ) pour tous les modules Molam (ID, Pay, Eats, Talk, Ads, Shop, Free). Le système combine :

- **RBAC** (Role-Based Access Control) - Contrôle d'accès basé sur les rôles
- **ABAC** (Attribute-Based Access Control) - Contrôle d'accès basé sur les attributs
- **SIRA Integration** - Ajustement dynamique basé sur le score de risque
- **Envoy ext_authz** - Intégration avec proxy Envoy pour autorisation distribuée
- **Cache haute performance** - Décisions en <5ms (cache) / <50ms (non-caché)
- **Audit immuable** - Traçabilité complète de toutes les décisions

---

## 🏗️ Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│            Envoy Proxy                  │
│  (Port 8080 - ext_authz enabled)        │
└──────┬──────────────────────┬───────────┘
       │                      │
       │ 1. Authorization     │ 3. Forward if allowed
       │    Request           │
       ▼                      ▼
┌──────────────────┐   ┌──────────────────┐
│   AuthZ API      │   │  Backend Service │
│  (Port 4300)     │   │  (Pay/Eats/etc.) │
└────────┬─────────┘   └──────────────────┘
         │
         ▼
┌──────────────────┐
│   PostgreSQL     │
│  (Authorization  │
│   Data + Audit)  │
└──────────────────┘
```

---

## 📁 Structure des fichiers

```
Molam-id/
├── sql/
│   └── 009_authz_schema.sql              # Schéma SQL complet
├── services/
│   └── authz-api/
│       ├── package.json
│       ├── Dockerfile
│       ├── .env.example
│       └── src/
│           ├── index.js                  # API principale
│           ├── db.js                     # Connexion DB
│           └── siraIntegration.js        # Intégration SIRA
├── infra/
│   ├── envoy-authz.yaml                  # Config Envoy
│   └── docker-compose.authz.yaml         # Stack complète
├── src/
│   └── test_brique9.js                   # Tests complets
└── docs/
    └── BRIQUE_9_AUTHZ.md                 # Cette documentation
```

---

## 🗄️ Schéma de base de données

### Tables principales

#### 1. `molam_roles`
Stocke les rôles utilisateur par module.

```sql
CREATE TABLE molam_roles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES molam_users(id),
  module TEXT NOT NULL,              -- pay, eats, ads, talk, shop, free, id
  access_scope TEXT NOT NULL,        -- read, write, admin
  trusted_level INTEGER DEFAULT 0,   -- 0-100 (niveau de confiance)
  granted_by UUID,                   -- Qui a accordé ce rôle
  expires_at TIMESTAMPTZ,            -- Expiration optionnelle
  last_active TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);
```

**Exemple :**
```sql
INSERT INTO molam_roles (user_id, module, access_scope, trusted_level)
VALUES ('user-uuid', 'pay', 'write', 50);
```

#### 2. `molam_attributes`
Stocke les attributs utilisateur pour ABAC.

```sql
CREATE TABLE molam_attributes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES molam_users(id),
  key TEXT NOT NULL,      -- device_type, kyc_level, country, sira_score, etc.
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ,
  UNIQUE(user_id, key)
);
```

**Exemple :**
```sql
INSERT INTO molam_attributes (user_id, key, value) VALUES
  ('user-uuid', 'kyc_level', 'P2'),
  ('user-uuid', 'sira_score', '85'),
  ('user-uuid', 'country', 'SN');
```

#### 3. `molam_authz_audit`
Log immuable de toutes les décisions d'autorisation.

```sql
CREATE TABLE molam_authz_audit (
  id UUID PRIMARY KEY,
  user_id UUID,
  molam_id TEXT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT,
  decision TEXT NOT NULL,           -- allow / deny
  reason TEXT,
  policy_version TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  sira_score INTEGER,
  latency_ms INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 4. `molam_authz_cache`
Cache des décisions d'autorisation pour performance.

```sql
CREATE TABLE molam_authz_cache (
  cache_key TEXT PRIMARY KEY,
  user_id UUID,
  module TEXT,
  action TEXT,
  decision TEXT,
  reason TEXT,
  policy_version TEXT,
  context_hash TEXT,
  expires_at TIMESTAMPTZ
);
```

#### 5. `molam_policies`
Stocke les politiques d'autorisation (OPA-style).

```sql
CREATE TABLE molam_policies (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE,
  version TEXT,
  module TEXT,
  description TEXT,
  policy_content JSONB,    -- Règles de politique
  is_active BOOLEAN,
  priority INTEGER
);
```

**Exemple de politique :**
```json
{
  "rules": [
    {
      "condition": "kyc_level IN ('P2', 'P3')",
      "sira_threshold": 70,
      "action": "transfer",
      "effect": "allow"
    }
  ]
}
```

#### 6. `molam_role_hierarchy`
Définit l'héritage des rôles (admin > write > read).

---

## 🚀 API Endpoints

### 1. **POST /v1/authz/decide** (Principal)
Prend une décision d'autorisation.

**Request:**
```json
{
  "user_id": "uuid",
  "molam_id": "MOLAM-SN-00000001",
  "module": "pay",
  "action": "transfer",
  "resource": "/api/pay/transfer",
  "context": {
    "device": "android",
    "ip": "192.168.1.1",
    "kyc_level": "P2",
    "sira_score": 75,
    "country": "SN",
    "amount": 50000
  }
}
```

**Response:**
```json
{
  "decision": "allow",
  "reason": "Role-based and policy-based checks passed",
  "policy_version": "v1.0",
  "audit_id": "uuid",
  "latency_ms": 12,
  "cache_hit": false,
  "roles": ["write"]
}
```

### 2. **GET /v1/authz/users/:userId/roles**
Liste tous les rôles d'un utilisateur.

**Response:**
```json
{
  "user_id": "uuid",
  "roles": [
    {
      "module": "pay",
      "access_scope": "write",
      "trusted_level": 50,
      "expires_at": null,
      "last_active": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### 3. **GET /v1/authz/users/:userId/attributes**
Liste tous les attributs d'un utilisateur.

### 4. **POST /v1/authz/users/:userId/attributes**
Définit/met à jour un attribut.

**Request:**
```json
{
  "key": "sira_score",
  "value": "85"
}
```

### 5. **GET /v1/authz/audit**
Interroge les logs d'audit.

**Query params:** `user_id`, `module`, `decision`, `limit`

### 6. **DELETE /v1/authz/cache**
Vide le cache (admin only).

**Query params:** `user_id` (optionnel - pour un utilisateur spécifique)

---

## 🔐 Logique d'autorisation

### Flux de décision

```
1. Vérifier le cache → Si trouvé, retourner décision
2. Récupérer les rôles de l'utilisateur (RBAC)
   ├─ Si aucun rôle → DENY
   └─ Si rôles trouvés → continuer
3. Récupérer les attributs (ABAC)
4. Récupérer le score SIRA (si activé)
5. Vérifier les rôles requis pour l'action
   ├─ admin → autorise tout
   ├─ write → autorise read, write, create, update
   └─ read → autorise seulement read
6. Évaluer les politiques (ABAC)
   ├─ Vérifier KYC level
   ├─ Vérifier SIRA score
   ├─ Vérifier horaires (business hours)
   └─ Vérifier pays/localisation
7. Si toutes les vérifications passent → ALLOW
8. Sinon → DENY
9. Mettre en cache la décision
10. Logger dans l'audit
11. Retourner la décision
```

### Exemple de décisions

#### ✅ ALLOW - Client avec KYC P2 + SIRA 85
```
User: client (write role in pay)
KYC: P2
SIRA: 85
Action: transfer
Decision: ALLOW (rôle write + KYC P2 + SIRA >= 70)
```

#### ❌ DENY - Merchant avec KYC P0 + SIRA 45
```
User: merchant (read role in pay)
KYC: P0
SIRA: 45
Action: transfer
Decision: DENY (SIRA score 45 below threshold 70)
```

#### ❌ DENY - Hors horaires d'affaires
```
User: client (write role)
Time: 22:00
Action: transfer_high_value
Decision: DENY (Outside business hours 6-20)
```

---

## 🔧 Installation & Déploiement

### Option 1: Docker Compose (Recommandé)

```bash
# 1. Créer fichier .env pour authz-api
cd services/authz-api
cp .env.example .env
# Éditer .env avec vos paramètres

# 2. Lancer la stack complète
cd ../..
docker-compose -f infra/docker-compose.authz.yaml up -d

# 3. Vérifier les services
docker-compose -f infra/docker-compose.authz.yaml ps

# 4. Voir les logs
docker-compose -f infra/docker-compose.authz.yaml logs -f authz-api
```

### Option 2: Installation manuelle

```bash
# 1. Installer PostgreSQL et créer la base de données
psql -U postgres -c "CREATE DATABASE molam_id;"

# 2. Appliquer le schéma
psql -U postgres -d molam_id -f sql/009_authz_schema.sql

# 3. Installer et démarrer authz-api
cd services/authz-api
npm install
cp .env.example .env
# Éditer .env
npm start

# 4. (Optionnel) Démarrer Envoy
docker run -v $(pwd)/infra:/etc/envoy \
  -p 8080:8080 -p 9901:9901 \
  envoyproxy/envoy:v1.28-latest \
  -c /etc/envoy/envoy-authz.yaml
```

### Option 3: Development (sans Docker)

```bash
# 1. Démarrer authz-api en mode dev
cd services/authz-api
npm install
npm run dev

# 2. Dans un autre terminal, tester avec curl
curl -X POST http://localhost:4300/v1/authz/decide \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-uuid",
    "module": "pay",
    "action": "read"
  }'
```

---

## 🧪 Tests

### Lancer les tests automatisés

```bash
# 1. S'assurer que PostgreSQL est démarré
# 2. Lancer le script de test
node src/test_brique9.js
```

### Tests couverts

- ✅ Création du schéma SQL
- ✅ Création d'utilisateurs de test
- ✅ Assignation de rôles (RBAC)
- ✅ Définition d'attributs (ABAC)
- ✅ Décisions d'autorisation
- ✅ Évaluation de politiques
- ✅ Logging d'audit
- ✅ Fonctionnalité de cache
- ✅ Nettoyage de cache expiré
- ✅ Benchmarks de performance

### Tests manuels avec curl

#### Test 1: Décision d'autorisation
```bash
curl -X POST http://localhost:4300/v1/authz/decide \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your-user-uuid",
    "molam_id": "MOLAM-SN-00000001",
    "module": "pay",
    "action": "transfer",
    "context": {
      "sira_score": 85,
      "kyc_level": "P2"
    }
  }'
```

#### Test 2: Lister les rôles
```bash
curl http://localhost:4300/v1/authz/users/your-user-uuid/roles
```

#### Test 3: Définir un attribut
```bash
curl -X POST http://localhost:4300/v1/authz/users/your-user-uuid/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "key": "sira_score",
    "value": "90"
  }'
```

#### Test 4: Voir les logs d'audit
```bash
curl "http://localhost:4300/v1/authz/audit?module=pay&limit=10"
```

---

## 📊 Intégration SIRA

### Score SIRA et niveaux de risque

| Score SIRA | Niveau de risque | Opérations autorisées |
|-----------|------------------|----------------------|
| 0-40      | High             | Read seulement       |
| 41-69     | Medium           | Read, Write (limité) |
| 70-89     | Low              | La plupart des ops   |
| 90-100    | Very Low         | Toutes les ops       |

### Configuration SIRA

Dans `.env`:
```env
SIRA_ENABLED=true
SIRA_API_URL=http://sira-service:5000
SIRA_MIN_SCORE_THRESHOLD=70
```

### Mode Mock (développement)

```javascript
import { mockSiraService } from './siraIntegration.js';

// Calculer un score simulé
const score = mockSiraService.calculateMockScore(userId, {
  kyc_level: 'P2',
  account_age_months: 12
});
```

---

## 🔍 Monitoring & Observabilité

### Métriques importantes

1. **Latence de décision**
   - Cible: <5ms (cache) / <50ms (non-caché)
   - Alerter si P95 > 50ms

2. **Taux de cache hit**
   - Cible: >80%
   - Vérifier avec: `SELECT cache_hit, COUNT(*) FROM molam_authz_audit GROUP BY cache_hit`

3. **Ratio ALLOW/DENY**
   - Surveiller les pics de DENY (possibles attaques)
   - Query: `SELECT decision, COUNT(*) FROM molam_authz_audit GROUP BY decision`

### Endpoints de monitoring

- **Health check**: `GET /health`
- **Envoy admin**: `http://localhost:9901` (stats, config, etc.)
- **Audit logs**: `GET /v1/authz/audit`

### Dashboards Grafana (recommandé)

```promql
# Latence moyenne des décisions
avg(molam_authz_latency_ms)

# Taux d'erreur
rate(molam_authz_decisions{decision="deny"}[5m])

# Taille du cache
molam_authz_cache_size
```

---

## 🛡️ Sécurité

### Bonnes pratiques

1. **mTLS entre Envoy et AuthZ** (production)
   ```yaml
   # Dans envoy-authz.yaml
   transport_socket:
     name: envoy.transport_sockets.tls
     typed_config:
       common_tls_context:
         tls_certificates:
         - certificate_chain: { filename: "/certs/client.crt" }
           private_key: { filename: "/certs/client.key" }
   ```

2. **Validation JWT côté Envoy**
   - Extraire `user_id` du JWT avant d'appeler AuthZ

3. **Politiques versionnées dans Git**
   - `policies/v1.0/pay_transfer.json`
   - Review via Pull Requests

4. **Audit immuable**
   - Jamais de DELETE sur `molam_authz_audit`
   - Export S3 quotidien pour archivage

5. **Rate limiting**
   - Limiter les appels à `/v1/authz/decide` par IP/user

### Red Team Drills

Tests de pénétration réguliers :
- ✅ Tentative d'élévation de privilège
- ✅ Bypass de cache
- ✅ Injection SQL dans contexte
- ✅ Replay d'anciennes décisions

---

## 🚦 Migration & Rollout

### Phase 1: Staging (Semaine 1)
```bash
# Déployer authz-api en staging
docker-compose -f infra/docker-compose.authz.yaml up -d

# Activer Envoy ext_authz UNIQUEMENT pour routes read-only
# Modifier envoy-authz.yaml pour désactiver sur routes critiques
```

### Phase 2: Canary (Semaine 2)
- Activer pour 10% du trafic
- Surveiller faux positifs (DENY inappropriés)
- Dashboards Grafana + alertes PagerDuty

### Phase 3: Routes critiques (Semaine 3-4)
- Étendre aux routes de paiement
- Rollback plan en place
- Feature flag pour désactiver rapidement

### Phase 4: Enforcement complet (Semaine 5+)
- Après 2 semaines de trafic stable
- Désactiver ancien système RBAC (Brique 6)
- Célébration ! 🎉

---

## 🐛 Troubleshooting

### Problème: Décisions lentes (>50ms)

**Diagnostic:**
```sql
SELECT action, AVG(latency_ms), MAX(latency_ms)
FROM molam_authz_audit
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY action
ORDER BY AVG(latency_ms) DESC;
```

**Solution:**
- Vérifier les index DB
- Augmenter le pool de connexions
- Optimiser les requêtes de politiques

### Problème: Faux positifs (DENY inappropriés)

**Diagnostic:**
```sql
SELECT user_id, reason, COUNT(*)
FROM molam_authz_audit
WHERE decision = 'deny'
  AND created_at > NOW() - INTERVAL '1 day'
GROUP BY user_id, reason
ORDER BY COUNT(*) DESC
LIMIT 10;
```

**Solution:**
- Ajuster les seuils SIRA
- Mettre à jour les politiques
- Whitelist temporaire

### Problème: Cache non invalidé

**Solution:**
```bash
# Vider le cache manuellement
curl -X DELETE http://localhost:4300/v1/authz/cache

# Ou pour un utilisateur spécifique
curl -X DELETE "http://localhost:4300/v1/authz/cache?user_id=uuid"
```

---

## 📚 Références

- [Envoy ext_authz docs](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_authz_filter)
- [Open Policy Agent (OPA)](https://www.openpolicyagent.org/)
- [NIST RBAC Model](https://csrc.nist.gov/projects/role-based-access-control)
- [ABAC Guide](https://www.nist.gov/publications/guide-attribute-based-access-control-abac-definition-and-considerations)

---

## 🎯 Prochaines étapes (Roadmap)

- [ ] Intégration OPA native (Rego policies)
- [ ] GraphQL API pour requêtes complexes
- [ ] ML-based risk scoring (auto-ajustement SIRA)
- [ ] Multi-tenancy (isolation par tenant)
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Policy testing framework (OPA Rego tests)

---

## ✅ Checklist de déploiement

- [ ] Base de données PostgreSQL configurée
- [ ] Schéma SQL appliqué (`009_authz_schema.sql`)
- [ ] AuthZ API déployé et health check OK
- [ ] Envoy proxy configuré avec ext_authz
- [ ] Variables d'environnement définies
- [ ] Tests automatisés passent (100%)
- [ ] Monitoring configuré (Grafana/Prometheus)
- [ ] Logs d'audit vérifiés
- [ ] Cache fonctionne (hit rate >80%)
- [ ] Performance validée (<5ms cache, <50ms non-cache)
- [ ] Documentation lue et comprise
- [ ] Équipe formée sur le système
- [ ] Runbook incident créé
- [ ] Rollback plan documenté

---

**Brique 9 - AuthZ est maintenant prête pour la production ! 🚀**
