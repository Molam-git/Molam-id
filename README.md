# Molam-ID - Écosystème Complet d'Identité et d'Authentification

**Version**: 1.0.0
**Status**: ✅ OPERATIONAL - Login/Signup Ready
**Briques**: 36 composants intégrés (34 services + 1 SDK + 1 UI)

## Vue d'ensemble

Molam-ID est une plateforme complète d'Identity & Access Management (IAM) composée de 34 briques microservices orchestrées, fournissant authentification, autorisation, monitoring et audit pour l'écosystème Molam (Pay, Eats, Shop, etc.).

## 🚀 Système Opérationnel - Démarrage Rapide

### Accès Direct Web UI (En cours d'exécution)

**Interface Web** - Connexion et inscription:
```
http://localhost:5173
```
**Fonctionnalités disponibles:**
- ✅ Créer un compte (Signup)
- ✅ Se connecter (Login)
- ✅ Gérer votre profil
- ✅ Voir vos sessions actives
- ✅ Mode sombre/clair
- ✅ Accessibilité (TTS, clavier)

**API Backend** - Molam-ID Core:
```
http://localhost:3000
```

**Documentation complète**: Voir [SYSTEM_OPERATIONAL.md](SYSTEM_OPERATIONAL.md)

### Orchestration Complète (Docker)

```bash
# 1. Démarrer tous les services (36 briques + infrastructure)
./start-all.sh              # Linux/Mac
start-all.bat              # Windows

# 2. Tester l'intégration
./test-integration.sh

# 3. Accéder aux services
# Web UI:       http://localhost:5173  (Interface utilisateur)
# API Gateway:  http://localhost:3000  (API Backend)
# Grafana:      http://localhost:3100  (admin/admin)
# Prometheus:   http://localhost:9090
```

**Temps de démarrage**: 5-10 minutes (première fois), 1-2 minutes ensuite

## Documentation

| Document | Description |
|----------|-------------|
| **[SYSTEM_OPERATIONAL.md](SYSTEM_OPERATIONAL.md)** | ✅ **Système opérationnel - Guide d'utilisation Login/Signup** |
| **[QUICK_START.md](QUICK_START.md)** | 🚀 Guide de démarrage en 5 minutes |
| **[ARCHITECTURE_COMPLETE.md](ARCHITECTURE_COMPLETE.md)** | 📐 Architecture technique détaillée |
| **[INTEGRATION_SUMMARY.md](INTEGRATION_SUMMARY.md)** | 📋 Résumé de l'intégration des 36 briques |
| **[VERIFICATION_ROUTES.md](VERIFICATION_ROUTES.md)** | 🧪 Guide de test de toutes les routes API |
| **[brique-34-sessions-monitoring/README.md](brique-34-sessions-monitoring/README.md)** | 🔍 Monitoring avancé des sessions |

## Architecture

```
┌──────────────────────────────────────────────┐
│         CLIENTS (Mobile/Web/API)             │
└────────────────┬─────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────┐
│      API GATEWAY (Port 3000)                   │
│  - Routing vers 34 briques                     │
│  - Rate limiting, Security                     │
└────────────────┬───────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌─────────┐  ┌─────────┐  ┌──────────┐
│Auth(6-11)│  │RBAC     │  │Admin     │
│         │  │(12-23)  │  │(33-34)   │
└─────────┘  └─────────┘  └──────────┘
    │            │            │
    └────────────┼────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌──────────┐ ┌────────┐ ┌────────┐
│PostgreSQL│ │ Redis  │ │ Kafka  │
└──────────┘ └────────┘ └────────┘
```

## 36 Briques Disponibles

### Core Identity (1-5)
- Signup/Login, Sessions, JWT, Onboarding, Login v2

### Authentication & Security (6-11)
- Password Reset, Biometrics, Voice Auth, Geo, Device Fingerprint, MFA/2FA

### Delegation & Control (12-15)
- Delegation, Blacklist, Audit Logs, i18n

### Data & Profile (16-19)
- FX/Multicurrency, User Profile, Update Profile, Export Profile

### RBAC & Authorization (20-23)
- RBAC Granular, Role Management, Admin ID, Sessions Monitoring

### Frontend & SDK (24-32)
- SDK Auth, UI ID, Admin UI, i18n Frontend, Multicurrency UI, User Profile UI, Export UI, RBAC Frontend, API Role Mgmt

### Admin & Advanced (33-34)
- **API Admin** (Port 3033)
- **Advanced Sessions Monitoring** (Port 3034) - Avec détection d'anomalies

### SDK & Client Libraries (35)
- **SDK Auth** - Multi-plateforme (Web/Node, iOS, Android, HarmonyOS)

