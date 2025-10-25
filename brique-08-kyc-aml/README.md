# Brique 8 - KYC/AML Pipeline

Pipeline KYC/AML automatisé pour la vérification des utilisateurs (niveaux P1/P2).

## Fonctionnalités

- **Upload sécurisé**: Documents cryptés sur S3 avec SSE-KMS
- **OCR**: Extraction de données des documents d'identité
- **Liveness detection**: Vérification que la selfie est une vraie personne
- **Face matching**: Correspondance selfie vs photo d'identité
- **Sanctions screening**: Vérification OFAC, PEP, listes locales
- **Risk scoring**: Score de risque basé sur multiple facteurs
- **Décisions automatiques**: Auto-verified, manual review, ou rejected
- **Webhook support**: Callbacks sécurisés pour vendors

## Architecture

```
User → kyc-api (upload) → S3 (encrypted)
           ↓
      PostgreSQL
           ↓
    kyc-processor (poll)
           ↓
  OCR + Face + Sanctions
           ↓
    Decision + Risk Score
```

## Niveaux KYC

| Niveau | Documents | Limite journalière | Limite par TX |
|--------|-----------|-------------------|---------------|
| P0 | Téléphone | 10,000 XOF | 5,000 XOF |
| P1 | ID + Selfie | 100,000 XOF | 50,000 XOF |
| P2 | ID + Selfie + Adresse | 10,000,000 XOF | 2,000,000 XOF |

## Quick Start

### 1. Démarrer les services

```bash
cd infra
docker-compose up -d
```

### 2. Créer le bucket MinIO

1. Ouvrir http://localhost:9003
2. Login: `minioadmin` / `minioadmin`
3. Créer bucket: `molam-kyc`

### 3. Soumettre une demande KYC

```bash
curl -X POST http://localhost:4201/api/kyc/request \
  -H "X-User-Id: test-user-123" \
  -F "requested_level=P1" \
  -F "id_front=@/path/to/id_front.jpg" \
  -F "id_back=@/path/to/id_back.jpg" \
  -F "selfie=@/path/to/selfie.jpg"
```

### 4. Vérifier le statut

```bash
curl http://localhost:4201/api/kyc/<request-id>/status
```

### 5. Exécuter les tests

```bash
cd ci
chmod +x test_local_kyc_flow.sh
./test_local_kyc_flow.sh
```

## Services

### kyc-api (Fastify)
API REST pour upload de documents et webhooks.

**Port**: 4201
**Endpoints**:
- `GET /health` - Health check
- `POST /api/kyc/request` - Créer demande KYC
- `GET /api/kyc/:id/status` - Obtenir statut
- `POST /internal/kyc/webhook` - Webhook vendors

### kyc-processor
Worker qui traite les demandes KYC en background.

**Port**: N/A (background job)
**Traitement**:
1. OCR sur documents
2. Face matching (selfie vs ID)
3. Liveness detection
4. Sanctions screening
5. Risk scoring
6. Décision finale

## Configuration

Voir [infra/env.example](infra/env.example) pour toutes les variables.

### Mode développement (mocks activés)

```bash
USE_MOCK_OCR=true
USE_MOCK_LIVENESS=true
USE_MOCK_SANCTIONS=true
```

### Production (vendors réels)

```bash
USE_MOCK_OCR=false
USE_MOCK_LIVENESS=false
USE_MOCK_SANCTIONS=false

# Configurer les URLs vendors
OCR_VENDOR_URL=https://textract...
FACE_MATCH_URL=https://rekognition...
SANCTIONS_URL=https://sanctions-api...
```

## Workflow de décision

```
┌─────────────┐
│ KYC Request │
│  (pending)  │
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Processing  │
│  OCR, Face, │
│  Sanctions  │
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Risk Score  │
│  0-100      │
└─────┬───────┘
      │
      ├─► Risk < 60 + Face OK + No sanctions → auto_verified
      ├─► Risk 60-80 → needs_review (manual)
      └─► Risk > 80 OR sanctions → rejected
```

## Production

Voir [docs/kyc-deployment-notes.md](docs/kyc-deployment-notes.md) pour:
- Configuration AWS (S3, Textract, Rekognition)
- IAM policies
- Vendors réels (OCR, Face, Sanctions)
- Webhook security (HMAC)
- Rate limiting
- Monitoring & alertes
- GDPR compliance
- Manual review UI

## OpenAPI

Voir [openapi/kyc-openapi.yaml](openapi/kyc-openapi.yaml) pour la spec complète de l'API.

## Développement

### Build local

```bash
cd services/kyc-api
npm install
npm start
```

### Tests

```bash
# Tests d'intégration
cd ci
./test_local_kyc_flow.sh

# Logs
docker-compose logs -f kyc-processor
```

## Sécurité

### Upload de documents
- Taille max: 10MB par fichier
- Formats acceptés: JPG, PNG, PDF
- Encryption: SSE-KMS sur S3
- Access: Pre-signed URLs (15min TTL)

### Webhook validation
- HMAC SHA256 signature obligatoire
- Timestamp validation (±5 min)
- Replay protection

### PII Protection
- Pas de logs des données sensibles
- Redaction automatique dans OCR results
- GDPR right to be forgotten

## Troubleshooting

### Documents non uploadés
```bash
docker-compose logs kyc-api | grep -i upload
aws s3 ls s3://molam-kyc/kyc/
```

### Processor bloqué
```bash
docker-compose logs kyc-processor
psql $POSTGRES_DSN -c "SELECT * FROM molam_kyc_requests WHERE status='pending'"
```

### Face match toujours en échec
- Vérifier résolution (min 640x480)
- Vérifier format (JPG/PNG)
- Vérifier que le visage est visible

## Licence

Propriétaire - Molam
