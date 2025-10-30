# Brique 14 — Audit logs centralisés

Service d'**audit immuable**, multi-filiales, avec **chaînage cryptographique**, **archivage WORM** (Write Once Read Many), et ingestion haute performance via **HTTP** ou **Kafka**.

## 🎯 Objectifs

- **Traçabilité complète** : Toutes les actions sensibles tracées (auth, KYC, transactions, admin, SIRA, etc.)
- **Multi-filiales** : Supporte tous les modules Molam (ID, Pay, Eats, Talk, Ads, Shop, Free, etc.)
- **Immutabilité** :
  - Table append-only (INSERT uniquement, pas d'UPDATE/DELETE)
  - Chaînage cryptographique (prev_hash → hash)
  - Export périodique vers S3 WORM (Object Lock + versioning)
- **Sécurité** :
  - Redaction par défaut des champs sensibles
  - Données hautement sensibles chiffrées (KMS/HSM)
  - Accès strictement RBAC (auditors/compliance/CISO)
  - Row Level Security (RLS)
- **Scalabilité** :
  - Partitionnement mensuel
  - Index optimisés
  - Rétention configurable (13/24/60 mois)
  - Offload froid vers S3 Glacier
- **Interop** : Ingestion via HTTP (mTLS + JWT) ou Kafka

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Audit Service (Port 3014)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Append     │  │   Search     │  │   Export     │      │
│  │   (HTTP)     │  │  (RBAC)      │  │  (JSONL)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Batch      │  │ Verify Chain │  │  Statistics  │      │
│  │   Append     │  │ (Integrity)  │  │  (Metrics)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                 Cryptographic Chaining                       │
│  prev_hash₀ → hash₁ → prev_hash₁ → hash₂ → ...             │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
    PostgreSQL            Redis               S3 WORM
  (Partitioned)         (Cache)          (Archival)
         │
      Kafka
  (Optional high-volume)
```

## 📊 Base de données

### Table principale (partitionnée)

```sql
CREATE TABLE molam_audit_logs (
  id              UUID PRIMARY KEY,
  module          TEXT NOT NULL,              -- 'id','pay','eats','talk',...
  action          TEXT NOT NULL,              -- 'auth.login.success'
  resource_type   TEXT,                       -- 'user','wallet','kyc_doc'
  resource_id     TEXT,                       -- uuid/ulid
  actor_type      audit_actor_type,           -- 'user','employee','service'
  actor_id        UUID,
  actor_org       TEXT,                       -- bank/merchant/dept
  result          TEXT CHECK (result IN ('allow','deny','success','failure')),
  reason          TEXT,
  ip              INET,
  user_agent      TEXT,
  device_id       TEXT,
  geo_country     TEXT,
  geo_city        TEXT,
  request_id      TEXT,
  session_id      UUID,
  sira_score      NUMERIC(6,2),
  data_redacted   JSONB,                      -- Safe to show
  data_ciphertext BYTEA,                      -- Encrypted (KMS)
  prev_hash       BYTEA,                      -- Chain
  hash            BYTEA,                      -- SHA256 digest
  created_at      TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);
```

### Fonctions SQL

#### Immutabilité
```sql
-- Bloque UPDATE/DELETE (append-only)
CREATE TRIGGER t_audit_no_update BEFORE UPDATE OR DELETE
  ON molam_audit_logs
  FOR EACH ROW EXECUTE FUNCTION f_audit_no_update();

-- Compute hash avec chaînage
CREATE TRIGGER t_audit_compute_hash BEFORE INSERT
  ON molam_audit_logs
  FOR EACH ROW EXECUTE FUNCTION f_audit_compute_hash();
```

#### Vérification d'intégrité
```sql
SELECT * FROM verify_audit_chain('2024-01-01', '2024-01-02');
-- Retourne: is_valid, broken_at, total_checked
```

#### Partitionnement automatique
```sql
SELECT create_next_month_audit_partition();
-- Crée la partition du mois prochain
```

## 🔌 API Endpoints

### Ingestion

#### POST /v1/audit
Ajouter un log d'audit.

**Headers:**
```
Authorization: Bearer <Service JWT>
X-Scope: audit:append
```

**Body:**
```json
{
  "module": "pay",
  "action": "pay.refund.create",
  "resource_type": "refund",
  "resource_id": "rf_123456",
  "actor_type": "employee",
  "actor_id": "emp-uuid",
  "result": "success",
  "reason": "Customer request approved",
  "ip": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "request_id": "req-abc-xyz",
  "data_redacted": {
    "amount": "5000 XOF",
    "customer_id": "cust-456"
  }
}
```

**Response (201):**
```json
{
  "id": "audit-log-uuid"
}
```

#### POST /v1/audit/batch
Ingestion par lot.

**Body:**
```json
{
  "logs": [
    { "module": "id", "action": "auth.login.success", ... },
    { "module": "pay", "action": "pay.transfer.create", ... }
  ]
}
```

**Response (201):**
```json
{
  "ids": ["uuid1", "uuid2"],
  "count": 2
}
```

### Recherche (Auditors uniquement)

#### GET /v1/audit/search
Rechercher dans les logs d'audit.

**Query params:**
- `module`: Filtrer par module (id, pay, eats, etc.)
- `actor_id`: Filtrer par acteur
- `resource_type`: Filtrer par type de ressource
- `resource_id`: Filtrer par ID de ressource
- `action`: Filtrer par action
- `result`: Filtrer par résultat (success, failure, allow, deny)
- `from`: Date de début (ISO 8601)
- `to`: Date de fin (ISO 8601)
- `q`: Recherche full-text dans data_redacted
- `limit`: Nombre max de résultats (défaut: 500)

**Response (200):**
```json
{
  "items": [
    {
      "id": "uuid",
      "module": "pay",
      "action": "pay.refund.create",
      "actor_id": "emp-uuid",
      "result": "success",
      "created_at": "2024-01-01T12:00:00Z"
    }
  ],
  "count": 1
}
```

#### GET /v1/audit/verify-chain
Vérifier l'intégrité de la chaîne cryptographique.

**Query params:**
- `from`: Date de début (défaut: 24h avant)
- `to`: Date de fin (défaut: maintenant)

**Response (200):**
```json
{
  "is_valid": true,
  "broken_at": null,
  "total_checked": 15234,
  "message": "Chain integrity verified"
}
```

#### GET /v1/audit/stats
Statistiques d'audit.

**Query params:**
- `days`: Période en jours (défaut: 7)

**Response (200):**
```json
{
  "period_days": 7,
  "total": 150000,
  "unique_actors": 1234,
  "unique_modules": 8,
  "success_count": 145000,
  "failure_count": 5000
}
```

#### GET /v1/audit/export
Exporter les logs (JSONL format).

**Query params:**
- `from`: Date de début (requis)
- `to`: Date de fin (requis)

**Response (200):**
```
Content-Type: application/x-ndjson
Content-Disposition: attachment; filename="audit_2024-01-01_2024-01-02.jsonl"

{"id":"uuid1","module":"pay",...}
{"id":"uuid2","module":"eats",...}
```

## 🔐 Sécurité

### Authentication & Authorization
- **Service JWT (RS256)** pour ingestion (scope: `audit:append`)
- **mTLS** recommandé pour production
- **Roles requis** pour recherche/export:
  - `auditor`
  - `compliance_officer`
  - `ciso`
  - `cto`
  - `legal`

### Immutabilité
1. **Database-level**: REVOKE UPDATE/DELETE + triggers
2. **Cryptographic**: Chaînage prev_hash → hash (SHA256)
3. **External proof**: Export quotidien vers S3 WORM

### Row Level Security (RLS)
```sql
-- Auditors peuvent tout voir
CREATE POLICY p_audit_read_all ON molam_audit_logs
  FOR SELECT TO molam_auditor
  USING (true);

-- Module readers limités par setting
CREATE POLICY p_audit_read_module ON molam_audit_logs
  FOR SELECT TO molam_module_reader
  USING (module = current_setting('molam.current_module', true));
```

## 📦 Archivage S3 WORM

### Configuration
```env
S3_REGION=eu-west-1
S3_AUDIT_BUCKET=molam-audit-logs
S3_KMS_KEY_ID=arn:aws:kms:...
S3_ENABLED=true
```

### Bucket Policy (Object Lock)
```json
{
  "ObjectLockEnabled": true,
  "ObjectLockConfiguration": {
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "COMPLIANCE",
        "Days": 365
      }
    }
  }
}
```

### Structure
```
s3://molam-audit-logs/
  audit/
    year=2024/
      month=01/
        day=01/
          audit_1704096000000.jsonl.gz
          audit_1704182400000.jsonl.gz
