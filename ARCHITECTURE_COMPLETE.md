# Architecture Complète - Molam-ID (36 Briques)

## Vue d'ensemble

Molam-ID est un système d'identité et d'authentification distribué composé de **36 microservices** (briques) orchestrés pour fournir une solution complète d'identity & access management (IAM) pour l'écosystème Molam (Pay, Eats, Shop, etc.).

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│  Mobile Apps │ Web Apps │ USSD │ Partner APIs │ Admin Dashboards│
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   API GATEWAY (Port 3000)                        │
│  - Routing unifié vers toutes les briques                       │
│  - Rate limiting, CORS, Helmet security                         │
│  - Request ID tracking                                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
      ┌────────────────────┼────────────────────┐
      │                    │                    │
      ▼                    ▼                    ▼
┌──────────┐         ┌──────────┐        ┌──────────┐
│ Briques  │         │ Briques  │        │ Briques  │
│  1-11    │         │  12-23   │        │ 33-36    │
│  Auth &  │         │ Control  │        │ Admin &  │
│ Security │         │ & RBAC   │        │   UI     │
└─────┬────┘         └─────┬────┘        └─────┬────┘
      │                    │                    │
      └────────────────────┼────────────────────┘
                           │
      ┌────────────────────┼────────────────────┐
      │                    │                    │
      ▼                    ▼                    ▼
┌───────────┐        ┌─────────┐         ┌──────────┐
│PostgreSQL │        │  Redis  │         │  Kafka   │
│  (5432)   │        │ (6379)  │         │  (9092)  │
└───────────┘        └─────────┘         └──────────┘
```

## Liste des 36 Briques

### Core Identity (Briques 1-5)
| Brique | Nom | Port | Description |
|--------|-----|------|-------------|
| 1 | Signup/Login | 3001 | Inscription et authentification de base |
| 2 | Session Management | 3001 | Gestion des sessions et refresh tokens |
| 3 | JWT/Tokens | 3001 | Génération et validation JWT |
| 4 | Onboarding/KYC | 3001 | Onboarding multi-canal (Web/Mobile/USSD) |
| 5 | Login v2 | 3001 | Login amélioré avec multi-canaux |

### Authentication & Security (Briques 6-11)
| Brique | Nom | Port | Description |
|--------|-----|------|-------------|
| 6 | Password Reset | 8085 | Réinitialisation de mot de passe |
| 7 | Biometrics | 8080 | Authentification biométrique (WebAuthn) |
| 8 | Voice Auth | 8081 | Authentification vocale |
| 9 | Geo & Timezone | 3009 | Géolocalisation et gestion des fuseaux horaires |
| 10 | Device Fingerprinting | 8083 | Empreinte d'appareil et session binding |
| 11 | MFA/2FA | 8084 | Multi-factor authentication |

### Delegation & Control (Briques 12-15)
| Brique | Nom | Port | Description |
|--------|-----|------|-------------|
| 12 | Delegation | 3012 | Délégation de permissions |
| 13 | Blacklist & Suspensions | 3013 | Gestion des blocages et suspensions |
| 14 | Audit Logs | 3014 | Journalisation d'audit (WORM-style) |
| 15 | i18n/Multilingue | 3015 | Internationalisation et traductions |

### Data & Profile (Briques 16-19)
| Brique | Nom | Port | Description |
|--------|-----|------|-------------|
| 16 | FX/Multicurrency | 3016 | Gestion des devises multiples |
| 17 | User Profile | 3017 | Profils utilisateurs |
| 18 | Update Profile | 3018 | Mise à jour des profils |
| 19 | Export Profile | 3019 | Export de données utilisateur (RGPD) |

### RBAC & Authorization (Briques 20-23)
| Brique | Nom | Port | Description |
|--------|-----|------|-------------|
| 20 | RBAC Granular | 3020 | Contrôle d'accès basé sur les rôles (granulaire) |
| 21 | Role Management | 3021 | Gestion des rôles et permissions |
| 22 | Admin ID | 3022 | Administration de l'identité |
| 23 | Sessions Monitoring | 3023 | Monitoring des sessions (basique) |

### Frontend & SDK (Briques 24-32)
| Brique | Nom | Type | Description |
|--------|-----|------|-------------|
| 24 | SDK Auth | Library | SDK client pour authentification |
| 25 | UI ID | Frontend | Interfaces utilisateur d'authentification |
| 26 | Admin UI | Frontend | Dashboard administrateur |
| 27 | i18n Frontend | Frontend | Traductions frontend |
| 28 | Multicurrency UI | Frontend | Interface multi-devises |
| 29 | User Profile UI | Frontend | Interface de profil utilisateur |
| 30 | Export Profile UI | Frontend | Interface d'export de données |
| 31 | RBAC Frontend | Frontend | Interface de gestion des rôles |
| 32 | API Role Mgmt | API | API de gestion des rôles |

### Admin & Advanced Monitoring (Briques 33-36)
| Brique | Nom | Port | Description |
|--------|-----|------|-------------|
| 33 | API Admin | 3033 | API d'administration globale |
| 34 | **Advanced Sessions Monitoring** | **3034** | **Monitoring avancé avec détection d'anomalies** |
| 35 | **SDK Auth (Multi-platform)** | **N/A** | **SDKs TypeScript, Swift, Kotlin** |
| 36 | **UI de gestion ID** | **3036 (API), 5173 (Web)** | **Interface multi-plateforme (Web, Mobile, Desktop)** |

## Infrastructure Partagée

### Base de données
- **PostgreSQL 15** (port 5432)
  - Database: `molam`
  - User: `molam`
  - Schémas: ~37 tables pour toutes les briques

### Cache & Messaging
- **Redis 7** (port 6379)
  - Sessions cache
  - Rate limiting
  - Pub/sub events

- **Kafka** (port 9092)
  - Event streaming
  - Audit logs
  - Notifications asynchrones

### Observabilité
- **Prometheus** (port 9090)
  - Métriques de toutes les briques
  - Health checks
  - Performance monitoring

- **Grafana** (port 3100)
  - Dashboards de visualisation
  - Alerting
  - Login: admin/admin

## Architecture de Communication

### Synchronous Communication (HTTP/REST)
```
Client → API Gateway → Brique → PostgreSQL/Redis
```

### Asynchronous Communication (Events)
```
Brique A → Kafka → Brique B (subscriber)
Brique C → Redis Pub/Sub → Brique D
```

### Service Dependencies

**Brique 34 (Advanced Sessions Monitoring)** dépend de:
- Brique 9 (Geo) pour la détection d'impossible travel
- Brique 10 (Device Fingerprinting) pour la corrélation des devices
- SIRA (Risk Analysis Service) pour le scoring de risque
- Brique 14 (Audit) pour les logs WORM

**Brique 14 (Audit)** est appelée par:
- Brique 9, 12, 13, 34 (et autres) pour centraliser les logs

## Flux d'Authentification Complet

```
1. Utilisateur → API Gateway → Brique 4 (Onboarding/Signup)
                              ↓
                        PostgreSQL (créer user)
                              ↓
