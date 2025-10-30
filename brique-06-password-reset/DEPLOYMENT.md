# Brique 6 - Deployment Guide

## Prerequisites

1. **PostgreSQL 14+**
   ```bash
   # Create database
   createdb molam_id

   # Run migrations
   psql molam_id < sql/006_password_pin_reset.sql
   ```

2. **Redis 7+**
   ```bash
   # Start Redis
   redis-server
   ```

3. **Node.js 20+**
   ```bash
   node --version  # v20.x.x or higher
   ```

## Installation Steps

### 1. Install Dependencies

```bash
cd brique-06-password-reset
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

**Required settings:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `PEPPER` - Cryptographic pepper (store in HSM/KMS in production)
- `JWT_RESET_SECRET` - JWT secret (rotate regularly in production)

### 3. Build TypeScript

```bash
npm run build
```

### 4. Run Database Migrations

```bash
psql molam_id < sql/006_password_pin_reset.sql
```

### 5. Start Service

```bash
# Development
npm run dev

# Production
npm start
```

## Verification

1. **Health Check**
   ```bash
   curl http://localhost:8085/health
   ```

2. **Metrics**
   ```bash
   curl http://localhost:8085/metrics
   ```

3. **Run Tests**
   ```bash
   npm test
   ```

## Optional Features

### Kafka Events

```bash
# .env
KAFKA_ENABLED=true
KAFKA_BROKERS=kafka1:9092,kafka2:9092
KAFKA_CLIENT_ID=molam-id-password-reset
```

**Topics created:**
- `molam.id.events` - Password and PIN reset events

**Events published:**
- `id.password.reset.completed`
- `id.ussd.pin.reset.completed`

### RabbitMQ/AMQP Events

```bash
# .env
AMQP_ENABLED=true
AMQP_URL=amqp://user:pass@rabbitmq:5672
```

**Exchanges created:**
- `molam.id.events` (topic, durable)

**Routing keys:**
- `id.password.reset.completed`
- `id.ussd.pin.reset.completed`

### SIRA Risk Analysis

```bash
# .env
SIRA_ENABLED=true
SIRA_WEBHOOK_URL=https://sira.molam.id/signals
SIRA_THRESHOLD_OTP_FAILURE_RATE=0.4
```

**Signals sent:**
- `otp_anomaly` - When OTP failure rate exceeds 40%
- `brute_force_attempt` - Multiple failed attempts from same IP
- `suspicious_reset_pattern` - Unusual reset patterns

## Production Deployment

### 1. Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 8085
CMD ["npm", "start"]
```

```bash
docker build -t molam-id-password-reset .
docker run -p 8085:8085 --env-file .env molam-id-password-reset
```

### 2. Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: molam-id-password-reset
spec:
  replicas: 3
  selector:
    matchLabels:
      app: molam-id-password-reset
  template:
    metadata:
      labels:
        app: molam-id-password-reset
    spec:
      containers:
      - name: api
        image: molam-id-password-reset:latest
        ports:
        - containerPort: 8085
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: molam-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: molam-secrets
              key: redis-url
        - name: PEPPER
          valueFrom:
            secretKeyRef:
              name: molam-secrets
              key: pepper
        livenessProbe:
          httpGet:
            path: /health
            port: 8085
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8085
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: molam-id-password-reset
spec:
  selector:
    app: molam-id-password-reset
  ports:
  - port: 8085
    targetPort: 8085
```

### 3. Monitoring

**Prometheus scrape config:**

```yaml
scrape_configs:
  - job_name: 'molam-id-password-reset'
    static_configs:
      - targets: ['localhost:8085']
    metrics_path: '/metrics'
```

**Grafana dashboard panels:**
- Password reset requests by country
- PIN reset requests by channel
- OTP failure rate
- Rate limiting events
- Request duration (p50, p95, p99)

### 4. Alerting

**Alert rules:**

```yaml
groups:
  - name: molam-id-password-reset
    rules:
      - alert: HighOTPFailureRate
        expr: rate(molam_id_otp_failures_total[5m]) > 0.4
        for: 5m
        annotations:
          summary: "High OTP failure rate detected"

      - alert: HighErrorRate
        expr: rate(molam_id_request_duration_seconds_count{status=~"5.."}[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High error rate detected"
```

## SMS/Email Provider Integration

### Twilio (SMS)

```typescript
// src/services/notifications.service.ts
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

export const sms = {
  async send(toE164: string, otp: string, lang: string, country?: string) {
    const ttl = Math.floor(env.OTP_TTL_SECONDS / 60);
    const message = t(lang, 'OTP_SMS', { otp, ttl: String(ttl) });

    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: toE164,
    });
  },
};
```

### AWS SES (Email)

```typescript
// src/services/notifications.service.ts
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: 'us-east-1' });

export const email = {
  async send(toEmail: string, otp: string, kind: 'password' | 'ussd_pin', lang: string) {
    const ttl = Math.floor(env.OTP_TTL_SECONDS / 60);
    const subject = kind === 'password'
      ? t(lang, 'OTP_EMAIL_SUBJECT')
      : t(lang, 'PIN_OTP_EMAIL_SUBJECT');
    const body = kind === 'password'
      ? t(lang, 'OTP_EMAIL_BODY', { otp, ttl: String(ttl) })
      : t(lang, 'PIN_OTP_EMAIL_BODY', { otp, ttl: String(ttl) });

    await ses.send(new SendEmailCommand({
      Source: 'noreply@molam.id',
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Subject: { Data: subject },
        Body: { Text: { Data: body } },
      },
    }));
  },
};
```

## Security Hardening

1. **TLS/SSL**: Use reverse proxy (nginx, Caddy) for TLS termination
2. **Firewall**: Only allow internal traffic to 8085
3. **Secrets**: Store PEPPER, JWT_SECRET in Vault/KMS
4. **Rate Limiting**: Adjust limits based on traffic patterns
5. **Audit Logs**: Archive to cold storage (S3, GCS) after 90 days
6. **Database**: Enable row-level security (RLS) for multi-tenancy
7. **Redis**: Enable password auth, use TLS

## Troubleshooting

### Server won't start

```bash
# Check database connection
psql $DATABASE_URL -c "SELECT NOW()"

# Check Redis connection
redis-cli -u $REDIS_URL PING

# Check logs
npm run dev
```

### Tests failing

```bash
# Ensure database is seeded
psql molam_id < sql/006_password_pin_reset.sql

# Check service is running
curl http://localhost:8085/health

# Run tests with verbose output
npm test -- --verbose
```

### High OTP failure rate

1. Check SIRA webhook for alerts
2. Review audit logs for patterns
3. Check SMS/email deliverability
4. Verify phone number normalization

## Performance Tuning

### Database

```sql
-- Add indexes
CREATE INDEX idx_reset_user_kind ON molam_reset_requests(user_id, kind, status);
CREATE INDEX idx_reset_created ON molam_reset_requests(created_at);

-- Connection pooling (already configured)
max: 20
idleTimeoutMillis: 30000
```

### Redis

```bash
# Increase max memory
redis-cli CONFIG SET maxmemory 256mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Enable persistence
redis-cli CONFIG SET appendonly yes
```

### Node.js

```bash
# Increase heap size
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Cluster mode (PM2)
pm2 start dist/server.js -i max
```

## License

MIT
