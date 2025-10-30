# Brique 7 - Biométrie (Fingerprint, Face ID, Passkeys/WebAuthn)

**Enterprise-grade biometric authentication service for Molam ID using WebAuthn/FIDO2 Passkeys. Never stores biometric templates - only public keys and attestations.**

## Features

- ✅ **WebAuthn/Passkeys**: FIDO2 compliant biometric authentication
- ✅ **Multi-platform**: Web, iOS (Face ID/Touch ID), Android (BiometricPrompt), HarmonyOS, Desktop
- ✅ **Secure Enclave**: Hardware-backed keys (iOS Secure Enclave, Android StrongBox)
- ✅ **Step-up Authentication**: Additional verification for sensitive operations
- ✅ **Device Management**: List, track, and revoke registered devices
- ✅ **Zero Biometric Storage**: Only stores public keys, attestations, and counters
- ✅ **SIRA Integration**: Risk analysis and trust scores
- ✅ **RBAC/ABAC**: Role-based and attribute-based access control
- ✅ **Multi-tenant**: Supports multiple countries, currencies, and languages

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│          Molam ID - Biometrics Service                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Client (Web/iOS/Android) ──┐                               │
│                               │                               │
│                               ▼                               │
│                    ┌──────────────────┐                      │
│                    │ WebAuthn/FIDO2   │                      │
│                    │   Challenge      │                      │
│                    └──────────────────┘                      │
│                               │                               │
│                               ▼                               │
│            ┌──────────────────────────────────┐              │
│            │  Biometric Unlock (Local)        │              │
│            │  - Face ID / Touch ID (iOS)      │              │
│            │  - Fingerprint / Face (Android)  │              │
│            │  - Windows Hello (Desktop)       │              │
│            └──────────────────────────────────┘              │
│                               │                               │
│                               ▼                               │
│                  ┌──────────────────────┐                    │
│                  │  Sign Challenge      │                    │
│                  │  (Secure Enclave)    │                    │
│                  └──────────────────────┘                    │
│                               │                               │
│                               ▼                               │
│                    ┌──────────────────┐                      │
│                    │  Server Verify   │                      │
│                    │  Public Key      │                      │
│                    └──────────────────┘                      │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  Storage: PostgreSQL (devices, credentials, audit)          │
│  Cache: Redis (challenges, rate limiting)                   │
│  Events: SIRA signals (trust scores, anomalies)             │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Runtime**: Node.js 20+ with TypeScript 5.3
- **Framework**: Express.js 4.18
- **Database**: PostgreSQL 14+ (devices, credentials, preferences, audit logs)
- **Cache**: Redis 7+ (challenges, rate limiting)
- **Crypto**: @simplewebauthn/server (WebAuthn utilities)
- **Security**: JWT RS256, mTLS (Envoy), rate limiting
- **Metrics**: Prometheus (prom-client)

## Installation

```bash
# Install dependencies
cd brique-07-biometrics
npm install

# Build TypeScript
npm run build

# Run in development
npm run dev

# Run in production
npm start
```

## Environment Variables

