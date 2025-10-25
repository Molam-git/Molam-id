# Briques 7 & 8 - Audit Immuable & KYC/AML

Ce document décrit l'implémentation des **Briques 7 et 8** du système Molam ID.

## Vue d'ensemble

### Brique 7 - Audit Logs Immuables
Système d'audit logs append-only avec signature cryptographique et conformité réglementaire.

**Emplacement**: `brique-audit/`

**Composants**:
- audit-writer (Kafka consumer)
- batch-uploader (S3 uploader avec Merkle trees)
- indexer (OpenSearch)
- verifier (API de vérification)

**Technologies**: Kafka, PostgreSQL, S3/MinIO, OpenSearch, KMS/HSM

### Brique 8 - KYC/AML Pipeline
Pipeline automatisé de vérification d'identité (P1/P2) avec OCR, face matching et sanctions screening.

**Emplacement**: `brique-08-kyc-aml/`

**Composants**:
- kyc-api (Upload de documents)
- kyc-processor (OCR, liveness, sanctions, décisions)

**Technologies**: Fastify, PostgreSQL, S3/MinIO, Tesseract, AWS Rekognition/Textract

## Démarrage rapide

### Brique 7 - Audit

```bash
cd brique-audit/infra
docker-compose up -d

# Vérifier la santé
curl http://localhost:4100/health

# Tester
cd ../ci
./test_insert_and_verify.sh
```

**Ports**:
- 4100: Verifier API
- 5432: PostgreSQL
- 9000: MinIO (S3)
- 9001: MinIO Console
- 9200: OpenSearch
- 9092: Kafka

### Brique 8 - KYC/AML

```bash
cd brique-08-kyc-aml/infra
docker-compose up -d

# Créer le bucket MinIO
# Ouvrir http://localhost:9003
# Login: minioadmin / minioadmin
# Créer bucket: molam-kyc

# Tester
cd ../ci
./test_local_kyc_flow.sh
```

**Ports**:
- 4201: KYC API
- 5433: PostgreSQL (KYC)
- 9002: MinIO (S3)
- 9003: MinIO Console

## Structure des répertoires

```
Molam-id/
├── brique-audit/
│   ├── sql/                      # Schemas PostgreSQL
│   ├── services/
│   │   ├── audit-writer/         # Kafka → PG + signature
│   │   ├── batch-uploader/       # PG → S3 (Merkle)
│   │   ├── indexer/              # PG → OpenSearch
│   │   └── verifier/             # API vérification
│   ├── infra/
│   │   ├── docker-compose.yml    # Stack complète
│   │   └── env.example
│   ├── openapi/
│   │   └── audit-openapi.yaml
│   ├── ci/                       # Scripts de test
│   ├── docs/                     # Documentation
│   └── README.md
│
├── brique-08-kyc-aml/
│   ├── sql/                      # Schemas KYC
│   ├── services/
│   │   ├── kyc-api/              # API upload + webhook
│   │   └── kyc-processor/        # OCR, Face, Sanctions
│   ├── infra/
│   │   ├── docker-compose.yml
│   │   └── env.example
│   ├── openapi/
│   │   └── kyc-openapi.yaml
│   ├── ci/                       # Scripts de test
│   ├── docs/                     # Documentation
│   └── README.md
│
└── BRIQUES_7_8_README.md         # Ce fichier
```

## Intégration entre briques

### Brique 8 → Brique 7 (Audit)

Tous les événements KYC importants sont envoyés vers Kafka pour audit immuable:

```javascript
// Dans kyc-processor ou kyc-api
import { Kafka } from 'kafkajs';

const kafka = new Kafka({ brokers: ['kafka:9092'] });
const producer = kafka.producer();

// Après une décision KYC
await producer.send({
  topic: 'molam.audit.events',
  messages: [{
    value: JSON.stringify({
      event_type: 'kyc.decision',
      module: 'kyc',
      actor_id: userId,
      actor_role: 'system',
      payload: {
        kyc_request_id: kycId,
        decision: 'verified',
        risk_score: 45.0
      }
    })
  }]
});
```

### Configuration commune

Les deux briques peuvent partager:
- Même instance Kafka (audit events)
- Même bucket S3 (partitions différentes)
- Même cluster PostgreSQL (databases séparées)

## Schémas de base de données

### Brique 7 (molam_audit)

```sql
audit_events        -- Événements append-only avec signatures
audit_batches       -- Manifests des batches S3
```

