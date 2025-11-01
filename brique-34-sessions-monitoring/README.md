# Brique 34 - Monitoring des sessions actives

## Objectif

Mise en place d'un monitoring temps réel, industrialisé et réversible des sessions Molam ID pour tous les canaux (Mobile, Web, USSD, API), en corrélant:

- Device fingerprint (Brique 10) + géolocalisation (Brique 9)
- Type d'utilisateur: externe (client unique pour tous les modules) et interne (employés Molam avec accès par filiale)
- Anomalies détectées (impossible travel, fingerprint mismatch, trop d'échecs 2FA, etc.) avec hooks SIRA
- Gouvernance: révocation ciblée ou globale par l'utilisateur, par les admins ID (pas les filiales), et par politique

## Fonctionnalités

1. **Inventaire des sessions** (par utilisateur, par organisation interne, par canal)
2. **Heartbeat & idle timeout** avec TTL côté Redis + Postgres d'audit
3. **API de révocation** (une session, toutes les sessions, par device, par canal) — idempotent
4. **Détection d'anomalies en ligne** (politiques configurables) + événements SIRA
5. **Observabilité** (Prometheus) + WORM-audit minimal pour actions de révocation
6. **Support USSD** : sessions courtes, PIN requis pour relier à l'ID, codes *131# intégrés au flux

## Architecture

```
┌─────────────────┐
│  Client Apps    │
│ (Mobile/Web/API)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Gateway    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Brique 34 - Sessions Monitoring    │
│  ┌──────────────────────────────┐   │
│  │  Session Service             │   │
│  │  - List sessions             │   │
│  │  - Heartbeat                 │   │
│  │  - Revocation                │   │
│  │  - Anomaly detection         │   │
│  └──────────────────────────────┘   │
└──────────┬──────────────────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌────────┐   ┌─────────┐
│ PostgreSQL│   │  Redis  │
└────────┘   └─────────┘
```

## Installation

```bash
# Install dependencies
npm install

# Setup database
psql -U molam -d molam -f sql/034_sessions_monitoring.sql

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run in development
npm run dev

# Run in production
npm start
```

## Configuration

Variables d'environnement:

```env
# Server
PORT=3034
NODE_ENV=production

# Database
DATABASE_URL=postgresql://molam:molam_pass@localhost:5432/molam

# Redis (event bus)
REDIS_URL=redis://localhost:6379

# JWT
JWT_PUBLIC_KEY=<your-public-key>
JWT_SECRET=<fallback-secret>
JWT_AUDIENCE=molam-id
JWT_ISSUER=https://id.molam.com

# Security
WORM_SIGNING_SECRET=<your-hmac-secret>

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://id.molam.com
```

## API Endpoints

### User Self-Service

- `GET /api/id/sessions/me` - List my active sessions
- `POST /api/id/sessions/:id/revoke` - Revoke one of my sessions
- `POST /api/id/sessions/revoke_all` - Revoke all sessions except current
- `POST /api/id/sessions/heartbeat` - Heartbeat to extend expiration

### Admin (ID domain only)

- `GET /api/id/admin/sessions/user/:userId` - List sessions for a user
- `POST /api/id/admin/sessions/revoke` - Revoke sessions by filter
- `GET /api/id/admin/sessions/policies` - Get session policies
- `PUT /api/id/admin/sessions/policies` - Update session policies

### Health & Metrics

- `GET /health` - Health check with DB status
- `GET /healthz` - Kubernetes health check
- `GET /livez` - Liveness check
- `GET /metrics` - Prometheus metrics

## Anomaly Detection

Le système détecte automatiquement:

1. **Impossible Travel**: Déplacement géographique trop rapide entre deux sessions
2. **Fingerprint Mismatch**: Score de similarité d'empreinte device < seuil
3. **Bruteforce**: Trop d'échecs MFA/heure
4. **Unusual Channel**: Changement inattendu de canal
5. **Geo Block**: Connexion depuis un pays bloqué

## Policies Configurables

```json
{
  "idle_timeout": { "minutes": 30 },
  "absolute_timeout": { "hours": 720 },
  "max_failed_mfa_hour": { "count": 5 },
  "impossible_travel": { "kmh_threshold": 900 },
  "fp_mismatch_tolerance": { "score_min": 0.85 }
}
```

## WORM Audit Trail

Toutes les actions critiques (révocations, modifications de politiques) sont enregistrées de manière immuable avec:

- Signature HMAC
- Acteur (user/admin/system)
- Timestamp
- Payload complet
- IP et User-Agent

## Observabilité

### Métriques Prometheus

- `id_sessions_active` - Nombre de sessions actives
- `id_sessions_heartbeat_rate` - Taux de heartbeat
- `id_sessions_revoked_total` - Total des révocations
- `id_anomalies_detected_total{kind}` - Anomalies détectées par type

### Logs

Tous les événements sont loggés dans `molam_session_activity`:
- HEARTBEAT
- AUTH_SUCCESS / AUTH_FAIL
- MFA_CHALLENGE / MFA_FAIL
- LOGOUT
- ANOMALY
- REVOKE

## Tests

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Intégrations

### Brique 9 - Géolocalisation
Utilise les données de géolocalisation pour détecter l'impossible travel.

### Brique 10 - Device Fingerprinting
Corrèle les empreintes de devices pour détecter les changements suspects.

### SIRA - Risk Analysis
Publie les anomalies vers SIRA pour scoring de risque et action automatique.

### Kafka/Redis Events
Publie les événements:
- `id.session.revoked` - Session révoquée
- `id.session.anomaly` - Anomalie détectée

## Cloisonnement

Cette brique agit uniquement dans le domaine ID. Les filiales (Pay, Eats, etc.) consomment l'état des sessions via:
- JWT introspection (lecture seule)
- Webhooks (notifications)
- Ils ne peuvent PAS modifier ou révoquer les sessions

## Sécurité

- ✅ JWT authentication sur toutes les routes
- ✅ RBAC: `id:admin` requis pour routes admin
- ✅ WORM audit trail avec signatures HMAC
- ✅ Rate limiting (à configurer au niveau gateway)
- ✅ CORS configuré strictement
- ✅ Helmet security headers

## Conformité RGPD

- Stockage minimisé de la géolocalisation (pays/ville)
- IP tronquée si requis
- Self-service utilisateur: révocation, visualisation devices
- Alerte mail en cas d'anomalie high/critical
- Export des données possible via Brique 30

## Déploiement

### Docker

```bash
docker build -t molam/id-sessions-monitoring:latest .
docker run -p 3034:3034 --env-file .env molam/id-sessions-monitoring:latest
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: id-sessions-monitoring
spec:
  replicas: 3
  selector:
    matchLabels:
      app: id-sessions-monitoring
  template:
    metadata:
      labels:
        app: id-sessions-monitoring
    spec:
      containers:
      - name: api
        image: molam/id-sessions-monitoring:latest
        ports:
        - containerPort: 3034
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: molam-secrets
              key: database-url
        livenessProbe:
          httpGet:
            path: /livez
            port: 3034
        readinessProbe:
          httpGet:
            path: /healthz
            port: 3034
```

## Roadmap

- [ ] Support WebSocket pour notifications temps réel
- [ ] Machine learning pour améliorer la détection d'anomalies
- [ ] Dashboard admin UI dédié
- [ ] Intégration DeviceCheck (iOS) et Play Integrity (Android)
- [ ] Geo-fencing avancé par rôle
- [ ] Session recording pour forensics (opt-in)

## Support

Pour toute question ou problème, contactez l'équipe ID Molam.

## Licence

Propriétaire - Molam © 2025
