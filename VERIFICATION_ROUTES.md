# Guide de Vérification des Routes - Molam-ID

## Installation des dépendances

```bash
# Installer les nouvelles dépendances
npm install

# Ou utiliser npm ci pour une installation propre
npm ci
```

## Démarrage du serveur

```bash
# Mode développement avec hot-reload
npm run dev

# Mode production
npm start
```

Le serveur démarrera sur le port **3001** (ou 3000 si PORT n'est pas défini).

## Routes disponibles

### 🏥 Health Checks

```bash
# Root endpoint (info service)
curl http://localhost:3001/

# Health check legacy
curl http://localhost:3001/api/health

# Kubernetes-style health checks
curl http://localhost:3001/healthz
curl http://localhost:3001/livez
curl http://localhost:3001/readyz

# Métriques Prometheus
curl http://localhost:3001/metrics
```

### 🔐 Authentication (Legacy - Briques 1-3)

```bash
# Inscription
curl -X POST http://localhost:3001/api/signup \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+221771234567", "password": "Test1234!"}'

# Connexion
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+221771234567", "password": "Test1234!"}'

# Refresh token
curl -X POST http://localhost:3001/api/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "YOUR_REFRESH_TOKEN"}'

# Logout
curl -X POST http://localhost:3001/api/logout \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "YOUR_REFRESH_TOKEN"}'
```

### 📱 Onboarding Multi-canal (Brique 4)

```bash
# Étape 1: Initialiser l'inscription
curl -X POST http://localhost:3001/api/id/signup/init \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+221771234567",
    "channel": "mobile",
    "device_info": {
      "platform": "Android",
      "model": "Samsung Galaxy S21"
    }
  }'

# Étape 2: Vérifier l'OTP
curl -X POST http://localhost:3001/api/id/signup/verify \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+221771234567",
    "otp_code": "123456"
  }'

# Étape 3: Compléter l'inscription
curl -X POST http://localhost:3001/api/id/signup/complete \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+221771234567",
    "password": "Test1234!",
    "profile": {
      "given_name": "Amadou",
      "family_name": "Diallo"
    }
  }'
```

### 🔑 Authentication V2 (Brique 5)

```bash
# Login V2 (deux routes, même comportement)
curl -X POST http://localhost:3001/api/id/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "+221771234567",
    "password": "Test1234!",
    "device": {
      "fingerprint": "abc123",
      "type": "mobile"
    }
  }'

# Ou via l'alias SDK
curl -X POST http://localhost:3001/api/id/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "+221771234567",
    "password": "Test1234!"
  }'

# Refresh token V2
curl -X POST http://localhost:3001/api/id/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "YOUR_REFRESH_TOKEN"}'

# Logout V2 (requiert authentification)
curl -X POST http://localhost:3001/api/id/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

### 📊 Session Management (Brique 5)

```bash
# Lister mes sessions actives
curl -X GET http://localhost:3001/api/id/sessions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Révoquer une session spécifique
curl -X POST http://localhost:3001/api/id/sessions/SESSION_ID/revoke \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Révoquer toutes les sessions (sauf l'actuelle)
curl -X POST http://localhost:3001/api/id/sessions/revoke-all \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 🔒 Authorization & RBAC (Brique 6)

```bash
# Décision d'autorisation
curl -X POST http://localhost:3001/v1/authz/decide \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER_ID",
    "resource": "payments",
    "action": "create",
    "context": {}
  }'

# Récupérer les rôles d'un utilisateur
curl -X GET http://localhost:3001/v1/authz/users/USER_ID/roles \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Récupérer les permissions d'un utilisateur
curl -X GET http://localhost:3001/v1/authz/users/USER_ID/permissions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Assigner un rôle (requiert rôle admin)
curl -X POST http://localhost:3001/v1/authz/users/USER_ID/roles \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role_name": "merchant"}'

# Révoquer un rôle (requiert rôle admin)
curl -X DELETE http://localhost:3001/v1/authz/users/USER_ID/roles/merchant \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

## Test rapide avec le script de tests

```bash
# Tester toutes les briques
npm test

# Tester une brique spécifique
npm run test:brique1
npm run test:brique2
npm run test:brique3
npm run test:brique4
npm run test:brique5
npm run test:brique6
```

## Vérification du serveur au démarrage

Lorsque vous démarrez le serveur avec `npm start` ou `npm run dev`, vous devriez voir:

```
================================================================================
🚀 MOLAM-ID CORE SERVER
================================================================================
📡 Server listening on port 3001
🌍 Environment: development
📦 Briques: 1 (Auth), 2 (Sessions), 3 (JWT), 4 (Onboarding), 5 (LoginV2), 6 (AuthZ)
⏰ Started at: 2025-01-31T...
================================================================================

📋 Available endpoints:
  GET  /                         - Service info
  GET  /api/health               - Health check (legacy)
  GET  /healthz                  - Health check (K8s)
  GET  /livez                    - Liveness probe
  GET  /readyz                   - Readiness probe
  GET  /metrics                  - Prometheus metrics

🔐 Authentication (Legacy):
  POST /api/signup               - Signup (legacy)
  POST /api/login                - Login (legacy)
  POST /api/refresh              - Refresh token (legacy)
  POST /api/logout               - Logout (legacy)

📱 Onboarding (Multi-canal):
  POST /api/id/signup/init       - Initialize signup
  POST /api/id/signup/verify     - Verify OTP
  POST /api/id/signup/complete   - Complete signup

🔑 Authentication V2:
  POST /api/id/login             - Login V2
  POST /api/id/auth/login        - Login V2 (SDK alias)
  POST /api/id/refresh           - Refresh token
  POST /api/id/auth/refresh      - Refresh token (SDK alias)
  POST /api/id/logout            - Logout

📊 Session Management:
  GET  /api/id/sessions          - List my sessions
  POST /api/id/sessions/:id/revoke - Revoke one session
  POST /api/id/sessions/revoke-all - Revoke all sessions

🔒 Authorization & RBAC:
  POST /v1/authz/decide          - Authorization decision
  GET  /v1/authz/users/:userId/roles - Get user roles
  GET  /v1/authz/users/:userId/permissions - Get user permissions
  POST /v1/authz/users/:userId/roles - Assign role (admin)
  DEL  /v1/authz/users/:userId/roles/:role - Revoke role (admin)
================================================================================
```

## Troubleshooting

### Le serveur ne démarre pas

```bash
# Vérifier que les dépendances sont installées
npm install

# Vérifier que le port n'est pas déjà utilisé
netstat -ano | findstr :3001  # Windows
lsof -i :3001                 # Linux/Mac

# Vérifier les variables d'environnement
cat .env
```

### Erreur 404 sur une route

- Vérifiez que la route existe bien dans la liste ci-dessus
- Vérifiez l'orthographe et la casse (sensible)
- Vérifiez la méthode HTTP (GET, POST, etc.)

### Erreur 401 Unauthorized

- La route nécessite authentification
- Ajoutez le header `Authorization: Bearer YOUR_ACCESS_TOKEN`
- Vérifiez que votre token est valide et non expiré

### Erreur 403 Forbidden

- Vous n'avez pas les permissions nécessaires
- Certaines routes requièrent le rôle `id_admin`

## Intégration avec l'API Gateway

Lorsque le serveur est derrière l'API Gateway (port 3000):

```bash
# Au lieu de http://localhost:3001/api/...
# Utilisez http://localhost:3000/api/...

curl http://localhost:3000/api/health
curl http://localhost:3000/api/id/login
```

L'API Gateway se charge du routing vers le bon service.

## Logs

Les logs affichent pour chaque requête:
- Timestamp ISO
- Méthode HTTP
- Path
- Status code
- Durée (ms)
- Request ID (pour le tracing)

Exemple:
```
[2025-01-31T10:30:45.123Z] POST /api/id/login - 200 (142ms) [req-1738324245123-abc123]
```

## Métriques Prometheus

Le endpoint `/metrics` expose:
- `molam_id_core_up`: Service is up (1 = up, 0 = down)
- `molam_id_core_uptime_seconds`: Service uptime in seconds

Ces métriques peuvent être scrapées par Prometheus pour monitoring.