### Brique 8 (molam_kyc)

```sql
molam_kyc_requests      -- Demandes KYC par utilisateur
molam_kyc_docs          -- Métadonnées des documents uploadés
molam_kyc_verifications -- Résultats OCR, face match, sanctions
molam_kyc_audit         -- Logs d'actions KYC
molam_limits            -- Limites par niveau KYC
```

## APIs

### Audit API (Port 4100)

```bash
# Health check
GET http://localhost:4100/health

# Vérifier un événement
POST http://localhost:4100/api/audit/verify
{
  "event_id": "uuid"
}
```

### KYC API (Port 4201)

```bash
# Health check
GET http://localhost:4201/health

# Créer demande KYC
POST http://localhost:4201/api/kyc/request
Content-Type: multipart/form-data
X-User-Id: user-uuid

requested_level=P1
id_front=@id_front.jpg
id_back=@id_back.jpg
selfie=@selfie.jpg

# Statut KYC
GET http://localhost:4201/api/kyc/{request_id}/status
```

## Monitoring

### Prometheus Metrics (à implémenter)

**Audit**:
- `molam_audit_events_ingested_total{module}`
- `molam_audit_batches_uploaded_total`
- `molam_audit_verifications_failed_total`

**KYC**:
- `molam_kyc_requests_total{level}`
- `molam_kyc_processing_duration_seconds`
- `molam_kyc_decisions_total{decision}`

### Grafana Dashboards

1. **Audit Overview**
   - Ingestion rate
   - Batch upload success/fail
   - Storage growth

2. **KYC Overview**
   - Requests par niveau (P1/P2)
   - Décisions (auto/manual/reject)
   - Processing time p50/p95/p99

## Déploiement Production

### Checklist Brique 7

- [ ] AWS S3 avec Object Lock enabled
- [ ] AWS KMS multi-region keys
- [ ] IAM policies restrictives
- [ ] Cross-region replication
- [ ] Integrity checks daily
- [ ] Monitoring & alertes
- [ ] 10 ans retention policy

### Checklist Brique 8

- [ ] AWS S3 avec SSE-KMS
- [ ] Vendors configurés (Textract, Rekognition)
- [ ] Sanctions API activée
- [ ] Webhook HMAC secrets rotés
- [ ] Rate limiting activé
- [ ] GDPR compliance
- [ ] Manual review UI
- [ ] Load testing validé

## Tests

### Tests d'intégration

```bash
# Brique 7
cd brique-audit/ci
./test_insert_and_verify.sh

# Brique 8
cd brique-08-kyc-aml/ci
./test_local_kyc_flow.sh
```

### Tests de charge

Utiliser k6 ou artillery pour tester:
- Audit: 1000+ events/sec
- KYC: 100+ requests/min

## Troubleshooting

### Logs

```bash
# Brique 7
cd brique-audit/infra
docker-compose logs -f audit-writer
docker-compose logs -f batch-uploader
docker-compose logs -f verifier

# Brique 8
cd brique-08-kyc-aml/infra
docker-compose logs -f kyc-api
docker-compose logs -f kyc-processor
```

### Bases de données

```bash
# Audit DB
psql postgres://molam:molam_pass@localhost:5432/molam_audit

# KYC DB
psql postgres://molam:molam_pass@localhost:5433/molam_kyc
```

### S3/MinIO

```bash
# Audit bucket
aws --endpoint-url=http://localhost:9000 s3 ls s3://molam-audit/

# KYC bucket
aws --endpoint-url=http://localhost:9002 s3 ls s3://molam-kyc/
```

## Documentation complète

- **Brique 7**: [brique-audit/docs/deployment-notes.md](brique-audit/docs/deployment-notes.md)
- **Brique 8**: [brique-08-kyc-aml/docs/kyc-deployment-notes.md](brique-08-kyc-aml/docs/kyc-deployment-notes.md)

## OpenAPI Specs

- **Audit API**: [brique-audit/openapi/audit-openapi.yaml](brique-audit/openapi/audit-openapi.yaml)
- **KYC API**: [brique-08-kyc-aml/openapi/kyc-openapi.yaml](brique-08-kyc-aml/openapi/kyc-openapi.yaml)

## Support

Pour questions ou problèmes:
- Consulter les READMEs individuels
- Vérifier les logs docker-compose
- Health checks: curl localhost:4100/health et localhost:4201/health

## Licence

Propriétaire - Molam
