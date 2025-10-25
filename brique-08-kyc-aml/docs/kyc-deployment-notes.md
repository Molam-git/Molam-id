# Brique 8 - KYC/AML Pipeline - Deployment Notes

## Vue d'ensemble

La Brique 8 implémente un pipeline KYC/AML automatisé pour la vérification des utilisateurs (niveaux P1/P2).

### Architecture

```
User → kyc-api (upload docs) → S3/MinIO (encrypted storage)
                  ↓
            PostgreSQL (requests)
                  ↓
         kyc-processor (polling)
                  ↓
        OCR + Liveness + Sanctions
                  ↓
        Risk Scoring → Decision
                  ↓
      Update status (verified/rejected/needs_review)
```

## Composants

### 1. kyc-api (Fastify)
- Endpoints multipart pour upload de documents
- Stockage S3 avec encryption SSE-KMS
- Webhook endpoint pour vendors
- HMAC signature validation

### 2. kyc-processor
- Poll PostgreSQL pour requests en statut `pending`
- Exécute OCR (Tesseract ou vendor API)
- Face matching (selfie vs ID photo)
- Liveness detection
- Sanctions screening (OFAC, listes locales)
- Risk scoring & décision automatique

## Niveaux KYC

| Niveau | Documents requis | Limits journalières | Limits par TX |
|--------|------------------|---------------------|---------------|
| P0     | Téléphone vérifié | 10,000 XOF | 5,000 XOF |
| P1     | ID + Selfie | 100,000 XOF | 50,000 XOF |
| P2     | ID + Selfie + Proof address | 10,000,000 XOF | 2,000,000 XOF |

## Déploiement Local (Dev/Test)

### Prérequis
- Docker & docker-compose
- 4GB RAM minimum
- jq (pour tests)

### Démarrage

```bash
cd brique-08-kyc-aml/infra
docker-compose up --build -d

# Créer le bucket MinIO
# 1. Aller sur http://localhost:9003
# 2. Login: minioadmin / minioadmin
# 3. Créer bucket "molam-kyc"
```

### Test d'intégration

```bash
cd brique-08-kyc-aml/ci
chmod +x test_local_kyc_flow.sh local_run.sh
./test_local_kyc_flow.sh
```

## Configuration Production

### 1. Remplacer MinIO par AWS S3

```yaml
# Variables d'environnement
S3_ENDPOINT: "" # Vide pour AWS S3
AWS_REGION: "eu-west-1"
S3_BUCKET: "molam-kyc-prod-sn"
```

### 2. Activer S3 Encryption & Object Lock

```bash
# Créer bucket avec encryption par défaut
aws s3api create-bucket \
  --bucket molam-kyc-prod-sn \
  --region eu-west-1 \
  --object-lock-enabled-for-bucket

# Configurer encryption SSE-KMS
aws s3api put-bucket-encryption \
  --bucket molam-kyc-prod-sn \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "arn:aws:kms:eu-west-1:123456789012:key/..."
      }
    }]
  }'
```

### 3. Remplacer les mocks par vendors réels

#### OCR Vendor (exemple: AWS Textract)

```javascript
// ocr_adapter.js
import { TextractClient, AnalyzeDocumentCommand } from "@aws-sdk/client-textract";

export async function runOCRFromS3(key) {
  const textract = new TextractClient({ region: process.env.AWS_REGION });
  const command = new AnalyzeDocumentCommand({
    Document: { S3Object: { Bucket: process.env.S3_BUCKET, Name: key } },
    FeatureTypes: ["FORMS", "TABLES"]
  });
  const response = await textract.send(command);
  // Parse Textract response...
  return { raw_text: ..., confidence: ..., extracted: {...} };
}
```

#### Face Match (exemple: AWS Rekognition)

