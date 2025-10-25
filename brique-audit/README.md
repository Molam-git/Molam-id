# Brique 7 - Audit Logs Immuables

Système d'audit logs immuable avec signature cryptographique et conformité réglementaire (BCEAO, EU, FED).

## Fonctionnalités

- **Append-only storage**: Aucune modification destructive de l'historique
- **Signatures cryptographiques**: Chaque événement signé avec KMS/HSM
- **Merkle trees**: Preuve d'intégrité par batch
- **S3 Object Lock**: Stockage immuable avec versioning
- **OpenSearch**: Indexation pour recherche rapide
- **API de vérification**: Vérifier l'intégrité des événements
- **Conformité réglementaire**: Rétention configurable par zone

## Architecture

```
Producers → Kafka → audit-writer → PostgreSQL (append-only)
                         ↓
                   batch-uploader → S3 (Object Lock)
                         ↓
PostgreSQL → indexer → OpenSearch
     ↓
  verifier API
```

## Quick Start

### 1. Démarrer les services

```bash
cd infra
docker-compose up -d
```

### 2. Vérifier la santé

```bash
curl http://localhost:4100/health
```

### 3. Publier un événement de test

```bash
# Via Kafka (nécessite kafka-console-producer)
echo '{"event_type":"test.event","module":"test","actor_id":"user-123","payload":{"action":"test"}}' | \
  kafka-console-producer --broker-list localhost:9092 --topic molam.audit.events
```

### 4. Vérifier un événement

```bash
curl -X POST http://localhost:4100/api/audit/verify \
  -H "Content-Type: application/json" \
  -d '{"event_id":"<event-uuid>"}'
```

### 5. Exécuter les tests

```bash
cd ci
chmod +x test_insert_and_verify.sh
./test_insert_and_verify.sh
```

## Services

### audit-writer
Consomme Kafka, canonicalise, hash, signe et insère dans PostgreSQL.

**Port**: N/A (consumer Kafka)
**Env vars**: `POSTGRES_DSN`, `KAFKA_BROKERS`, `KMS_KEY_ID`

### batch-uploader
Regroupe les événements, calcule Merkle root, upload vers S3.

**Port**: N/A (background job)
**Env vars**: `S3_ENDPOINT`, `S3_BUCKET`, `UPLOAD_INTERVAL_MS`

### indexer
Indexe les événements dans OpenSearch pour recherche rapide.

**Port**: N/A (background job)
**Env vars**: `OPENSEARCH_NODE`, `INDEX_INTERVAL_MS`

### verifier
API REST pour vérification d'intégrité.

**Port**: 4100
**Endpoints**:
- `GET /health` - Health check
- `POST /api/audit/verify` - Vérifier un événement

## Configuration

Voir [infra/env.example](infra/env.example) pour toutes les variables d'environnement.

### Variables importantes

```bash
# PostgreSQL
POSTGRES_DSN=postgres://molam:molam_pass@postgres:5432/molam_audit

# Kafka
KAFKA_BROKERS=kafka:9092
AUDIT_TOPIC=molam.audit.events

# S3/MinIO
S3_ENDPOINT=http://minio:9000  # Vide pour AWS S3
S3_BUCKET=molam-audit
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# KMS
USE_AWS_KMS=false  # true en production
KMS_KEY_ID=local
```

## Production

Voir [docs/deployment-notes.md](docs/deployment-notes.md) pour:
- Configuration AWS S3 + Object Lock
- Configuration KMS/HSM
- IAM policies
- Monitoring & alertes
- Disaster recovery
- Checklist de déploiement

## OpenAPI

Voir [openapi/audit-openapi.yaml](openapi/audit-openapi.yaml) pour la spec complète de l'API.

## Développement

### Build local

```bash
# Build un service spécifique
cd services/audit-writer
npm install
npm start
```

### Tests

```bash
# Tests d'intégration
cd ci
./test_insert_and_verify.sh

# Logs
docker-compose logs -f audit-writer
```

## Troubleshooting

### Events non signés
```bash
docker-compose logs audit-writer | grep -i "sign"
```

### Batches non uploadés
```bash
docker-compose logs batch-uploader
aws s3 ls s3://molam-audit/
```

### Indexation lente
```bash
curl http://localhost:9200/_cluster/health
curl http://localhost:9200/_cat/indices?v
```

## Licence

Propriétaire - Molam