```

### Job quotidien
```typescript
// Runs at 2 AM UTC by default
cron.schedule('0 2 * * *', async () => {
  await runAuditArchiveJob();
});
```

## 🧩 Middleware réutilisable

Pour les services applicatifs :

```typescript
import { auditLogger } from '@molam/audit-middleware';

// On sensitive routes
app.post('/refunds',
  auditLogger('pay', 'pay.refund.create', (req) => ({
    type: 'refund',
    id: req.body.refund_id
  })),
  createRefundHandler
);
```

## 📈 Observabilité (Prometheus)

### Métriques
```
# Ingestion
audit_ingest_total{module,action,result}
audit_ingest_latency_ms{module}

# Export
audit_export_total{status}

# Chain integrity
audit_chain_ok{partition}
```

### Alertes
```yaml
- alert: AuditLoginFailureSpike
  expr: rate(audit_ingest_total{action="auth.login.failed"}[5m]) > 100
  annotations:
    summary: "Pic anormal de login failures (attaque?)"

- alert: AuditArchiveStale
  expr: time() - audit_last_archive_timestamp > 86400
  annotations:
    summary: "Archivage S3 en retard > 24h"
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
- `aws-credentials`: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
- `kafka-secret`: KAFKA_BROKERS (optionnel)

### Kafka (Optionnel)
Pour haute charge (>10k events/sec) :