```javascript
// liveness.js
import { RekognitionClient, CompareFacesCommand } from "@aws-sdk/client-rekognition";

export async function faceMatch(selfieKey, idImageKey) {
  const rekognition = new RekognitionClient({ region: process.env.AWS_REGION });
  const command = new CompareFacesCommand({
    SourceImage: { S3Object: { Bucket: process.env.S3_BUCKET, Name: selfieKey } },
    TargetImage: { S3Object: { Bucket: process.env.S3_BUCKET, Name: idImageKey } },
    SimilarityThreshold: 80
  });
  const response = await rekognition.send(command);
  const match = response.FaceMatches[0];
  return {
    score: match?.Similarity || 0,
    matched: match?.Similarity > 80,
    confidence: match?.Face?.Confidence || 0
  };
}
```

#### Sanctions Screening (exemple: Dow Jones, ComplyAdvantage)

```javascript
// sanctions.js
export async function checkSanctions(person) {
  const response = await fetch(process.env.SANCTIONS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SANCTIONS_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: person.name,
      dob: person.dob,
      national_id: person.national_id
    })
  });
  const data = await response.json();
  return data.matches || [];
}
```

### 4. IAM Policies

#### Pour kyc-api et kyc-processor

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "KYCS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::molam-kyc-prod-sn/*"
    },
    {
      "Sid": "KYCTextract",
      "Effect": "Allow",
      "Action": [
        "textract:AnalyzeDocument"
      ],
      "Resource": "*"
    },
    {
      "Sid": "KYCRekognition",
      "Effect": "Allow",
      "Action": [
        "rekognition:CompareFaces",
        "rekognition:DetectFaces"
      ],
      "Resource": "*"
    },
    {
      "Sid": "KYCKMS",
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:Encrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "arn:aws:kms:*:*:key/*"
    }
  ]
}
```

### 5. Webhook Security

#### Génération de signature

```javascript
// Vendor side (example)
const crypto = require('crypto');
const timestamp = Math.floor(Date.now() / 1000);
const payload = JSON.stringify({ event_type: 'ocr.completed', kyc_request_id: '...' });
const signature = crypto.createHmac('sha256', SHARED_SECRET)
  .update(`${timestamp}.${payload}`)
  .digest('hex');

// POST /internal/kyc/webhook
// Headers:
//   X-KYC-Signature: sha256=<signature>
//   X-KYC-Timestamp: <timestamp>
```

#### Validation côté serveur

```javascript
// kyc-api/src/index.js (déjà implémenté)
const expectedSig = crypto.createHmac('sha256', process.env.KYC_WEBHOOK_SECRET)
  .update(`${timestamp}.${rawBody}`)
  .digest('hex');

if(!crypto.timingSafeEqual(Buffer.from(expectedSig,'hex'), Buffer.from(signature,'hex'))) {
  return reply.status(401).send({ error: 'Invalid signature' });
}
```

### 6. Rate Limiting

Implémenter rate limiting sur les endpoints upload:

```javascript
// kyc-api/src/index.js
import rateLimit from '@fastify/rate-limit';

app.register(rateLimit, {
  max: 5, // 5 requests
  timeWindow: '15 minutes',
  cache: 10000
});
```

### 7. Monitoring & Alertes

#### Prometheus Metrics

```javascript
// À implémenter dans kyc-api et kyc-processor
import promClient from 'prom-client';

const kycRequestsTotal = new promClient.Counter({
  name: 'molam_kyc_requests_total',
  help: 'Total KYC requests created',
  labelNames: ['level']
});

const kycProcessingDuration = new promClient.Histogram({
  name: 'molam_kyc_processing_duration_seconds',
  help: 'KYC processing duration',
  buckets: [1, 5, 10, 30, 60, 120]
});