See [.env.example](.env.example) for all configuration options.

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_PUBLIC_KEY` - RS256 public key for JWT verification
- `WEBAUTHN_RP_ID` - Relying Party ID (e.g., "molam.com")
- `WEBAUTHN_RP_NAME` - Relying Party name (e.g., "Molam")
- `WEBAUTHN_ORIGINS` - Allowed origins (comma-separated)

## API Endpoints

### Enrollment (Registration)

#### POST /v1/biometrics/enroll/begin
Begin WebAuthn enrollment (create credentials).

**Request:**
```json
{
  "platform": "web",  // 'web' | 'ios' | 'android' | 'harmony' | 'desktop'
  "deviceLabel": "My iPhone 15"  // optional
}
```

**Response (200):**
```json
{
  "options": {
    "challenge": "base64url-encoded-challenge",
    "rp": { "name": "Molam", "id": "molam.com" },
    "user": { "id": "base64url-user-id", "name": "user@molam.com", "displayName": "User" },
    "pubKeyCredParams": [...],
    "timeout": 60000,
    "authenticatorSelection": {...}
  },
  "deviceId": "uuid"
}
```

#### POST /v1/biometrics/enroll/finish
Complete WebAuthn enrollment.

**Request:**
```json
{
  "deviceId": "uuid",
  "clientResponse": {
    "id": "credential-id",
    "rawId": "base64url-raw-id",
    "type": "public-key",
    "response": {
      "clientDataJSON": "base64url-client-data",
      "attestationObject": "base64url-attestation"
    }
  }
}
```

**Response (200):**
```json
{
  "status": "ok"
}
```

### Assertion (Authentication/Step-up)

#### POST /v1/biometrics/assert/begin
Begin WebAuthn assertion (verify identity).

**Request:** (empty body)

**Response (200):**
```json
{
  "options": {
    "challenge": "base64url-challenge",
    "timeout": 60000,
    "rpId": "molam.com",
    "allowCredentials": [...],
    "userVerification": "required"
  }
}
```

#### POST /v1/biometrics/assert/finish
Complete WebAuthn assertion.

**Request:**
```json
{
  "clientResponse": {
    "id": "credential-id",
    "rawId": "base64url-raw-id",
    "type": "public-key",
    "response": {
      "clientDataJSON": "base64url-client-data",
      "authenticatorData": "base64url-authenticator-data",
      "signature": "base64url-signature",
      "userHandle": "base64url-user-handle"
    }
  }
}
```

**Response (200):**
```json
{
  "status": "ok"
}
```

### Preferences

#### GET /v1/biometrics/prefs
Get user's biometric preferences.

**Response (200):**
```json
{
  "user_id": "uuid",
  "biometrics_enabled": true,
  "require_biometric_for_sensitive": true,
  "step_up_threshold": 50000,
  "country_code": "SN",
  "currency": "XOF",
  "created_at": "2025-10-27T10:00:00Z",
  "updated_at": "2025-10-27T10:00:00Z"
}
```

#### PATCH /v1/biometrics/prefs
Update user's biometric preferences.

**Request:**
```json
{
  "biometrics_enabled": true,
  "require_biometric_for_sensitive": true,
  "step_up_threshold": 100000
}
```

**Response (200):**
```json
{
  "status": "ok"
}
```

### Device Management

#### GET /v1/biometrics/devices
List user's registered devices.

**Response (200):**
```json
{
  "devices": [
    {
      "id": "uuid",
      "device_label": "My iPhone 15",
      "platform": "ios",
      "os_version": "17.0",
      "app_version": "1.0.0",
      "attested": true,
      "created_at": "2025-10-27T10:00:00Z",
      "last_seen_at": "2025-10-27T12:00:00Z",
      "credential_count": 1
    }
  ]
}
```

#### DELETE /v1/biometrics/credentials/:credentialId
Revoke a specific credential.

**Response (200):**
```json
{
  "status": "ok"
}
```

#### DELETE /v1/biometrics/devices/:deviceId
Remove a device and all its credentials.

**Response (200):**
```json
{
  "status": "ok"
}
```

## Frontend Integration

### Web (React/TypeScript)

See [web/src/components/BiometricsButton.tsx](web/src/components/BiometricsButton.tsx) for complete example.

```typescript
import { enrollBegin, enrollFinish, assertBegin, assertFinish } from './utils/webauthn';

// Enroll biometrics
const { options, deviceId } = await enrollBegin('web');
const credential = await navigator.credentials.create({ publicKey: options });
await enrollFinish(deviceId, credential);

// Verify biometrics
const options = await assertBegin();
const assertion = await navigator.credentials.get({ publicKey: options });
await assertFinish(assertion);
```

### iOS (Swift)

See [mobile/ios/BiometricsManager.swift](mobile/ios/BiometricsManager.swift) for complete example.

```swift
let biometrics = BiometricsManager()

// Enroll
biometrics.enrollBiometrics { result in
    switch result {
    case .success:
        print("Enrolled successfully")
    case .failure(let error):
        print("Error: \(error)")
    }
}

// Verify
biometrics.verifyBiometrics { result in
    switch result {
    case .success:
        print("Verified successfully")
    case .failure(let error):
        print("Error: \(error)")
    }
}
```

### Android (Kotlin)

See [mobile/android/BiometricsManager.kt](mobile/android/BiometricsManager.kt) for complete example.

```kotlin
val biometrics = BiometricsManager(context)

// Enroll
biometrics.enrollBiometrics(
    activity = this,
    executor = mainExecutor,
    onSuccess = { println("Enrolled successfully") },
    onError = { error -> println("Error: $error") }
)

// Verify
biometrics.verifyBiometrics(
    activity = this,
    executor = mainExecutor,
    onSuccess = { println("Verified successfully") },
    onError = { error -> println("Error: $error") }
)
```

## Security Features

### Never Stores Biometric Data
- **Public keys only**: Server only stores COSE-encoded public keys
- **No templates**: Biometric templates (fingerprints, face data) never leave the device
- **Secure Enclave**: Private keys stored in hardware-backed secure storage
- **Zero knowledge**: Server cannot access or reconstruct biometric data

### Anti-Replay Protection
- **Challenge-response**: Unique challenge for each authentication
- **TTL**: Challenges expire after 5 minutes
- **One-time use**: Challenge deleted after use
- **Sign counter**: Detects cloned authenticators

### Clone Detection
- **Sign counter**: Increments with each use
- **Mismatch detection**: Alert if counter doesn't increase
- **Revocation**: Automatic credential revocation on clone detection

### Rate Limiting
- **Sliding window**: Redis-based rate limiter
- **Per-user & per-IP**: 60 requests/minute default
- **Stricter limits**: Enrollment (5/5min), Assertion (10/min)

### Audit Logging
- **Immutable logs**: Append-only audit table
- **Full traceability**: User, device, IP, geo, user-agent
- **Correlation IDs**: Request tracing
- **Event types**: enroll_begin, enroll_finish, assert_begin, assert_success, assert_fail

### SIRA Integration
- **Trust scores**: Device trust scores (0-1)
- **Risk signals**: biometric_enrolled, biometric_assert_ok
- **Anomaly detection**: High failure rates, suspicious patterns

## Use Cases

### 1. Login (Replace Password/OTP)
When biometrics are enabled, users can log in using Face ID, Touch ID, or Windows Hello instead of entering passwords or OTP codes.

### 2. Step-up Authentication
For sensitive operations (e.g., large transfers, password reset, IBAN changes), require biometric verification even if user is already logged in.

**Example:**
```typescript
// Before sensitive operation
const options = await assertBegin();
const assertion = await navigator.credentials.get({ publicKey: options });
await assertFinish(assertion);