2. Utilisateur → API Gateway → Brique 5 (Login v2)
                              ↓
                        Brique 11 (MFA si activé)
                              ↓
                        Brique 10 (Device fingerprint)
                              ↓
                        Brique 9 (Géolocalisation)
                              ↓
                        Brique 34 (Session créée + anomaly check)
                              ↓
                        JWT généré → Client

3. Requête authentifiée → API Gateway (vérifie JWT)
                        ↓
                        Brique 20/21 (RBAC check)
                        ↓
                        Brique cible (business logic)
                        ↓
                        Brique 34 (heartbeat session)
                        ↓
                        Brique 14 (audit log)
```

## Sécurité

### Authentification
- JWT avec clés asymétriques (RS256)
- Public key partagée entre toutes les briques
- Audience: `molam-id`
- Issuer: `https://id.molam.com`

### Authorization
- RBAC (Role-Based Access Control) via Briques 20-21
- ABAC (Attribute-Based Access Control) via Brique 6
- Claims JWT: `{ id, email, roles: [{module, role}] }`

### Audit Trail
- Brique 14: WORM-style audit logs
- Brique 34: WORM signatures HMAC pour actions critiques
- Tous les événements sensibles sont loggés

### Rate Limiting
- API Gateway: 100 req/min par IP
- Services individuels: configurable

## Déploiement

### Option 1: Docker Compose (Dev/Staging)

```bash
# Démarrer tous les services
./start-all.sh

# Ou sur Windows
start-all.bat

# Tester l'intégration
./test-integration.sh
```

### Option 2: Kubernetes (Production)

```yaml
# Exemple de déploiement K8s
apiVersion: apps/v1
kind: Deployment
metadata:
  name: id-sessions-advanced
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api
        image: molam/id-sessions-advanced:latest
        ports:
        - containerPort: 3034
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: molam-secrets
              key: database-url
```

### Variables d'Environnement Critiques

