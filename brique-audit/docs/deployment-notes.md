# Brique 7 - Audit Logs Immuables - Deployment Notes

## Vue d'ensemble

La Brique 7 implémente un système d'audit logs immuable avec signature cryptographique et conformité réglementaire.

### Architecture

```
Producers → Kafka (molam.audit.events) → audit-writer → PostgreSQL (append-only)
                                                ↓
                                         batch-uploader
                                                ↓
                                         S3/MinIO (Object Lock)
                                                ↓
PostgreSQL ← indexer ← OpenSearch (recherche rapide)
     ↓
  verifier API (vérification d'intégrité)
```

## Composants

### 1. audit-writer
- Consomme les événements Kafka
- Canonicalise et hash les événements
- Signe avec KMS/HSM
- Insère dans PostgreSQL (append-only)
- Maintient une chaîne de hash (prev_hash)

### 2. batch-uploader
- Regroupe les événements non-uploadés
- Calcule la racine Merkle
- Upload vers S3 avec Object Lock
- Enregistre les manifests de batch

### 3. indexer
- Poll PostgreSQL pour nouveaux événements
- Indexe dans OpenSearch pour recherche rapide
- Index pattern: `molam-audit-YYYY.MM.DD`

### 4. verifier
- API REST pour vérification d'intégrité
- Endpoint: `POST /api/audit/verify`
- Vérifie: hash, signature, inclusion Merkle

## Déploiement Local (Dev/Test)

### Prérequis
- Docker & docker-compose
- 4GB RAM minimum
- 10GB disque disponible

### Démarrage

```bash
cd brique-audit/infra
docker-compose up --build -d
```

### Vérification

```bash
# Vérifier les services
docker-compose ps

# Vérifier la santé du verifier
curl http://localhost:4100/health

# Voir les logs
docker-compose logs -f audit-writer
```

### Test d'intégration

```bash
cd brique-audit/ci
chmod +x test_insert_and_verify.sh
./test_insert_and_verify.sh
```

## Configuration Production

### 1. Remplacer MinIO par AWS S3

```yaml
# Dans docker-compose ou variables d'environnement
S3_ENDPOINT: "" # Vide pour AWS S3
AWS_REGION: "eu-west-1"
S3_BUCKET: "molam-audit-prod-sn"
```

### 2. Activer S3 Object Lock

```bash
# Créer le bucket avec Object Lock
aws s3api create-bucket \
  --bucket molam-audit-prod-sn \
  --region eu-west-1 \
  --object-lock-enabled-for-bucket

# Configurer la rétention par défaut
aws s3api put-object-lock-configuration \
  --bucket molam-audit-prod-sn \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "GOVERNANCE",
        "Days": 3650
      }
    }
  }'
```

### 3. Activer AWS KMS

```bash
# Créer une clé KMS multi-région
aws kms create-key \
  --description "Molam Audit Signing Key" \
  --multi-region \
  --key-usage SIGN_VERIFY \
  --customer-master-key-spec RSA_2048

# Récupérer l'ARN
export KMS_KEY_ID="arn:aws:kms:eu-west-1:123456789012:key/..."
```

Mettre à jour les variables d'environnement:
```yaml
USE_AWS_KMS: "true"
KMS_KEY_ID: "arn:aws:kms:..."
AWS_REGION: "eu-west-1"
```

### 4. IAM Policies