```env
KAFKA_ENABLED=true
KAFKA_BROKERS=kafka-1:9092,kafka-2:9092
KAFKA_AUDIT_TOPIC=molam.audit
KAFKA_GROUP_ID=audit-ingestion
```

## 🧪 Tests

```bash
# Install dependencies
npm install

# Run tests
npm test

# Structure tests
node test_structure.cjs

# Build
npm run build
```

## 📚 Exemples de requêtes

### 1. Actions d'un employé hier
```sql
SELECT * FROM molam_audit_logs
WHERE module='pay' AND actor_type='employee'
  AND created_at::date = (CURRENT_DATE - 1)
ORDER BY created_at DESC;
```

### 2. Chaîne d'un refund controversé
```sql
SELECT * FROM molam_audit_logs
WHERE module='pay'
  AND (resource_type='refund' AND resource_id='rf_123')
   OR request_id='req-abc-xyz'
ORDER BY created_at ASC;
```

### 3. Top actions dernière semaine
```sql
SELECT action, result, count(*) FROM molam_audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20;
```

## 🔧 Configuration

Voir [.env.example](.env.example) pour les variables d'environnement.

**Limites par défaut:**
- Rétention PostgreSQL: 395 jours (13 mois)
- Search limit: 500 résultats
- Archive daily: 2 AM UTC
- Cache TTL: 60 secondes

## 📄 Conformité

### RGPD
- Pas d'effacement de logs (base légale: obligation légale / intérêt légitime)
- Pseudonymisation dans exports si requis
- Champ `data_redacted` pour données non sensibles
- Champ `data_ciphertext` pour données hautement sensibles (chiffré KMS)

### SOC 2 / ISO 27001
- Immutabilité garantie (database + cryptography + WORM)
- Traçabilité complète de tous les accès
- Rétention configurable par juridiction
- Audit trail des audits (qui a accédé aux logs?)

## 📞 Support

- **Email**: support@molam.com
- **Docs**: https://docs.molam.com/audit
- **Status**: https://status.molam.com

## 📄 License

PROPRIETARY - © 2024 Molam
