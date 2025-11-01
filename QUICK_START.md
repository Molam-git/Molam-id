# Guide de Démarrage Rapide - Molam-ID

## Introduction

Ce guide vous permettra de démarrer rapidement l'ensemble de l'écosystème Molam-ID (36 briques) en local ou en production.

## Prérequis

### Obligatoire
- Docker 20.10+
- Docker Compose 2.0+
- 8 GB RAM minimum (16 GB recommandé)
- 20 GB d'espace disque

### Optionnel
- Node.js 20+ (pour développement local)
- PostgreSQL client (psql)
- curl ou Postman (pour tester les APIs)

## Installation en 5 minutes

### 1. Cloner le projet

```bash
cd /path/to/your/projects
git clone <your-molam-id-repo>
cd Molam-id
```

### 2. Configurer l'environnement

```bash
# Copier le fichier d'environnement
cp .env.orchestration.example .env.orchestration

# Éditer avec vos valeurs (optionnel pour démarrage rapide)
# Les valeurs par défaut fonctionnent en local
nano .env.orchestration
```

### 3. Démarrer tous les services

**Sur Linux/Mac:**
```bash
chmod +x start-all.sh
./start-all.sh
```

**Sur Windows:**
```bash
start-all.bat
```

Le script va:
1. ✅ Vérifier les prérequis (Docker)
2. ✅ Arrêter les conteneurs existants
3. ✅ Construire les images Docker
4. ✅ Démarrer l'infrastructure (PostgreSQL, Redis, Kafka)
5. ✅ Initialiser la base de données
6. ✅ Démarrer toutes les briques
7. ✅ Vérifier la santé des services

**Temps estimé**: 5-10 minutes (première fois), 1-2 minutes ensuite

### 4. Vérifier le déploiement

```bash
# Tester les services
./test-integration.sh

# Ou manuellement
curl http://localhost:3000/healthz
curl http://localhost:3000/status
```

## Accès aux Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **API Gateway** | http://localhost:3000 | - |
| **Core ID API** | http://localhost:3001 | - |
| **Prometheus** | http://localhost:9090 | - |
| **Grafana** | http://localhost:3100 | admin / admin |
| **PostgreSQL** | localhost:5432 | molam / molam_pass |
| **Redis** | localhost:6379 | - |

## Premiers Tests

### Test 1: Health Check Global

```bash
curl http://localhost:3000/healthz
# Réponse: {"status":"healthy"}

curl http://localhost:3000/status
# Réponse: État de tous les services
```

### Test 2: Créer un Utilisateur

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@molam.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User",
    "phone": "+22379123456"
  }'
```

### Test 3: Se Connecter

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@molam.com",
    "password": "SecurePass123!"
  }'

# Réponse:
# {
#   "accessToken": "eyJhbGc...",
#   "refreshToken": "eyJhbGc...",
#   "user": { ... }
# }
```

### Test 4: Tester une Brique Spécifique

**Brique 34 - Sessions Monitoring:**
```bash
# Lister mes sessions (nécessite un JWT)
curl -X GET http://localhost:3000/api/id/sessions/me \
  -H "Authorization: Bearer <votre-jwt>"

# Heartbeat
curl -X POST http://localhost:3000/api/id/sessions/heartbeat \
  -H "Authorization: Bearer <votre-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "<session-id>"}'
```

**Brique 10 - Device Fingerprinting:**
```bash
# Enregistrer un device
curl -X POST http://localhost:3000/v1/device/register \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "web",
    "fingerprint": {"userAgent": "...", "screenResolution": "1920x1080"}
  }'
```

**Brique 9 - Géolocalisation:**
```bash
# Obtenir les infos géographiques
curl -X GET http://localhost:3000/v1/geo/lookup?ip=8.8.8.8
```

## Structure des Routes API

Toutes les routes passent par l'API Gateway (port 3000):