#### Pour audit-writer et batch-uploader (écriture)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AuditS3Write",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:PutObjectRetention"
      ],
      "Resource": "arn:aws:s3:::molam-audit-prod-sn/*"
    },
    {
      "Sid": "AuditKMSSign",
      "Effect": "Allow",
      "Action": [
        "kms:Sign",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:*:*:key/*"
    }
  ]
}
```

#### Pour auditors (lecture seule)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AuditS3Read",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::molam-audit-prod-sn",
        "arn:aws:s3:::molam-audit-prod-sn/*"
      ]
    },
    {
      "Sid": "AuditKMSVerify",
      "Effect": "Allow",
      "Action": [
        "kms:Verify",
        "kms:GetPublicKey"
      ],
      "Resource": "arn:aws:kms:*:*:key/*"
    }
  ]
}
```

### 5. Sécurité PostgreSQL

Créer des rôles avec privilèges limités:

```sql
-- Rôle pour audit-writer (INSERT uniquement)
CREATE ROLE audit_writer WITH LOGIN PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE molam_audit TO audit_writer;
GRANT INSERT ON audit_events TO audit_writer;
GRANT SELECT ON audit_events TO audit_writer; -- Pour prev_hash
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO audit_writer;

-- Rôle pour batch-uploader (UPDATE uploaded flag)
CREATE ROLE audit_uploader WITH LOGIN PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE molam_audit TO audit_uploader;
GRANT SELECT, UPDATE ON audit_events TO audit_uploader;
GRANT INSERT ON audit_batches TO audit_uploader;

-- Rôle pour indexer (READ-ONLY)
CREATE ROLE audit_indexer WITH LOGIN PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE molam_audit TO audit_indexer;
GRANT SELECT ON audit_events TO audit_indexer;

-- Bloquer DELETE et TRUNCATE pour tous
REVOKE DELETE, TRUNCATE ON audit_events FROM PUBLIC;
REVOKE DELETE, TRUNCATE ON audit_batches FROM PUBLIC;
```

### 6. Monitoring & Alertes

#### Prometheus Metrics (à implémenter)

```javascript
// Dans chaque service, exposer /metrics
import promClient from 'prom-client';

const eventsIngested = new promClient.Counter({
  name: 'molam_audit_events_ingested_total',
  help: 'Total audit events ingested',
  labelNames: ['module']
});

const batchesUploaded = new promClient.Counter({
  name: 'molam_audit_batches_uploaded_total',
  help: 'Total batches uploaded to S3'
});

const verificationsFailed = new promClient.Counter({
  name: 'molam_audit_verifications_failed_total',
  help: 'Total failed verifications'
});
```

#### Grafana Dashboards

- Ingestion rate par module
- Batch upload success/failure
- Storage growth (S3)
- Verification pass/fail ratio
- Latency (p50, p95, p99)

### 7. Disaster Recovery

#### Backup PostgreSQL
```bash
# Daily WAL backup
pg_basebackup -D /backup/$(date +%Y%m%d) -Ft -z -P
```

#### Cross-region S3 Replication
```bash
aws s3api put-bucket-replication \
  --bucket molam-audit-prod-sn \
  --replication-configuration file://replication.json
```

#### Integrity Checks (daily cron)
```bash
# Vérifier les signatures et merkle roots
node scripts/verify-integrity.js --days 1
```

## Politique de Rétention

### Par défaut (BCEAO)
- **0-1 an**: S3 Standard (accès fréquent)
- **1-7 ans**: S3 Infrequent Access
- **7-10 ans**: S3 Glacier Deep Archive

### Lifecycle Policy

```json
{
  "Rules": [
    {
      "Id": "TransitionToIA",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 365,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 2555,
          "StorageClass": "DEEP_ARCHIVE"
        }
      ]
    }
  ]
}
```

## Legal Holds

Pour les cas juridiques en cours:

```bash
# Appliquer un legal hold
aws s3api put-object-legal-hold \
  --bucket molam-audit-prod-sn \
  --key audit/pay/batch-12345.jsonl \
  --legal-hold Status=ON
```

## Checklist Pre-Production

- [ ] S3 bucket avec Object Lock activé
- [ ] KMS/HSM keys provisionnées
- [ ] IAM policies configurées
- [ ] PostgreSQL roles avec privilèges minimum
- [ ] Backup PostgreSQL automatisé
- [ ] Cross-region replication S3
- [ ] Monitoring & alertes configurés
- [ ] Integrity checks daily cron
- [ ] Load testing (1000+ events/sec)
- [ ] Pen-test sur API verifier
- [ ] Documentation legal hold process
- [ ] Runbook incident response

## Troubleshooting

### Events non signés
```bash
# Vérifier les logs audit-writer
docker-compose logs audit-writer | grep -i "sign"

# Vérifier KMS access
aws kms describe-key --key-id $KMS_KEY_ID
```

### Batches non uploadés
```bash
# Vérifier les logs batch-uploader
docker-compose logs batch-uploader

# Vérifier S3 credentials
aws s3 ls s3://molam-audit-prod-sn/
```

### Indexation lente
```bash
# Vérifier OpenSearch health
curl http://localhost:9200/_cluster/health

# Vérifier index stats
curl http://localhost:9200/_cat/indices?v
```

## Support

Pour toute question ou problème:
- Consulter les logs: `docker-compose logs -f`
- Vérifier la santé: `curl http://localhost:4100/health`
- Issues GitHub: https://github.com/molam/audit-brique/issues
