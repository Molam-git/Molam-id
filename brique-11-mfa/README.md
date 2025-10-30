# Brique 11 — 2FA/MFA Unifié

Service de **Multi-Factor Authentication (MFA)** unifié pour Molam-ID, supportant multiples facteurs d'authentification pour une sécurité adaptative.

## 🎯 Objectifs

- **Authentification multi-facteurs** : SMS OTP, Email OTP, TOTP, WebAuthn/Passkeys, Push, USSD PIN
- **Codes de récupération** : Backup codes pour accès d'urgence
- **Policies MFA** : Règles conditionnelles par scope (login, paiement, admin)
- **Step-up Authentication** : MFA dynamique selon le niveau de risque
- **Audit complet** : Logs immutables de tous les événements MFA

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MFA Service (Port 8084)                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Enroll     │  │   Challenge  │  │    Verify    │      │
│  │   Factor     │  │   (Send OTP) │  │   (Check)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Recovery   │  │    Policy    │  │  Factor Mgmt │      │
│  │    Codes     │  │   (Rules)    │  │  (List/Del)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                      Crypto Layer                            │
│  • Argon2id (OTP hashing)  • KMS (TOTP encryption)          │
│  • TOTP RFC6238            • SHA-256 (recovery codes)        │
├─────────────────────────────────────────────────────────────┤
│                   Notification Adapters                       │
│  • SMS (Twilio/Orange)     • Email (SendGrid/SES)           │
│  • Push (FCM/OneSignal)    • USSD (Carrier gateway)         │
└─────────────────────────────────────────────────────────────┘
         │                           │
    PostgreSQL                    Redis
   (Factors, OTPs)          (Rate limiting)
```

## 📊 Base de données

### Tables principales

#### `molam_mfa_factors`
Facteurs MFA enrollés par l'utilisateur.

```sql
CREATE TABLE molam_mfa_factors (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES molam_users(id),
  factor_type mfa_factor NOT NULL,  -- sms_otp, email_otp, totp, webauthn, etc.
  label TEXT,                        -- "Mon iPhone", "Authenticator App"
  secret_enc BYTEA,                  -- Encrypted TOTP secrets
  public_data JSONB,                 -- QR code URI, WebAuthn public key
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
```

#### `molam_mfa_otps`
OTPs temporaires (SMS/Email).

```sql
CREATE TABLE molam_mfa_otps (
  id UUID PRIMARY KEY,               -- Challenge ID
  user_id UUID NOT NULL,
  channel TEXT NOT NULL,             -- Phone or email
  code_hash BYTEA NOT NULL,          -- Argon2id hashed
  expires_at TIMESTAMPTZ NOT NULL,
  attempts SMALLINT DEFAULT 0,
  max_attempts SMALLINT DEFAULT 5,
  verified_at TIMESTAMPTZ
);
```

#### `molam_mfa_recovery_codes`
Codes de récupération.

```sql
CREATE TABLE molam_mfa_recovery_codes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  code_hash BYTEA NOT NULL,          -- SHA-256 hashed
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ
);
```

#### `molam_mfa_policies`
Règles MFA par scope.

```sql
CREATE TABLE molam_mfa_policies (
  scope TEXT PRIMARY KEY,            -- "login", "pay.transfer", "admin.dashboard"
  rule JSONB NOT NULL,
  -- Example rule:
  -- {
  --   "min_factors": 1,
  --   "allowed_types": ["sms_otp", "totp", "webauthn"],
  --   "required_for_amount": { "XOF": 50000 },
  --   "require_webauthn_for_roles": ["super_admin"]
  -- }
);
```

## 🔧 Installation

### 1. Installer les dépendances

```bash
cd brique-11-mfa
npm install
```

### 2. Configuration

Créer `.env` :

```bash
# Database
DATABASE_URL=postgres://molam:molam_pass@localhost:5432/molam

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-change-in-production

# KMS (encryption for TOTP secrets)
MFA_MASTER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# OTP Settings
OTP_TTL_SEC=180
OTP_LENGTH=6
MAX_OTP_ATTEMPTS=5

# Notification Providers (optional)
# TWILIO_ACCOUNT_SID=...
# TWILIO_AUTH_TOKEN=...
# SENDGRID_API_KEY=...
# FCM_SERVER_KEY=...

# CORS
CORS_ORIGIN=*
PORT=8084
```

### 3. Appliquer le schéma SQL

```bash
psql $DATABASE_URL -f sql/011_mfa.sql
```

### 4. Démarrer le service

```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

## 📡 API Endpoints

### 🔐 Authentification requise

Tous les endpoints (sauf `/verify`, `/recovery`, `/policy/:scope`) nécessitent un JWT valide :

