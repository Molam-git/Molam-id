# Brique 18: API Update Profile

API pour mettre à jour le profil utilisateur (langue, devise, contacts favoris).

## Objectifs

- Mise à jour des préférences : langue (Brique 15), devise (Brique 16), timezone, format de date, thème, notifications
- Gestion des contacts favoris pour P2P, marchands, agents
- Normalisation E.164 pour les téléphones, déduplication
- RBAC : utilisateurs externes = self-update uniquement ; employés = droits modulaires par filiale
- Audit trail via `molam_audit_logs`
- Emission d'événements (profile.updated, contacts.updated) vers Kafka/NATS ou webhooks signés
- Observabilité : métriques Prometheus, logs structurés, rate limits

## Architecture

```
brique-18-update-profile/
├── sql/
│   ├── 018_update_profile.sql           # Schema preferences + contacts
│   └── hotfix_signup_login_required.sql # Contraintes signup/login
├── src/
│   ├── util/
│   │   ├── pg.ts                        # PostgreSQL connection
│   │   ├── redis.ts                     # Redis cache
│   │   ├── auth.ts                      # JWT middleware
│   │   ├── rbac.ts                      # RBAC utilities
│   │   ├── phone.ts                     # Phone normalization (E.164)
│   │   ├── events.ts                    # Domain events
│   │   └── errors.ts                    # Error handling
│   ├── routes/
│   │   ├── prefs.ts                     # Preferences routes
│   │   └── contacts.ts                  # Contacts routes
│   └── server.ts                        # Main server
├── tests/
│   ├── prefs.test.ts
│   ├── contacts.test.ts
│   └── hotfix.test.ts
├── k8s/
│   └── deployment.yaml                  # Kubernetes deployment
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## API Endpoints

### Preferences

#### GET /v1/profile/prefs
Lire les préférences utilisateur (self ou admin override).

**Query Parameters:**
- `user_id` (optional, admin only): UUID de l'utilisateur cible

**Response:**
```json
{
  "user_id": "uuid",
  "preferences": {
    "language": "en",
    "currency": "XOF",
    "timezone": "Africa/Dakar",
    "dateFormat": "YYYY-MM-DD",
    "numberFormat": "space",
    "notifications": {
      "email": true,
      "sms": false,
      "push": true
    },
    "theme": "system"
  }
}
```

#### PATCH /v1/profile/prefs
Mettre à jour les préférences (self-update).

**Request Body:**
```json
{
  "language": "fr",
  "currency": "EUR",
  "timezone": "Europe/Paris",
  "notifications": {
    "sms": true
  },
  "theme": "dark"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Preferences updated",
  "changes": ["language", "currency", "theme"]
}
```

#### PATCH /v1/admin/prefs
Mettre à jour les préférences (admin avec scope subsidiary).

**Query Parameters:**
- `user_id` (required): UUID de l'utilisateur cible

**Request Body:**
```json
{
  "language": "ar",
  "notifications": {
    "email": false
  }
}
```

### Contacts

#### GET /v1/profile/contacts
Lister les contacts favoris.

**Query Parameters:**
- `q` (optional): Recherche par nom ou valeur
- `limit` (optional, default=50, max=100): Nombre de résultats

**Response:**
```json
{
  "contacts": [
    {
      "id": "uuid",
      "displayName": "John Doe",
      "channelType": "phone",
      "channelValue": "+221771234567",
      "countryCode": "SEN",
      "contactUser": {
        "id": "uuid",
        "molamId": "@john",
        "firstName": "John",
        "lastName": "Doe"
      },
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 1
}
```

#### POST /v1/profile/contacts
Ajouter un contact favori.

**Request Body:**
```json
{
  "displayName": "Jane Doe",
  "channelType": "phone",
  "channelValue": "77 123 45 67",
  "countryCode": "SEN",
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "message": "Contact added",
  "contact": {
    "id": "uuid",
    "displayName": "Jane Doe",
    "channelType": "phone",
    "channelValue": "+221771234567",
    "countryCode": "SEN",
    "contactUserId": "uuid"
  }
}
```

#### DELETE /v1/profile/contacts/:id
Supprimer un contact favori.

**Response:**
```json
{
  "success": true,
  "message": "Contact deleted"
}
```

## Features

### Phone Normalization (E.164)
Utilise `libphonenumber-js` pour normaliser les numéros de téléphone au format international E.164.

**Exemples:**
- `77 123 45 67` (Sénégal) → `+221771234567`
- `+1-555-123-4567` (USA) → `+15551234567`
- `+33 6 12 34 56 78` (France) → `+33612345678`

### Contact Deduplication
Contrainte UNIQUE sur `(owner_user_id, channel_type, channel_value)` pour éviter les doublons.

### Contact Resolution
Auto-résolution de `contact_user_id` si le contact correspond à un utilisateur Molam :
- `molam_id` → recherche par `molam_users.molam_id`
- `phone` → recherche par `molam_users.phone_e164`
- `email` → recherche par `molam_users.email` (case-insensitive)

### RBAC

**Permissions:**
- `id:profile:update:any` : Mettre à jour n'importe quel profil (super admin)
- `id:profile:update:subsidiary:PAY` : Mettre à jour les profils de la filiale PAY
- `id:profile:update:subsidiary:EATS` : Mettre à jour les profils de la filiale EATS

**Règles:**
1. Utilisateurs externes : self-update uniquement
2. Admins avec `id:profile:update:any` : update anyone
3. Admins avec `id:profile:update:subsidiary:XXX` : update users in their subsidiary

### Events

**Types d'événements:**
- `profile.updated` : Préférences mises à jour
- `profile.language.changed` : Langue modifiée
- `profile.currency.changed` : Devise modifiée
- `contacts.added` : Contact ajouté
- `contacts.deleted` : Contact supprimé

**Format:**
```json
{
  "type": "profile.updated",
  "timestamp": 1704000000000,
  "payload": {
    "user_id": "uuid",
    "changes": {
      "preferred_language": {
        "old": "en",
        "new": "fr"
      }
    }
  },
  "metadata": {
    "source": "id-update-profile",
    "userId": "uuid",
    "requestId": "req_123"
  }
}
```

### Audit Trail
Toutes les mutations sont enregistrées dans `molam_audit_logs` :
- `profile.prefs.update` : Self-update
- `profile.prefs.admin_update` : Admin update
- `contact.add` : Contact ajouté
- `contact.delete` : Contact supprimé

## Hotfix: Signup/Login Requirements

### Contraintes
1. **Primary Identifier:** Au moins `email` OU `phone_e164` requis
2. **Password:** Obligatoire si `auth_mode = 'password'`

### Feature Flag
- `ENFORCE_IDENTITY_STRICT` : Activation graduelle (rollout_percentage)
- Contraintes créées avec `NOT VALID` pour éviter le blocage immédiat
- Valider après migration : `ALTER TABLE molam_users VALIDATE CONSTRAINT chk_user_primary_identifier`

### Migration Helper
```sql
-- Trouver les comptes non conformes
SELECT * FROM find_non_compliant_accounts();

-- Auto-fix (conservative)
SELECT * FROM auto_fix_accounts();
```

## Installation

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
psql -U molam -d molam_id -f sql/018_update_profile.sql
psql -U molam -d molam_id -f sql/hotfix_signup_login_required.sql

# Development
npm run dev

# Production
npm run build
npm start
```

## Testing

```bash
# Run tests
npm test

# Structure tests
npm run structure-test

# Watch mode
npm run test:watch
```

## Deployment

```bash
# Build Docker image
docker build -t molam/id-update-profile:latest .

# Deploy to Kubernetes
kubectl apply -f k8s/deployment.yaml
```

## Observability

### Metrics (Prometheus)
- `id_profile_update_total{field}` : Nombre de mises à jour par champ
- `id_contacts_add_total{channel_type}` : Nombre de contacts ajoutés par type
- `id_contacts_delete_total` : Nombre de contacts supprimés

### Logs (Structured JSON)
```json
{
  "level": "info",
  "message": "HTTP request",
  "method": "PATCH",
  "path": "/v1/profile/prefs",
  "user_id": "uuid",
  "request_id": "req_123"
}
```

## Sécurité

- **JWT Authentication** : RS256, audience/issuer validation
- **RBAC** : Subsidiary-scoped permissions
- **Rate Limiting** : Per IP and per user
- **Input Validation** : Zod schemas
- **Audit Logs** : Toutes les mutations
- **Signed Webhooks** : HMAC-SHA256

## Intégrations

- **Brique 15 (i18n)** : Langues supportées, fallback chains
- **Brique 16 (FX)** : Devises supportées, conversions
- **Brique 14 (Audit)** : Logs d'audit
- **Kafka/NATS** : Event bus pour synchronisation inter-modules

## License

UNLICENSED - Propriété de Molam