```
http://localhost:3000
├── /api/signup                         # Core: Inscription
├── /api/login                          # Core: Connexion
├── /api/refresh                        # Core: Refresh token
├── /api/logout                         # Core: Déconnexion
├── /v1/password/*                      # Brique 6: Reset password
├── /v1/biometric/*                     # Brique 7: Biométrie
├── /v1/voice/*                         # Brique 8: Voice auth
├── /v1/geo/*                           # Brique 9: Géolocalisation
├── /v1/device/*                        # Brique 10: Device fingerprint
├── /api/mfa/*                          # Brique 11: MFA/2FA
├── /v1/delegations/*                   # Brique 12: Délégation
├── /v1/blacklist/*                     # Brique 13: Blacklist
├── /v1/audit/*                         # Brique 14: Audit
├── /v1/i18n/*                          # Brique 15: i18n
├── /v1/fx/*                            # Brique 16: Devises
├── /v1/profile/*                       # Brique 17: Profil
├── /v1/update-profile/*                # Brique 18: Update profil
├── /v1/export-profile/*                # Brique 19: Export profil
├── /v1/rbac/*                          # Brique 20: RBAC
├── /v1/roles/*                         # Brique 21: Gestion rôles
├── /v1/admin-id/*                      # Brique 22: Admin ID
├── /v1/sessions/*                      # Brique 23: Sessions (basic)
├── /v1/admin/*                         # Brique 33: Admin API
├── /api/id/sessions/*                  # Brique 34: Sessions (advanced)
└── /api/id/admin/sessions/*            # Brique 34: Admin sessions
```

## Monitoring & Observabilité

### Prometheus

Accéder à Prometheus: http://localhost:9090

**Requêtes utiles:**
```promql
# Nombre de sessions actives
id_sessions_active

# Taux de heartbeat
rate(id_sessions_heartbeat_rate[5m])

# Anomalies détectées
id_anomalies_detected_total

# HTTP requests
http_requests_total
```

### Grafana

Accéder à Grafana: http://localhost:3100

**Identifiants par défaut**: `admin` / `admin`

Dashboards disponibles:
- Vue d'ensemble système
- Métriques par brique
- Sessions actives
- Anomalies détectées

### Logs

**Voir tous les logs:**
```bash
docker-compose -f docker-compose.orchestration.yml logs -f
```

**Logs d'un service spécifique:**
```bash
docker-compose -f docker-compose.orchestration.yml logs -f id-sessions-advanced
docker-compose -f docker-compose.orchestration.yml logs -f molam-api-gateway
```

**Filtrer les logs:**
```bash
# Erreurs uniquement
docker-compose -f docker-compose.orchestration.yml logs -f | grep ERROR

# Logs d'une session spécifique
docker-compose -f docker-compose.orchestration.yml logs -f | grep "session_id:abc-123"
```

## Base de Données

### Se connecter à PostgreSQL

```bash
# Via Docker
docker exec -it molam-postgres psql -U molam

# Ou localement si psql installé
psql -h localhost -U molam -d molam
```

### Requêtes utiles

```sql
-- Lister tous les utilisateurs
SELECT id, email, created_at FROM molam_users;

-- Voir les sessions actives
SELECT
  s.id,
  u.email,
  s.channel,
  s.created_at,
  s.last_seen_at
FROM molam_sessions s
JOIN molam_users u ON s.user_id = u.id
WHERE s.is_active = TRUE;

-- Voir les anomalies détectées
SELECT
  a.detected_at,
  a.kind,
  a.severity,
  u.email
FROM molam_session_anomalies a
JOIN molam_sessions s ON a.session_id = s.id
JOIN molam_users u ON s.user_id = u.id
ORDER BY a.detected_at DESC
LIMIT 10;

-- Statistiques par canal
SELECT
  channel,
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE is_active = TRUE) as active_sessions
FROM molam_sessions
GROUP BY channel;
```

## Arrêter les Services

### Arrêt propre (conserve les données)
```bash
docker-compose -f docker-compose.orchestration.yml down
```

### Arrêt complet (supprime les volumes)
```bash
docker-compose -f docker-compose.orchestration.yml down -v
```