```env
# JWT
JWT_PUBLIC_KEY=<clé publique RS256>
JWT_SECRET=<fallback secret>
JWT_AUDIENCE=molam-id
JWT_ISSUER=https://id.molam.com

# Database
DATABASE_URL=postgresql://molam:molam_pass@postgres:5432/molam

# Redis
REDIS_URL=redis://redis:6379

# Kafka (optionnel)
KAFKA_BROKERS=kafka:29092
KAFKA_ENABLED=true

# Sécurité
WORM_SIGNING_SECRET=<secret HMAC pour audit>

# Services externes
SIRA_URL=http://sira:8080
MAXMIND_LICENSE_KEY=<clé MaxMind GeoIP>
AWS_ACCESS_KEY_ID=<AWS key>
AWS_SECRET_ACCESS_KEY=<AWS secret>
```

## Observabilité & Monitoring

### Métriques Prometheus

Chaque brique expose `/metrics`:

```
# Exemples de métriques Brique 34
id_sessions_active{channel="web"}
id_sessions_heartbeat_rate
id_sessions_revoked_total
id_anomalies_detected_total{kind="impossible_travel"}
```

### Health Checks

Chaque brique expose:
- `/health` - Health check détaillé
- `/healthz` - Health check simple (pour K8s)
- `/livez` - Liveness probe

### Logs

Format JSON structuré:
```json
{
  "timestamp": "2025-10-31T20:00:00Z",
  "level": "info",
  "service": "id-sessions-advanced",
  "message": "Session created",
  "session_id": "uuid",
  "user_id": "uuid",
  "channel": "mobile"
}
```

## Scalabilité

### Scaling Horizontal

Toutes les briques peuvent être scalées indépendamment:

```bash
# Docker Compose
docker-compose up --scale id-sessions-advanced=3

# Kubernetes
kubectl scale deployment id-sessions-advanced --replicas=3
```

### Bottlenecks Potentiels

1. **PostgreSQL**: Base partagée → considérer le sharding par module
2. **Redis**: Cache unique → considérer Redis Cluster
3. **API Gateway**: Point d'entrée unique → mettre un load balancer devant

### Recommandations Production

- Min 3 répliques par brique critique
- HPA (Horizontal Pod Autoscaler) sur CPU >70%
- Connection pooling PostgreSQL: 20 connexions/instance
- Redis: Mode cluster avec 3 masters

## Conformité & Privacy

### RGPD
- Brique 19: Export de données (droit à la portabilité)
- Brique 34: Minimisation des données géo (pays/ville seulement)
- Brique 14: Logs d'audit avec rétention configurable

### PCI-DSS (si applicable)
- Pas de stockage de données de carte
- JWT ne contient pas de données sensibles
- Audit trail complet (Brique 14)

### SOC 2
- Brique 34: Monitoring des sessions + anomalies
- Brique 14: Audit logs immuables (WORM)
- Brique 13: Contrôles de blacklist/suspension

## Intégrations Futures

### Briques 35-36 (à venir)
Le système est conçu pour facilement accueillir de nouvelles briques:
1. Créer le service avec port unique
2. Ajouter au docker-compose.orchestration.yml
3. Ajouter la route dans l'API Gateway
4. Déployer

### Services Externes
- **SIRA**: Fraud risk analysis
- **Voice ML**: Speaker verification
- **MaxMind**: GeoIP database
- **Twilio/Infobip**: SMS/USSD
- **AWS S3/KMS**: Storage & encryption

## Troubleshooting

### Services ne démarrent pas
```bash
# Vérifier les logs
docker-compose -f docker-compose.orchestration.yml logs -f <service>

# Vérifier la santé
curl http://localhost:3000/status
```

### Problèmes de connexion DB
```bash
# Vérifier PostgreSQL
docker exec molam-postgres pg_isready -U molam

# Tester la connexion
docker exec molam-postgres psql -U molam -c "SELECT 1"
```

### Problèmes de permissions
```bash
# Vérifier les rôles utilisateur
docker exec molam-postgres psql -U molam -d molam -c "
  SELECT u.email, r.role, r.module
  FROM molam_users u
  JOIN molam_user_roles r ON u.id = r.user_id"
```

## Support & Documentation

- **Documentation détaillée**: Voir README.md de chaque brique
- **API Docs**: Swagger/OpenAPI disponibles sur `/api-docs`
- **Architecture Decision Records**: Voir `/docs/adr/`
- **Runbooks**: Voir `/docs/runbooks/`

## Roadmap

### Q4 2025
- [ ] Briques 35-36 (à définir)
- [ ] Migration Kubernetes complète
- [ ] Service mesh (Istio/Linkerd)
- [ ] Distributed tracing (Jaeger)

### Q1 2026
- [ ] Machine learning pour détection d'anomalies (Brique 34)
- [ ] Support WebAuthn Level 3
- [ ] Zero-trust architecture
- [ ] Multi-cloud deployment

---

**Version**: 1.0.0
**Dernière mise à jour**: 31 Octobre 2025
**Auteur**: Molam ID Team
**Licence**: Propriétaire - Molam © 2025
