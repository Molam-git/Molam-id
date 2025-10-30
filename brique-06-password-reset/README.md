# Brique 6 - Password Reset + PIN USSD Reset

**Multi-country, multi-language, enterprise-grade password and PIN reset service for Molam ID.**

## Features

- ✅ **Multi-country**: Supports 50+ countries (Africa + LATAM) with automatic country detection via MCC/MNC
- ✅ **Multi-language**: 6 languages (French, English, Wolof, Arabic, Swahili, Hausa)
- ✅ **Password reset**: Email/SMS OTP flow with JWT tokens
- ✅ **PIN reset**: App/web and USSD flows (*131*99#)
- ✅ **USSD integration**: Complete menu system (*131#, *131*1#, *131*2#, *131*3#, *131*99#)
- ✅ **Security**: Argon2id + pepper, rate limiting, session invalidation, audit logs
- ✅ **Observability**: Prometheus metrics, Kafka/AMQP events, SIRA risk analysis
- ✅ **TypeScript**: Type-safe implementation with Zod validation

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   API       │────▶│  Database   │
│ (App/Web)   │     │  Routes     │     │  PostgreSQL │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                          ├──────▶ Redis (rate limiting)
                          ├──────▶ Kafka/AMQP (events)
                          ├──────▶ SIRA (risk analysis)
                          └──────▶ SMS/Email (notifications)
```

## Tech Stack

- **Runtime**: Node.js 20+ with TypeScript 5.3
- **Framework**: Express.js 4.18
- **Database**: PostgreSQL 14+ (with UUID, JSONB)
- **Cache**: Redis 7+ (rate limiting, counters)
- **Messaging**: Kafka 3.x / RabbitMQ 3.x (optional)
- **Crypto**: Argon2id (password/PIN/OTP hashing)
- **Phone**: libphonenumber-js (E.164 normalization)
- **Validation**: Zod (runtime type checking)
- **Metrics**: Prometheus (prom-client)

## Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development
npm run dev

# Run in production
npm start
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/molam_id

# Redis
REDIS_URL=redis://localhost:6379

# Crypto
PEPPER=use-hsm-key-ref-in-production

# OTP
OTP_TTL_SECONDS=600
OTP_LENGTH=6
MAX_ATTEMPTS=3

# Rate limiting
RATE_LIMIT_WINDOW_S=3600
RATE_LIMIT_MAX=10

# JWT
JWT_RESET_SECRET=rotated-in-vault-production
JWT_RESET_TTL_S=900

# Server
PORT=8085
DEFAULT_LANG=en

# Kafka (optional)
KAFKA_ENABLED=false
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=molam-id-password-reset

# AMQP (optional)
AMQP_ENABLED=false
AMQP_URL=amqp://localhost:5672

# SIRA (optional)
SIRA_ENABLED=false
SIRA_WEBHOOK_URL=https://sira.molam.id/signals
SIRA_THRESHOLD_OTP_FAILURE_RATE=0.4

# Metrics
METRICS_ENABLED=true
```

## API Endpoints

### Password Reset (App/Web)

#### 1. POST /api/id/password/forgot
Initiate password reset (send OTP via email or SMS).

**Request:**
```json
{
  "identity": "user@example.com" // or "+221771234567"
}
```

**Response (202):**
```json
{
  "status": "accepted",
  "expires_at": "2025-10-27T14:30:00Z"
}
```

#### 2. POST /api/id/password/verify
Verify OTP code and get reset token.

**Request:**
```json
{
  "identity": "user@example.com",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "reset_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 3. POST /api/id/password/confirm
Set new password with reset token.

**Request:**
```json
{
  "reset_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "new_password": "NewSecurePass123!"
}
```

**Response (200):**
```json
{
  "status": "ok"
}
```

### PIN Reset (App/Web)

#### 1. POST /api/id/ussd/pin/reset/start
Initiate PIN reset (send OTP).

**Request:**
```json
{
  "identity": "+221771234567"
}
```

**Response (202):**
```json
{
  "status": "accepted",
  "expires_at": "2025-10-27T14:30:00Z"
}
```

#### 2. POST /api/id/ussd/pin/reset/verify
Verify OTP for PIN reset.

**Request:**
```json
{
  "identity": "+221771234567",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "status": "verified"
}
```

#### 3. POST /api/id/ussd/pin/reset/confirm
Set new PIN.

**Request:**
```json
{
  "identity": "+221771234567",
  "new_pin": "1234"
}
```

**Response (200):**
```json
{
  "status": "ok"
}
```

### USSD Webhook

#### POST /api/id/ussd
USSD gateway webhook.

**Request:**
```json
{
  "msisdn": "+221771234567",
  "mccmnc": "608010",
  "text": "",
  "short_code": "*131*99#"
}
```

**Response (200):**
```json
{
  "response": "CON Réinit PIN: entrez code OTP:"
}
```

## USSD Codes

| Code | Description | Route |
|------|-------------|-------|
| `*131#` | Main menu | menu |
| `*131*1#` | Check balance | balance |
| `*131*2#` | Top-up account | topup |
| `*131*3#` | P2P transfer | transfer |
| `*131*99#` | Reset PIN | pin_reset |

## USSD PIN Reset Flow

1. **Step 0**: User dials `*131*99#` → System sends OTP via SMS
2. **Step 1**: User enters OTP → System verifies
3. **Step 2**: User enters new PIN (4-6 digits)
4. **Step 3**: User confirms PIN → System saves and invalidates sessions

## Multi-Language Support

| Language | Code | Regions |
|----------|------|---------|
| French | `fr` | West Africa, Central Africa |
| English | `en` | Global |
| Wolof | `wo` | Senegal, Gambia |
| Arabic | `ar` | North Africa, Sudan, Mauritania |
| Swahili | `sw` | East Africa (Kenya, Tanzania, Uganda) |
| Hausa | `ha` | Nigeria, Niger |

## Security

- **Argon2id + Pepper**: All passwords, PINs, and OTPs hashed with Argon2id + HSM pepper
- **Rate Limiting**: Sliding window rate limiter (10 req/hour per IP)
- **Session Invalidation**: All active sessions invalidated after password/PIN reset
- **OTP Expiry**: OTPs expire after 10 minutes
- **Max Attempts**: 3 OTP attempts per request
- **Audit Logs**: Append-only immutable logs with correlation IDs
- **SIRA Integration**: Automatic risk signals for anomalies (>40% OTP failure rate)

## Observability

### Prometheus Metrics

Access metrics at: `http://localhost:8085/metrics`

**Custom metrics:**
- `molam_id_password_reset_requests_total{country, channel}`
- `molam_id_password_reset_success_total{country}`
- `molam_id_ussd_pin_reset_requests_total{country, channel}`
- `molam_id_ussd_pin_reset_success_total{country}`
- `molam_id_otp_generated_total{kind, country}`
- `molam_id_otp_failures_total{kind, country, reason}`
- `molam_id_rate_limited_total{route}`
- `molam_id_ussd_requests_total{short_code, country}`
- `molam_id_request_duration_seconds{method, route, status}`

### Events (Kafka/AMQP)

**Published events:**
- `id.password.reset.completed` - Password reset completed
- `id.ussd.pin.reset.completed` - PIN reset completed (app or USSD)

**Event payload example:**
```json
{
  "event": "id.password.reset.completed",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "country_code": "SN",
  "timestamp": "2025-10-27T14:30:00Z"
}
```

### SIRA Risk Signals

**Signals sent to SIRA webhook:**
- `otp_anomaly` - OTP failure rate exceeds threshold (>40%)
- `brute_force_attempt` - Multiple failed attempts from same IP/identity
- `suspicious_reset_pattern` - Unusual reset patterns

## Testing

```bash
# Run tests
npm test
```

Tests cover:
- Health check
- Metrics endpoint
- Password reset flow (email/SMS)
- PIN reset flow (app/web)
- USSD webhook (main menu, PIN reset)
- Audit logs
- Multi-language support
- Database schema
- TypeScript compilation

## Production Checklist

- [ ] Rotate `PEPPER` (store in HSM/KMS)
- [ ] Rotate `JWT_RESET_SECRET` (store in Vault)
- [ ] Configure real SMS provider (Twilio, Africa's Talking, etc.)
- [ ] Configure real Email provider (SES, SendGrid, etc.)
- [ ] Set up DKIM, SPF, DMARC for email deliverability
- [ ] Configure DLT registration for SMS (India, Nigeria, etc.)
- [ ] Enable SIRA integration (`SIRA_ENABLED=true`)
- [ ] Enable Kafka/AMQP events
- [ ] Set up Prometheus scraping
- [ ] Configure database backups
- [ ] Set up Redis persistence (AOF/RDB)
- [ ] Add TLS/SSL termination (reverse proxy)
- [ ] Configure firewall rules (only allow internal traffic)
- [ ] Set up monitoring alerts (high OTP failure rate, API errors)
- [ ] Load testing (target: 1000 req/s)
- [ ] Disaster recovery plan

## License

MIT