// Now user is "stepped-up" for next 5 minutes
// Proceed with sensitive operation
```

### 3. Device Binding
Require specific device for certain operations (e.g., agent transactions, internal employee actions).

### 4. Multi-factor Authentication (MFA)
Combine biometrics with other factors:
- Something you know (password/PIN)
- Something you have (device/security key)
- Something you are (biometrics)

## RBAC/ABAC Integration

Different policies for different user types:

**External Users (customers, merchants):**
- Optional biometrics
- Step-up for amounts > threshold
- Device binding optional

**Internal Users (employees, agents):**
- Mandatory biometrics for sensitive operations
- Higher step-up requirements
- Device binding required
- Shorter step-up TTL (5 min vs 30 min)

**Example policy (Envoy ext_authz):**
```yaml
check_settings:
  context_extensions:
    required_factors: "biometric"  # Require biometric for this endpoint
    step_up_max_age: "300"          # Step-up valid for 5 minutes
```

## Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests (requires real browser)
npm run test:e2e
```

**Note:** Full WebAuthn testing requires real browsers/devices as credentials cannot be simulated. Use E2E tests with Playwright/Selenium for comprehensive testing.

## Production Deployment

### 1. Database Setup

```bash
psql molam_id < sql/007_biometrics_core.sql
```

### 2. Configure JWT

Generate RS256 keypair:
```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -outform PEM -pubout -out public.pem
```

Store private key in Vault, use public key in `JWT_PUBLIC_KEY`.

### 3. Configure WebAuthn

- **RP ID**: Must match your domain (e.g., "molam.com")
- **RP Name**: Display name (e.g., "Molam")
- **Origins**: All allowed origins (app.molam.com, web.molam.com)

### 4. Deploy Behind Envoy (mTLS)

```yaml
# envoy.yaml
clusters:
  - name: biometrics_service
    connect_timeout: 0.25s
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: biometrics_service
      endpoints:
        - lb_endpoints:
          - endpoint:
              address:
                socket_address:
                  address: biometrics-service
                  port_value: 8080
    transport_socket:
      name: envoy.transport_sockets.tls
      typed_config:
        "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.UpstreamTlsContext
        common_tls_context:
          tls_certificates:
            - certificate_chain: { filename: "/etc/certs/client-cert.pem" }
              private_key: { filename: "/etc/certs/client-key.pem" }
          validation_context:
            trusted_ca: { filename: "/etc/certs/ca-cert.pem" }
```

### 5. Monitoring

**Prometheus metrics:**
- `http_request_duration_seconds` - Request latency
- `molam_biometrics_enrollments_total` - Total enrollments
- `molam_biometrics_assertions_total{status}` - Assertions by status
- `molam_biometrics_devices_total` - Registered devices

**Alerts:**
```yaml
groups:
  - name: biometrics
    rules:
      - alert: HighAssertionFailureRate
        expr: rate(molam_biometrics_assertions_total{status="fail"}[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High biometric assertion failure rate"

      - alert: BiometricsServiceDown
        expr: up{job="biometrics"} == 0
        for: 1m
        annotations:
          summary: "Biometrics service is down"
```

## Compliance

- **PCI-DSS**: N/A (no payment card data)
- **GDPR**: Biometric data never stored; consent logged
- **FIDO2 Certified**: Uses certified @simplewebauthn library
- **SOC 2**: Audit logs, encryption at rest/transit
- **Local Regulations**: CNIL (France), BCEAO (West Africa)

## Troubleshooting

### WebAuthn not working in browser

1. **HTTPS required**: WebAuthn only works on HTTPS (or localhost for dev)
2. **Check RP ID**: Must match domain (no subdomains for platform authenticators)
3. **Check allowed origins**: Must match exactly (including port for dev)

### iOS Face ID not working

1. **Info.plist**: Add `NSFaceIDUsageDescription`
2. **Secure Enclave**: Only available on iPhone 5s+ (A7 chip+)
3. **Biometry enrolled**: User must have Face ID/Touch ID configured

### Android fingerprint not working

1. **BiometricPrompt**: Use AndroidX BiometricPrompt (not deprecated FingerprintManager)
2. **StrongBox**: Only available on Pixel 3+, Samsung S9+
3. **Screen lock**: User must have secure screen lock enabled

### High assertion failure rate

1. **Check SIRA signals**: Review anomaly detection
2. **Clone detection**: Check sign counter mismatches
3. **Expired challenges**: Increase challenge TTL if users are slow
4. **User error**: Provide better UX guidance

## License

MIT

## Support

For issues, please contact: support@molam.com