```
Authorization: Bearer <JWT>
```

### 1. Enroll MFA Factor

**POST** `/api/mfa/enroll`

Enroller un nouveau facteur MFA.

**Body** :
```json
{
  "factor_type": "sms_otp",    // sms_otp | email_otp | totp | webauthn | ussd_pin
  "channel": "+22500000000",   // (optional) Phone/email override
  "label": "Mon iPhone",       // (optional) User-friendly label
  "is_primary": true           // (optional) Set as primary factor
}
```

**Response (SMS/Email OTP)** :
```json
{
  "factor_id": "uuid",
  "factor_type": "sms_otp",
  "label": "Mon iPhone",
  "is_primary": true,
  "created_at": "2025-01-15T10:00:00Z"
}
```

**Response (TOTP)** :
```json
{
  "factor_id": "uuid",
  "factor_type": "totp",
  "public_data": {
    "uri": "otpauth://totp/Molam-ID:user@example.com?secret=...",
    "qr_data": "otpauth://..."  // Encode as QR on frontend
  }
}
```

**Response (Recovery Codes)** :
```json
{
  "factor_type": "recovery_code",
  "recovery_codes": [
    "A1B2-C3D4-E5F6",
    "G7H8-I9J0-K1L2",
    ...
  ],
  "warning": "Save these codes securely. They will not be shown again."
}
```

### 2. Start MFA Challenge

**POST** `/api/mfa/challenge`

Démarrer un challenge MFA (envoie OTP par SMS/Email).

**Body** :
```json
{
  "scope": "login",        // (optional) Policy scope
  "context": {             // (optional) Context for risk analysis
    "ip": "192.168.1.1",
    "location": "Dakar"
  }
}
```

**Response** :
```json
{
  "challenge_id": "uuid",
  "factor_type": "sms_otp",
  "channel": "+22500000000",
  "expires_in": 180,
  "message": "OTP sent via SMS"
}
```

### 3. Verify MFA Challenge

**POST** `/api/mfa/verify`

Vérifier un code OTP/TOTP.

**Body (OTP)** :
```json
{
  "challenge_id": "uuid",
  "code": "123456"
}
```

**Body (TOTP)** :
```json
{
  "factor_id": "uuid",
  "code": "123456"
}
```

**Response** :
```json
{
  "success": true,
  "message": "MFA verification successful",
  "mfa_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "uuid"
}
```

Le `mfa_token` contient `mfa_verified: true` et doit être utilisé pour les actions nécessitant MFA.

### 4. Use Recovery Code

**POST** `/api/mfa/recovery`

Utiliser un code de récupération (bypass MFA).

**Body** :
```json
{
  "user_id": "uuid",
  "recovery_code": "A1B2-C3D4-E5F6"
}
```

**Response** :
```json
{
  "success": true,
  "message": "Recovery code accepted",
  "mfa_token": "...",
  "warning": "Consider re-enrolling MFA factors"
}
```

### 5. List MFA Factors

**GET** `/api/mfa/factors`

Lister tous les facteurs MFA de l'utilisateur.

**Response** :
```json
{
  "factors": [
    {
      "id": "uuid",
      "factor_type": "sms_otp",
      "label": "Mon iPhone",
      "is_primary": true,
      "is_active": true,
      "created_at": "2025-01-15T10:00:00Z",
      "last_used_at": "2025-01-15T12:00:00Z"
    },
    {
      "id": "uuid",
      "factor_type": "totp",
      "label": "Authenticator App",
      "is_primary": false,
      "is_active": true,
      "created_at": "2025-01-15T11:00:00Z"
    }
  ]
}
```

### 6. Remove MFA Factor

**DELETE** `/api/mfa/factors/:id`

Supprimer (désactiver) un facteur MFA.

**Response** :
```json
{
  "success": true,
  "message": "Factor removed"
}
```

### 7. Get MFA Policy

**GET** `/api/mfa/policy/:scope`

Obtenir la policy MFA pour un scope donné.

**Response** :
```json
{
  "scope": "login",
  "rule": {
    "min_factors": 1,
    "allowed_types": ["sms_otp", "totp", "webauthn"]
  },
  "updated_at": "2025-01-01T00:00:00Z"
}
```

## 🔒 Sécurité

### Encryption
- **TOTP secrets** : Encrypted at rest avec AES-256-GCM (KMS/Vault en production)
- **OTP codes** : Hashed avec Argon2id (non-reversible)
- **Recovery codes** : Hashed avec SHA-256