### UI & Interface (36) - ✅ OPERATIONAL
- **UI ID Web** (Port 5173) - Interface web PWA avec login/signup
- **UI ID Mobile** - React Native (iOS/Android/HarmonyOS)
- **UI ID Desktop** - Electron (Windows/macOS/Linux)

## Points d'Accès

| Service | URL | Description |
|---------|-----|-------------|
| **Web UI** | http://localhost:5173 | ✅ **Interface utilisateur - Login/Signup** |
| API Gateway | http://localhost:3000 | Point d'entrée unifié |
| Health Check | http://localhost:3000/healthz | Santé du système |
| Services Status | http://localhost:3000/status | État de toutes les briques |
| Prometheus | http://localhost:9090 | Métriques |
| Grafana | http://localhost:3100 | Dashboards (admin/admin) |
| PostgreSQL | localhost:5432 | Base de données (molam/molam_pass) |
| Redis | localhost:6379 | Cache |

## Exemples d'Utilisation

### Créer un Utilisateur
```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@molam.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Se Connecter
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@molam.com", "password": "SecurePass123!"}'
```

### Monitoring des Sessions (Brique 34)
```bash
# Lister mes sessions actives
curl -X GET http://localhost:3000/api/id/sessions/me \
  -H "Authorization: Bearer <jwt-token>"
```

## Fichiers d'Orchestration

- **[docker-compose.orchestration.yml](docker-compose.orchestration.yml)** - Orchestration complète des 34 briques
- **[.env.orchestration](.env.orchestration)** - Variables d'environnement
- **[gateway/](gateway/)** - API Gateway unifiée
- **[start-all.sh](start-all.sh)** / **[start-all.bat](start-all.bat)** - Scripts de démarrage
- **[test-integration.sh](test-integration.sh)** - Tests d'intégration

## Observabilité

### Métriques Prometheus
```promql
# Sessions actives
id_sessions_active

# Anomalies détectées
id_anomalies_detected_total

# Requêtes HTTP
http_requests_total
```

### Logs
```bash
# Tous les logs
docker-compose -f docker-compose.orchestration.yml logs -f

# Service spécifique
docker-compose -f docker-compose.orchestration.yml logs -f id-sessions-advanced
```

## Développement

### Structure du Projet
```
Molam-id/
├── brique-06-password-reset/      # Briques individuelles
├── brique-07-biometrics/
├── ...
├── brique-34-sessions-monitoring/ # Dernière brique ajoutée
├── gateway/                       # API Gateway
├── infra/                         # Prometheus, Grafana configs
│   ├── prometheus/
│   └── grafana/
├── sql/                           # Schémas SQL
├── src/                           # Core ID (briques 1-5)
├── docker-compose.orchestration.yml
├── start-all.sh
├── test-integration.sh
└── README.md (ce fichier)
```

### Développer une Brique
```bash
# Arrêter la brique dans Docker
docker-compose -f docker-compose.orchestration.yml stop <service-name>

# Lancer en mode développement
cd brique-XX-name/
npm install
npm run dev
```

## Tests

```bash
# Tests d'intégration complets
./test-integration.sh

# Tests d'une brique spécifique
cd brique-34-sessions-monitoring/
npm test
```

## Déploiement

### Development/Staging
```bash
./start-all.sh
```

### Production - Docker Swarm
```bash
docker swarm init
docker stack deploy -c docker-compose.orchestration.yml molam-id
```

### Production - Kubernetes
Voir `/infra/k8s/` (à créer)

## Sécurité

- ✅ JWT asymétrique (RS256)
- ✅ RBAC centralisé
- ✅ Audit trail immuable (WORM)
- ✅ Rate limiting
- ✅ CORS configuré
- ✅ Helmet security headers
- ✅ Détection d'anomalies (impossible travel, fingerprint mismatch)

## Conformité

- ✅ **RGPD**: Export de données (Brique 19), minimisation des données
- ✅ **Audit**: Logs immuables (Briques 14, 34)
- ✅ **Privacy**: Géolocalisation minimale (pays/ville)

## Support

- **Documentation**: Voir fichiers `.md` dans le projet
- **Issues**: Créer une issue sur le repo Git
- **Briques individuelles**: Voir `README.md` de chaque brique

## Prochaines Étapes

1. Lire [QUICK_START.md](QUICK_START.md)
2. Explorer [ARCHITECTURE_COMPLETE.md](ARCHITECTURE_COMPLETE.md)
3. Démarrer le système avec `./start-all.sh`
4. Tester avec `./test-integration.sh`
5. Déployer en production

## Licence

Propriétaire - Molam © 2025