### Redémarrer un service spécifique
```bash
docker-compose -f docker-compose.orchestration.yml restart id-sessions-advanced
```

## Configuration Avancée

### Variables d'environnement importantes

**Modifier `.env.orchestration`:**

```env
# JWT Configuration
JWT_SECRET=your-production-secret-here
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

# Database (Production)
DATABASE_URL=postgresql://user:pass@prod-db:5432/molam

# Redis (Production)
REDIS_URL=redis://prod-redis:6379

# AWS Services
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1

# External Services
MAXMIND_LICENSE_KEY=your-maxmind-key
SIRA_URL=http://sira-prod:8080
```

### Scaling Services

**Avec Docker Compose:**
```bash
# Scaler un service à 3 instances
docker-compose -f docker-compose.orchestration.yml up -d --scale id-sessions-advanced=3

# Vérifier
docker-compose -f docker-compose.orchestration.yml ps
```

## Troubleshooting

### Problème: Services ne démarrent pas

```bash
# Vérifier les logs
docker-compose -f docker-compose.orchestration.yml logs

# Vérifier l'utilisation des ressources
docker stats

# Redémarrer proprement
docker-compose -f docker-compose.orchestration.yml down
docker system prune -a  # Attention: supprime tout!
./start-all.sh
```

### Problème: PostgreSQL ne répond pas

```bash
# Vérifier le statut
docker exec molam-postgres pg_isready -U molam

# Voir les logs PostgreSQL
docker logs molam-postgres

# Redémarrer PostgreSQL
docker-compose -f docker-compose.orchestration.yml restart postgres
```

### Problème: "Port already in use"

```bash
# Trouver quel processus utilise le port
# Linux/Mac
lsof -i :3000

# Windows
netstat -ano | findstr :3000

# Arrêter le processus ou changer le port dans docker-compose.orchestration.yml
```

### Problème: Tests d'intégration échouent

```bash
# Attendre plus longtemps pour que les services démarrent
sleep 30

# Relancer les tests
./test-integration.sh

# Tester manuellement chaque service
for port in 3000 3001 8080 8081 8083 8084 8085 3009 3012 3013 3014 3015 3016 3017 3018 3019 3020 3021 3022 3023 3033 3034; do
  echo "Testing port $port..."
  curl -sf http://localhost:$port/health || curl -sf http://localhost:$port/healthz
done
```

## Développement Local

### Développer une brique spécifique

```bash
# Arrêter la brique dans Docker
docker-compose -f docker-compose.orchestration.yml stop id-sessions-advanced

# Lancer en mode dev localement
cd brique-34-sessions-monitoring
npm install
npm run dev

# Le service sera accessible sur son port (3034)
```

### Hot reload

La plupart des briques TypeScript utilisent `tsx watch` pour le hot reload:

```bash
cd brique-34-sessions-monitoring
npm run dev  # Auto-reload sur changement de fichier
```

## Prochaines Étapes

1. 📖 Lire [ARCHITECTURE_COMPLETE.md](ARCHITECTURE_COMPLETE.md) pour comprendre l'architecture
2. 🔍 Explorer chaque brique dans son dossier (voir README.md de chaque brique)
3. 🧪 Écrire des tests pour vos cas d'usage spécifiques
4. 🚀 Déployer en staging/production (voir section suivante)

## Déploiement Production

### Option 1: Docker Swarm

```bash
# Initialiser Swarm
docker swarm init

# Déployer la stack
docker stack deploy -c docker-compose.orchestration.yml molam-id

# Vérifier
docker stack services molam-id
```

### Option 2: Kubernetes

Voir `/infra/k8s/` pour les manifests Kubernetes (à créer).

### Option 3: Cloud (AWS/GCP/Azure)

Voir `/infra/terraform/` pour l'infrastructure as code (à créer).

## Support

- **Documentation**: Voir `/docs`
- **Issues**: Créer une issue sur le repo Git
- **Email**: support@molam.com

---

**Bon démarrage avec Molam-ID ! 🚀**