### Rate Limiting
- **Challenge** : 3 tentatives / 5 minutes par utilisateur
- **Verify** : 5 tentatives / 5 minutes par challenge
- **Enroll** : 10 tentatives / 1 heure par utilisateur

### Lockout
- Après 5 tentatives échouées : lockout de 15 minutes
- Cleared automatiquement après succès

### TOTP
- **Time window** : ±1 step (30 secondes)
- **Algorithm** : HMAC-SHA1 (RFC6238)
- **Digits** : 6

## 🧪 Tests

```bash
# Démarrer le service MFA
npm start

# Dans un autre terminal
npm test
```

**Tests E2E** :
1. Health check
2. Enroll SMS OTP factor
3. Enroll TOTP factor
4. List enrolled factors
5. Start SMS OTP challenge
6. Verify with invalid code (should fail)
7. Verify with correct code
8. Generate recovery codes
9. Use recovery code
10. Get MFA policy
11. Remove MFA factor
12. Verify audit logs

## 🎯 Cas d'usage

### 1. Login avec SMS OTP

```javascript
// 1. Utilisateur se login (Brique 5)
POST /api/id/login
{ "email": "user@example.com", "password": "..." }
→ { "access_token": "..." }  // JWT sans mfa_verified

// 2. Démarrer challenge MFA
POST /api/mfa/challenge (Authorization: Bearer <token>)
{ "scope": "login" }
→ { "challenge_id": "...", "message": "OTP sent via SMS" }

// 3. Utilisateur reçoit SMS avec code 123456
// 4. Vérifier code
POST /api/mfa/verify
{ "challenge_id": "...", "code": "123456" }
→ { "mfa_token": "..." }  // JWT avec mfa_verified: true

// 5. Utiliser mfa_token pour actions protégées
GET /api/pay/transfer (Authorization: Bearer <mfa_token>)
```

### 2. Step-up pour paiement élevé

```javascript
// Policy: paiements > 50,000 XOF nécessitent MFA
POST /api/pay/transfer
{ "amount": 100000, "currency": "XOF" }
→ 403 { "error": "MFA required", "challenge_url": "/api/mfa/challenge" }

// Effectuer MFA
POST /api/mfa/challenge
{ "scope": "pay.transfer", "context": { "amount": 100000 } }
→ { "challenge_id": "..." }

POST /api/mfa/verify
{ "challenge_id": "...", "code": "..." }
→ { "mfa_token": "..." }

// Retry avec mfa_token
POST /api/pay/transfer (Authorization: Bearer <mfa_token>)
→ 200 OK
```

### 3. TOTP avec Authenticator App

```javascript
// 1. Enroll TOTP
POST /api/mfa/enroll
{ "factor_type": "totp", "label": "Google Authenticator" }
→ { "public_data": { "uri": "otpauth://totp/..." } }

// 2. Frontend génère QR code avec uri
// 3. Utilisateur scanne QR dans Google Authenticator

// 4. Vérifier premier code pour activer
POST /api/mfa/verify
{ "factor_id": "...", "code": "123456" }  // Code from app
→ { "success": true, "mfa_token": "..." }
```

## 🔗 Intégration

### Avec Brique 3 (AuthZ)
```javascript
// Policy: Admin dashboard requiert MFA + WebAuthn
{
  "scope": "admin.dashboard",
  "rule": {
    "min_factors": 2,
    "require_webauthn_for_roles": ["super_admin"]
  }
}
```

### Avec Brique 10 (Device)
```javascript
// Step-up MFA pour nouveau device
if (device.trust === 'unknown') {
  // Force MFA challenge
  POST /api/mfa/challenge
  { "scope": "login", "context": { "device_trust": "unknown" } }
}
```

## 📈 Monitoring

### Métriques
- Nombre d'enrollments par facteur type
- Taux de succès/échec des vérifications
- Temps moyen de vérification
- Lockouts par utilisateur

### Logs
Tous les événements sont loggés dans `molam_mfa_audit` :
- `factor_enrolled`
- `verification_success`
- `verification_failed`
- `recovery_code_used`
- `factor_removed`

## 🚀 Production

### Notifications réelles
Intégrer les providers dans [src/adapters/notify.js](src/adapters/notify.js) :
- **SMS** : Twilio, Orange SMS API, MTN
- **Email** : SendGrid, AWS SES, Mailgun
- **Push** : Firebase Cloud Messaging, OneSignal

### KMS
Utiliser un vrai KMS en production (ne pas utiliser `MFA_MASTER_KEY` local) :
- AWS KMS
- HashiCorp Vault
- Azure Key Vault

### Rate Limiting
Ajuster les limites selon votre trafic dans [src/mfa/config.js](src/mfa/config.js).

## 📝 License

MIT