const kycDecisions = new promClient.Counter({
  name: 'molam_kyc_decisions_total',
  help: 'KYC decisions by type',
  labelNames: ['decision'] // auto_verified, manual_review, rejected
});
```

#### Alertes

- **High rejection rate** (>10% sur 24h) → investigate fraud pattern
- **Processing lag** (pending > 1 hour) → scale processor
- **Vendor API failures** (>5% error rate) → switch to fallback or manual review

### 8. GDPR & Data Retention

#### Right to be Forgotten

```sql
-- Anonymize user KYC data (keep audit trail)
UPDATE molam_kyc_requests SET user_id = NULL WHERE user_id = $1;
UPDATE molam_kyc_docs SET uploaded_by = NULL WHERE uploaded_by = $1;
-- Delete S3 objects
-- aws s3 rm s3://molam-kyc/kyc/$USER_ID/ --recursive
```

#### Data Retention Policy

```json
// S3 Lifecycle
{
  "Rules": [
    {
      "Id": "KYCRetention",
      "Status": "Enabled",
      "Transitions": [
        { "Days": 365, "StorageClass": "STANDARD_IA" },
        { "Days": 2555, "StorageClass": "GLACIER" }
      ],
      "Expiration": { "Days": 3650 }
    }
  ]
}
```

### 9. Manual Review UI

Pour les cas `needs_review`, implémenter un dashboard admin:

```
GET /admin/kyc/pending -> liste des KYC en needs_review
GET /admin/kyc/:id -> détails + documents (presigned URLs)
POST /admin/kyc/:id/approve -> approve manuellement
POST /admin/kyc/:id/reject -> reject avec raison
```

### 10. Integration avec SIRA (Fraud Detection)

```javascript
// Dans kyc-processor/src/index.js
import { getSIRAScore } from './sira_client.js';

// Après sanctions check
const siraScore = await getSIRAScore(userId, {
  device_id: ...,
  ip: ...,
  behavior: ...
});

if(siraScore > 80) {
  risk += 30;
  decision = 'manual_review';
}
```

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
# Start stack
cd infra && docker-compose up -d

# Run tests
cd ../ci
./test_local_kyc_flow.sh
```

### Load Testing (k6)

```javascript
// load_test.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const formData = {
    requested_level: 'P1',
    id_front: http.file(open('test_id.jpg')),
    selfie: http.file(open('test_selfie.jpg'))
  };
  let res = http.post('http://localhost:4201/api/kyc/request', formData, {
    headers: { 'X-User-Id': 'test-user' }
  });
  check(res, { 'status is 201': (r) => r.status === 201 });
}
```

## Troubleshooting

### Documents non uploadés
```bash
# Vérifier S3 access
aws s3 ls s3://molam-kyc/kyc/ --profile kyc-service

# Vérifier logs kyc-api
docker-compose logs kyc-api | grep -i "upload"
```

### KYC processor bloqué
```bash
# Vérifier que le processor tourne
docker-compose ps kyc-processor

# Voir les logs
docker-compose logs -f kyc-processor

# Vérifier les requests en pending
psql $POSTGRES_DSN -c "SELECT * FROM molam_kyc_requests WHERE status='pending'"
```

### Face match échoue systématiquement
```bash
# Vérifier la qualité des images
# - Résolution minimum: 640x480
# - Format: JPG, PNG
# - Taille max: 10MB
# - Face visible et non occultée
```

## Checklist Pre-Production

- [ ] S3 bucket avec encryption SSE-KMS
- [ ] Object Lock configuré (7-10 ans retention)
- [ ] IAM policies restrictives
- [ ] Vendors configurés (OCR, Face Match, Sanctions)
- [ ] Webhook secret rotaté et stocké dans Vault
- [ ] Rate limiting activé
- [ ] Monitoring & alertes configurés
- [ ] GDPR compliance vérifié
- [ ] Manual review UI déployé
- [ ] Integration SIRA activée
- [ ] Load testing validé (100+ req/min)
- [ ] Pen-test effectué
- [ ] Runbook incident response

## Support

Pour questions ou problèmes:
- Logs: `docker-compose logs -f`
- Health check: `curl http://localhost:4201/health`
- GitHub Issues: https://github.com/molam/kyc-brique/issues
