# 🎤 Brique 8 — Voice Auth (Authentification Vocale)

> Système d'authentification vocale forte, inclusive et accessible pour tous les profils Molam (clients, marchands, agents, employés)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)

---

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Intégration Client](#intégration-client)
- [Sécurité](#sécurité)
- [Tests](#tests)
- [Déploiement](#déploiement)
- [Observabilité](#observabilité)

---

## 🎯 Vue d'ensemble

La **Brique 8 - Voice Auth** fournit une authentification vocale:

### Objectif
Fournir une authentification vocale **forte** et **inclusive** (accessibilité, faible littératie) pour tous les profils, sans stocker d'audio brut comme secret.

### Principe de sécurité
- ✅ **Embeddings uniquement**: On stocke un gabarit vocal dérivé (embedding numérique) salté et haché
- ❌ **Zero audio storage**: L'audio brut est éphémère (chiffré S3, <24h) et purgé après extraction
- 🔐 **Privacy-first**: Envelope encryption (AES-256-GCM) + KMS
- 🎯 **Anti-spoofing**: Score ML intégré pour détecter les attaques

### Cas d'usage
- **Step-up**: Opérations sensibles (reset PIN USSD, élévation plafond, virement marchand)
- **Login fort**: Alternative/fallback à la biométrie locale (Brique 7) quand indisponible
- **Accessibilité**: Canal IVR/USSD vocal pour personnes non lectrices
- **Multi-langue**: Phrases locales (Wolof, Français, Anglais, Arabe, etc.)

---

## ✨ Fonctionnalités

### 🎙️ Enrôlement vocal
- Génération de phrase aléatoire par locale
- Capture audio (5-15 secondes)
- Extraction embedding via ML service
- Quality & spoofing checks
- Stockage chiffré avec sel unique

### ✅ Vérification vocale
- Challenge-response avec phrase dynamique
- Comparaison cosine similarity
- Seuils adaptatifs par utilisateur
- Step-up TTL (5 minutes par défaut)

### 🌍 Multi-plateforme
- **Web**: MediaRecorder API (WebM/WAV)
- **iOS**: AVAudioRecorder (16kHz mono WAV)
- **Android**: MediaRecorder (3GP/AMR-NB)
- **IVR**: Webhooks Twilio, Infobip, Africa's Talking

### 🔒 Sécurité avancée
- JWT RS256 authentication
- mTLS à la gateway
- Rate limiting (Redis)
- Anti-replay (nonce)
- Audit immuable (WORM S3)
- SIRA integration (risk scoring)

### 🎛️ Préférences utilisateur
- Activation/désactivation
- Seuils de similarité personnalisables
- Seuils anti-spoofing
- Cooldown après échecs

---

## 🏗️ Architecture

```
┌─────────────┐
│  Client App │  (Web/iOS/Android/IVR)
└──────┬──────┘
       │ HTTPS + JWT
       ▼
┌─────────────────────────────────────┐
│  Voice Auth API (Port 8081)         │
│  ┌─────────────────────────────┐    │
│  │ Routes:                     │    │
│  │  - /v1/voice/enroll         │    │
│  │  - /v1/voice/assert         │    │
│  │  - /v1/voice/prefs          │    │
│  │  - /v1/ivr/webhook          │    │
│  └─────────────────────────────┘    │
└──┬─────────┬─────────┬──────────┬───┘
   │         │         │          │
   ▼         ▼         ▼          ▼
┌──────┐ ┌─────┐ ┌────────┐ ┌────────┐
│ PG   │ │Redis│ │S3 Temp │ │Voice ML│
│ DB   │ │     │ │(Audio) │ │(gRPC)  │
└──────┘ └─────┘ └────────┘ └────────┘
   │                          │
   │    Embeddings (encrypted)│
   │    Attempts (audit)      │
   │                          │
   └─────────┬────────────────┘
             ▼
        ┌─────────┐
        │  SIRA   │  (Risk Engine)
        │ Signals │
        └─────────┘
```

### Composants

| Composant | Description | Techno |
|-----------|-------------|--------|
| **Voice Auth API** | Service REST principal | Express + TypeScript |
| **Voice ML** | Extraction embeddings + anti-spoof | Python (ECAPA-TDNN) |
| **PostgreSQL** | Credentials, prefs, attempts | pg |
| **Redis** | Rate limiting, nonce | redis |
| **S3** | Audio éphémère (<24h) | AWS S3 + lifecycle |
| **SIRA** | Risk scoring adaptatif | Redis Streams |

---

## 🚀 Installation

### Prérequis

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- AWS S3 (ou MinIO)
- Voice ML service (microservice séparé)

### Setup

```bash
cd brique-08-voice-auth

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your config
nano .env

# Run database migrations
psql -U postgres -d molam_id -f sql/002_voice_auth.sql

# Build TypeScript
npm run build

# Start service
npm start
```

### Development

```bash
# Watch mode (auto-reload)
npm run dev

# Run tests
npm test

# Lint
npm run lint
```

---

## ⚙️ Configuration

Voir [.env.example](.env.example) pour la liste complète.

### Variables essentielles

```env
# Server
PORT=8081
NODE_ENV=production

# JWT
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

# Encryption (32-byte hex key)
DATA_ENC_KEY=your-32-byte-hex-key

# Database
DATABASE_URL=postgresql://molam:pass@localhost:5432/molam_id

# S3 (ephemeral audio, <24h retention)
S3_TEMP_BUCKET=molam-voice-temp
AWS_REGION=eu-west-1

# Voice ML service
VOICE_ML_URL=http://voice-ml:9000

# IVR
IVR_WEBHOOK_SECRET=your-webhook-secret

# SIRA
SIRA_ENABLED=true
```

---

## 📡 API Endpoints

### Authentication

Tous les endpoints `/v1/voice/*` requièrent un **JWT Bearer token**.

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

### Enrôlement vocal

#### 1️⃣ Begin Enrollment

```http
POST /v1/voice/enroll/begin
Content-Type: application/json

{
  "locale": "fr_SN"  // fr_SN, wo_SN, en_GH, ar_MA
}
```

**Response:**
```json
{
  "phrase": "Je confirme être le propriétaire de ce compte Molam",
  "reqId": "uuid",
  "locale": "fr_SN"
}
```

#### 2️⃣ Upload Audio

```http
POST /v1/voice/upload
Content-Type: application/json

{
  "reqId": "uuid",
  "base64": "UklGRiQAAABXQVZF...",
  "mime": "audio/wav"
}
```

**Response:**
```json
{
  "status": "ok",
  "key": "voice/user-123/req-456.wav"
}
```

#### 3️⃣ Finish Enrollment

```http
POST /v1/voice/enroll/finish
Content-Type: application/json

{
  "reqId": "uuid",
  "key": "voice/user-123/req-456.wav",
  "locale": "fr_SN",
  "channel": "mobile_app",
  "phrase": "Je confirme..."
}
```

**Response:**
```json
{
  "status": "ok",
  "enrolled": true,
  "replaced": false
}
```

### Vérification vocale

#### 1️⃣ Begin Verification

```http
POST /v1/voice/assert/begin
Content-Type: application/json

{
  "locale": "fr_SN"
}
```

**Response:**
```json
{
  "reqId": "uuid",
  "phrase": "Molam sécurise mon argent aujourd'hui"
}
```

#### 2️⃣ Upload Audio (same as enrollment)

#### 3️⃣ Finish Verification

```http
POST /v1/voice/assert/finish
Content-Type: application/json

{
  "reqId": "uuid",
  "key": "voice/user-123/req-789.wav",
  "channel": "mobile_app"
}
```

**Response (success):**
```json
{
  "status": "ok",
  "similarity": 0.8542,
  "spoofing": 0.12,
  "ttl_sec": 300
}
```

**Response (failure):**
```json
{
  "error": "voice_not_match",
  "similarity": 0.6234,
  "spoofing": 0.08
}
```

### Préférences

#### Get Preferences

```http
GET /v1/voice/prefs
```

**Response:**
```json
{
  "user_id": "uuid",
  "voice_enabled": true,
  "require_voice_for_sensitive": false,
  "similarity_threshold": 0.78,
  "spoofing_threshold": 0.35,
  "max_failures": 5,
  "cooldown_sec": 900
}
```

#### Update Preferences

```http
PATCH /v1/voice/prefs
Content-Type: application/json

{
  "voice_enabled": true,
  "similarity_threshold": 0.80
}
```

### Révocation

```http
DELETE /v1/voice/credentials
```

**Response:**
```json
{
  "status": "ok",
  "revoked": true
}
```

### IVR Webhook

```http
POST /v1/ivr/webhook
X-IVR-Signature: sha256=<hmac>

{
  "userId": "uuid",
  "reqId": "uuid",
  "audioBase64": "...",
  "phone": "+221XXXXXXXX"
}
```

---

## 💻 Intégration Client

### Web (TypeScript)

```typescript
import { VoiceAuth } from './voiceAuth';

const voice = new VoiceAuth('https://api.molam.com', jwtToken);

// Enrollment
try {
  await voice.enroll('fr_SN');
  console.log('✅ Voice enrolled!');
} catch (error) {
  console.error('❌ Enrollment failed:', error);
}

// Verification
try {
  const { similarity, spoofing } = await voice.verify('fr_SN');
  console.log(`✅ Verified! Similarity: ${similarity}`);
} catch (error) {
  console.error('❌ Verification failed:', error);
}
```

### iOS (Swift)

```swift
let voiceAuth = VoiceAuthManager(
    baseURL: "https://api.molam.com",
    token: jwtToken
)

// Enrollment
voiceAuth.enroll(locale: "fr_SN") { result in
    switch result {
    case .success:
        print("✅ Voice enrolled!")
    case .failure(let error):
        print("❌ Error: \(error)")
    }
}

// Verification
voiceAuth.verify(locale: "fr_SN") { result in
    switch result {
    case .success(let (similarity, spoofing)):
        print("✅ Verified! Similarity: \(similarity)")
    case .failure(let error):
        print("❌ Error: \(error)")
    }
}
```

### Android (Kotlin)

```kotlin
val voiceAuth = VoiceAuthManager(
    context,
    "https://api.molam.com",
    jwtToken
)

// Enrollment
lifecycleScope.launch {
    voiceAuth.enroll("fr_SN").fold(
        onSuccess = { println("✅ Voice enrolled!") },
        onFailure = { println("❌ Error: ${it.message}") }
    )
}

// Verification
lifecycleScope.launch {
    voiceAuth.verify("fr_SN").fold(
        onSuccess = { (similarity, spoofing) ->
            println("✅ Verified! Similarity: $similarity")
        },
        onFailure = { println("❌ Error: ${it.message}") }
    )
}
```

---

## 🔒 Sécurité

### Privacy-first Design

| Donnée | Stockage | Durée | Chiffrement |
|--------|----------|-------|-------------|
| **Audio brut** | S3 éphémère | <24h | SSE-KMS |
| **Embedding** | PostgreSQL | Permanent | AES-256-GCM + envelope |
| **Salt** | PostgreSQL | Permanent | AES-256-GCM + envelope |
| **HMAC** | PostgreSQL | Permanent | Non (hash public) |

### Flux de sécurité

1. **Audio capture**: Client (5-15 secondes)
2. **Upload**: HTTPS → S3 temp (SSE-KMS)
3. **ML extraction**: Voice ML service (gRPC interne)
4. **Envelope encryption**:
   ```
   Embedding → AES-256-GCM(embedding, DEK) → [iv|tag|ct]
   Salt → AES-256-GCM(salt, DEK) → [iv|tag|ct]
   ```
5. **Storage**: PostgreSQL (encrypted blobs)
6. **Purge audio**: Delete from S3 immediately after

### Anti-spoofing

- **Score ML**: ASVspoof-like détection
- **Seuil**: Configurable par user (défaut: 0.35)
- **SIRA**: Adaptation dynamique selon risque

### Compliance

- ✅ **RGPD**: Minimisation données, consentement explicite, opt-out
- ✅ **PCI-DSS**: Step-up pour transactions sensibles
- ✅ **ISO 27001**: Audit immuable, chiffrement bout-en-bout

---

## 🧪 Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

### Test structure

```
tests/
├── voice.test.ts          # E2E tests (enrollment, verify, prefs)
├── ivr.test.ts            # IVR webhook tests
└── security.test.ts       # Security & crypto tests
```

---

## 🚀 Déploiement

### Kubernetes

```bash
# Apply secrets
kubectl create secret generic voice-auth-secrets \
  --from-literal=jwt-public-key="$(cat jwt-public.pem)" \
  --from-literal=data-enc-key="$(openssl rand -hex 32)" \
  --from-literal=database-url="postgresql://..." \
  --from-literal=redis-url="redis://..." \
  --from-literal=aws-access-key-id="..." \
  --from-literal=aws-secret-access-key="..." \
  --from-literal=kms-key-id="alias/molam-voice" \
  --from-literal=ivr-webhook-secret="..."

# Deploy
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods -l app=voice-auth
kubectl logs -f deployment/voice-auth
```

### Docker

```bash
# Build
docker build -t molam/voice-auth:1.0.0 .

# Run
docker run -d \
  --name voice-auth \
  -p 8081:8081 \
  --env-file .env \
  molam/voice-auth:1.0.0
```

### Production checklist

- [ ] PostgreSQL avec réplication (hot standby)
- [ ] Redis Sentinel (HA)
- [ ] S3 bucket avec lifecycle (<24h)
- [ ] KMS keys multi-region
- [ ] mTLS à la gateway
- [ ] Rate limiting activé
- [ ] Monitoring & alertes configurés
- [ ] Backup automatique
- [ ] Rollback plan en place

---

## 📊 Observabilité

### Métriques Prometheus

```prometheus
# Enrollment
voice_enroll_total{locale,channel}
voice_enroll_fail_total{reason}
voice_enroll_duration_seconds

# Verification
voice_assert_total{success}
voice_assert_duration_seconds
voice_similarity_avg{locale}
voice_spoofing_avg{locale}

# Quality
voice_quality_score_avg
voice_audio_duration_seconds

# Errors
voice_ml_timeout_total
voice_s3_error_total
```

### Logs structurés

```json
{
  "timestamp": "2025-01-27T10:30:45.123Z",
  "level": "info",
  "event": "voice_assert_ok",
  "userId": "uuid",
  "reqId": "uuid",
  "similarity": 0.8542,
  "spoofing": 0.12,
  "locale": "fr_SN",
  "channel": "mobile_app",
  "ip": "197.149.x.x",
  "country": "SN"
}
```

### Alertes

- `voice_assert_fail_rate > 10%` (par pays)
- `voice_ml_timeout_total > 5/min`
- `voice_spoofing_avg > 0.40` (possible attaque)
- `voice_s3_error_total > 0`

---

## 📖 Documentation supplémentaire

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Design détaillé
- [SECURITY.md](docs/SECURITY.md) - Threat model & mitigations
- [API.md](docs/API.md) - Référence API complète
- [INTEGRATION.md](docs/INTEGRATION.md) - Guides d'intégration
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Déploiement production

---

## 🤝 Support

Pour questions ou problèmes:
- 📧 Email: support@molam.com
- 💬 Slack: #voice-auth
- 📝 Issues: GitHub Issues

---

## 📄 Licence

Propriétaire - Molam © 2025

---

**🎉 Brique 8 - Voice Auth est maintenant prête pour production !**
