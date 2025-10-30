# Brique 7 - Deployment Guide

## Prerequisites

1. **PostgreSQL 14+**
2. **Redis 7+**
3. **Node.js 20+**
4. **JWT RS256 Keypair**
5. **Valid domain with HTTPS**

## Step 1: Database Setup

```bash
# Create database (if not exists)
createdb molam_id

# Run migration
psql molam_id < sql/007_biometrics_core.sql

# Verify tables
psql molam_id -c "\dt molam_*"
```

Expected tables:
- `molam_devices`
- `molam_webauthn_credentials`
- `molam_biometric_prefs`
- `molam_auth_events`
- `molam_webauthn_challenges` (fallback, use Redis in production)

## Step 2: Generate JWT Keypair

```bash
# Generate RS256 keypair
openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -outform PEM -pubout -out jwt-public.pem

# Store private key securely (Vault/KMS)
# Use public key in environment variables
```

## Step 3: Configure Environment

```bash
cp .env.example .env
```

**Edit .env:**

```bash
# Database
DATABASE_URL=postgresql://molam:password@db-host:5432/molam_id

# Redis
REDIS_URL=redis://redis-host:6379

# JWT (RS256)
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----"
JWT_AUDIENCE=molam.id
JWT_ISSUER=https://id.molam.com

# WebAuthn
WEBAUTHN_RP_ID=molam.com
WEBAUTHN_RP_NAME=Molam
WEBAUTHN_ORIGINS=https://app.molam.com,https://web.molam.com
WEBAUTHN_TIMEOUT=60000

# Server
PORT=8080

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60

# SIRA
SIRA_ENABLED=true
SIRA_STREAM_NAME=sira_signals

# Metrics
METRICS_ENABLED=true
```

## Step 4: Install Dependencies

```bash
npm install
```

## Step 5: Build TypeScript

```bash
npm run build
```

## Step 6: Run Service

```bash
# Development
npm run dev

# Production
npm start

# With PM2 (recommended)
pm2 start dist/server.js --name molam-biometrics -i max
```

## Step 7: Verify Deployment

```bash
# Health check
curl http://localhost:8080/health

# Metrics
curl http://localhost:8080/metrics

# Test enrollment (requires valid JWT)
curl -X POST http://localhost:8080/v1/biometrics/enroll/begin \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"platform":"web"}'
```

## Step 8: Configure Envoy (mTLS)

**envoy.yaml:**

```yaml
static_resources:
  listeners:
    - name: molam_id_listener
      address:
        socket_address:
          address: 0.0.0.0
          port_value: 443
      filter_chains:
        - filters:
          - name: envoy.filters.network.http_connection_manager
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
              stat_prefix: ingress_http
              codec_type: AUTO
              route_config:
                name: local_route
                virtual_hosts:
                  - name: molam_biometrics
                    domains: ["api.molam.com"]
                    routes:
                      - match:
                          prefix: "/v1/biometrics"
                        route:
                          cluster: biometrics_service
                          timeout: 30s
              http_filters:
                - name: envoy.filters.http.router

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
      # mTLS configuration
      transport_socket:
        name: envoy.transport_sockets.tls
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.UpstreamTlsContext
          common_tls_context:
            tls_certificates:
              - certificate_chain:
                  filename: "/etc/envoy/certs/client-cert.pem"
                private_key:
                  filename: "/etc/envoy/certs/client-key.pem"
            validation_context:
              trusted_ca:
                filename: "/etc/envoy/certs/ca-cert.pem"
```

## Step 9: Monitoring Setup

### Prometheus

**prometheus.yml:**

```yaml
scrape_configs:
  - job_name: 'molam-biometrics'
    static_configs:
      - targets: ['biometrics-service:8080']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Grafana Dashboard

Import dashboard with metrics:
- `http_request_duration_seconds` - Request latency
- `molam_biometrics_enrollments_total` - Enrollments
- `molam_biometrics_assertions_total` - Assertions
- `molam_biometrics_devices_total` - Devices

### Alertmanager

**alerts.yml:**

```yaml
groups:
  - name: biometrics
    interval: 30s
    rules:
      - alert: HighAssertionFailureRate
        expr: rate(molam_biometrics_assertions_total{status="fail"}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High biometric assertion failure rate (>10%)"
          description: "Assertion failure rate is {{ $value | humanizePercentage }}"

      - alert: BiometricsServiceDown
        expr: up{job="molam-biometrics"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Biometrics service is down"

      - alert: HighEnrollmentLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket{route="/v1/biometrics/enroll/finish"}) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High enrollment latency (p95 > 2s)"
```

## Step 10: Security Hardening

### 1. Firewall Rules

```bash
# Only allow internal traffic to port 8080
# External traffic goes through Envoy on 443

iptables -A INPUT -p tcp --dport 8080 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 8080 -j DROP
```

### 2. TLS/SSL Certificates

```bash
# Use Let's Encrypt or corporate CA
certbot certonly --standalone -d api.molam.com
```

### 3. Secrets Management

```bash
# Store in Vault
vault kv put secret/molam/biometrics \
  jwt_public_key="..." \
  database_url="..." \
  redis_url="..."
```

### 4. Rate Limiting (Nginx/Envoy)

```nginx
limit_req_zone $binary_remote_addr zone=biometrics:10m rate=10r/s;

location /v1/biometrics {
    limit_req zone=biometrics burst=20 nodelay;
    proxy_pass http://biometrics-service:8080;
}
```

## Step 11: Backup & Disaster Recovery

### Database Backups

```bash
# Daily backups
pg_dump molam_id > molam_id_$(date +%Y%m%d).sql

# Automated with cron
0 2 * * * pg_dump molam_id | gzip > /backups/molam_id_$(date +\%Y\%m\%d).sql.gz
```

### Redis Persistence

```bash
# Enable AOF
redis-cli CONFIG SET appendonly yes
redis-cli CONFIG SET appendfsync everysec
```

### Credential Recovery

- Users can re-enroll devices if credentials are lost
- Old devices can be revoked via API or admin panel
- No need to backup WebAuthn credentials (they're device-specific)

## Docker Deployment

**Dockerfile:**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 8080
CMD ["npm", "start"]
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  biometrics:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - JWT_PUBLIC_KEY=${JWT_PUBLIC_KEY}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: molam_id
      POSTGRES_USER: molam
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./sql:/docker-entrypoint-initdb.d
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
```

## Kubernetes Deployment

**deployment.yaml:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: molam-biometrics
  namespace: molam-id
spec:
  replicas: 3
  selector:
    matchLabels:
      app: molam-biometrics
  template:
    metadata:
      labels:
        app: molam-biometrics
    spec:
      containers:
      - name: biometrics
        image: molam/biometrics:latest
        ports:
        - containerPort: 8080
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
        - name: JWT_PUBLIC_KEY
          valueFrom:
            secretKeyRef:
              name: molam-secrets
              key: jwt-public-key
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: molam-biometrics
  namespace: molam-id
spec:
  selector:
    app: molam-biometrics
  ports:
  - port: 8080
    targetPort: 8080
  type: ClusterIP
```

## Performance Tuning

### PostgreSQL

```sql
-- Add indexes for performance
CREATE INDEX CONCURRENTLY idx_webauthn_user_active
ON molam_webauthn_credentials(user_id)
WHERE last_used_at > NOW() - INTERVAL '30 days';

-- Partition audit logs by month
CREATE TABLE molam_auth_events_2025_10 PARTITION OF molam_auth_events
FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

### Redis

```bash
# Increase max memory
redis-cli CONFIG SET maxmemory 1gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Node.js

```bash
# Increase heap size
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Use cluster mode (PM2)
pm2 start dist/server.js -i max --name molam-biometrics
```

## Rollback Procedure

```bash
# 1. Stop new service
pm2 stop molam-biometrics

# 2. Restore previous version
git checkout v1.0.0
npm run build

# 3. Start service
pm2 start dist/server.js --name molam-biometrics

# 4. Verify
curl http://localhost:8080/health

# 5. Database rollback (if needed)
psql molam_id < backups/molam_id_rollback.sql
```

## Troubleshooting

See [README.md](README.md#troubleshooting) for common issues.

## Support

For deployment assistance: devops@molam.com
