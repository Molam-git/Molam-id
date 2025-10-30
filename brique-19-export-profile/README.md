# Brique 19: Export Profile (GDPR, JSON/PDF)

API pour exporter les données utilisateur Molam ID en conformité GDPR (droit d'accès et de portabilité).

## Objectifs

- Export complet et signé des données Molam ID : profil, préférences, contacts, sessions actives, événements
- Formats : JSON (machine-readable) + PDF (human-readable avec i18n)
- Sécurité : signatures, horodatage, liens signés à durée courte (15 min), quotas, rate-limits
- Gouvernance : logs d'audit, webhooks, respect du périmètre Molam ID uniquement (pas de docs KYC des filiales)
- Internationalisation : PDF en langue préférée (fr, en, ar, wo, pt, es)
- Conformité GDPR : droit d'accès et de portabilité

## Architecture

```
brique-19-export-profile/
├── sql/
│   └── 019_export_profile.sql          # Schema exports + views
├── src/
│   ├── util/
│   │   ├── pg.ts                       # PostgreSQL connection
│   │   ├── storage.ts                  # S3/MinIO client
│   │   ├── auth.ts                     # JWT middleware
│   │   ├── events.ts                   # Domain events
│   │   ├── i18n.ts                     # Translations
│   │   ├── pdf.ts                      # PDF renderer
│   │   └── time.ts                     # Time utilities
│   ├── routes/
│   │   └── export.ts                   # Export API routes
│   ├── workers/
│   │   └── exportWorker.ts             # Background worker
│   └── server.ts                       # Main server
├── tests/
│   └── export.test.ts                  # Tests
├── k8s/
│   └── deployment.yaml                 # Kubernetes deployment
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## API Endpoints

### POST /v1/profile/export

Créer une job d'export (asynchrone).

**Authentication:** Required (JWT Bearer token)

**Scopes:**
- `id:export:self` - Export pour soi-même
- `id:export:any` - Admin peut exporter pour n'importe quel utilisateur

**Request Body:**
```json
{
  "user_id": "uuid (optional, admin only)",
  "locale": "fr (optional, defaults to user's preferred language)"
}
```

**Response (202 Accepted):**
```json
{
  "export_id": "uuid",
  "status": "queued",
  "message": "Export job created. You will be notified when ready."
}
```

**Rate Limit:** 1 export per 24 hours per user

### GET /v1/profile/export/:id

Récupérer le statut de l'export et les liens signés.

**Authentication:** Required (JWT Bearer token)

**Response (200 OK):**
```json
{
  "export_id": "uuid",
  "user_id": "uuid",
  "status": "ready",
  "locale": "fr",
  "json_url": "https://s3.amazonaws.com/bucket/exports/user/export.json?signature=...",
  "pdf_url": "https://s3.amazonaws.com/bucket/exports/user/export.pdf?signature=...",
  "expires_at": "2025-01-28T12:00:00Z",
  "created_at": "2025-01-28T11:30:00Z",
  "updated_at": "2025-01-28T11:35:00Z"
}
```

**Status Values:**
- `queued` - En file d'attente
- `processing` - En cours de génération
- `ready` - Prêt, liens disponibles
- `failed` - Échec (voir champ `error`)

## Flux de Traitement

1. **User/Admin Request:** POST /v1/profile/export
2. **API:** Crée job avec status `queued`, émet événement `id.export.queued`
3. **Worker:**
   - Récupère job
   - Change status à `processing`
   - Fetch data depuis vues SQL
   - Génère JSON
   - Génère PDF avec i18n
   - Upload vers S3/MinIO
   - Génère URLs signées (15 min)
   - Change status à `ready`
   - Émet événement `id.export.ready`
4. **Notification:** Webhook + Email/In-App (optionnel)
5. **User:** GET /v1/profile/export/:id pour récupérer liens
6. **Download:** User télécharge JSON/PDF avant expiration

## Données Exportées

### 1. Profile (from v_export_user_profile)
- Molam ID, email, phone
- Nom complet
- Préférences : langue, devise, timezone, formats
- Thème, notifications
- Dates de création et mise à jour

### 2. Contacts (from v_export_user_contacts)
- Contacts favoris (P2P, marchands, agents)
- Nom affiché, type de canal, valeur normalisée
- Pays, métadonnées
- Dates d'ajout

### 3. Events (from v_export_id_events)
- Derniers 1000 événements ID
- Actions : profile.*, contacts.*, id.*
- Timestamps, adresses IP
- Types de ressources

### 4. Sessions (from v_export_user_sessions)
- Sessions actives uniquement
- Appareil, adresse IP, User-Agent
- Dates de démarrage, dernière activité, expiration

**Note:** Les documents KYC, transactions, historiques de paiement appartiennent aux filiales (Pay, Connect, Eats) et ne sont PAS inclus dans cet export Molam ID.

## PDF Features

### Internationalisation
- Supporte 6 langues : fr, en, ar, wo, pt, es
- RTL support pour arabe (ar)
- Utilise la langue préférée de l'utilisateur par défaut

### Contenu
- En-tête : Titre, sous-titre GDPR, métadonnées d'export
- Section 1 : Profil utilisateur
- Section 2 : Contacts favoris (jusqu'à 100)
- Section 3 : Événements récents (jusqu'à 50)
- Section 4 : Sessions actives
- Pied de page : Numéro de page, mention GDPR

## Storage (S3/MinIO)

### Configuration
- Endpoint configurable (AWS S3 ou MinIO local)
- Buckets : `molam-exports`
- Keys : `exports/{user_id}/{export_id}.{json|pdf}`

### Signed URLs
- Expiration : 15 minutes par défaut
- Algorithme : S3 Presigned URLs (AWS Signature V4)
- Régénération automatique si URLs expirées

### Sécurité
- Aucun fichier public
- Tous les liens sont signés
- Cleanup automatique après 30 jours

## Background Worker

### Polling
- Intervalle : 10 secondes
- Limite : 10 exports par batch

### Processing
1. Lock job avec `FOR UPDATE`
2. Change status à `processing`
3. Fetch data depuis vues SQL
4. Génère JSON (Buffer)
5. Génère PDF avec PDFKit
6. Upload vers S3/MinIO
7. Génère signed URLs
8. Update job avec status `ready`
9. Audit log + Webhook

### Error Handling
- Status `failed` en cas d'erreur
- Message d'erreur stocké dans colonne `error`
- Audit log de l'échec
- Pas de retry automatique (user doit créer nouvelle job)

## RBAC & Scopes

### External Users
- Scope : `id:export:self`
- Peut uniquement exporter ses propres données

### Super Admin
- Scope : `id:export:any`
- Peut exporter pour n'importe quel utilisateur

### Subsidiary Admin
- Scope : `id:export:subsidiary:{SUBSIDIARY}`
- Lecture restreinte aux attributs ID uniquement (pas les docs filiales)

### Auditor
- Scope : `id:export:any`
- Doit fournir justification (stockée dans audit logs)

## Rate Limiting

### Default Policy
- 1 export par utilisateur toutes les 24 heures
- Fonction SQL : `can_request_export(user_id)`
- HTTP 429 (Too Many Requests) si limite atteinte

### Override
- Admin avec scope `id:export:any` n'est PAS limité
- Configurable via feature flags (TODO)

## Observability

### Metrics (Prometheus)
- `id_export_requests_total{scope}` - Nombre de demandes d'export
- `id_export_ready_total` - Exports réussis
- `id_export_failed_total` - Exports échoués
- `id_export_latency_ms` - Latence queue→ready

### Logs (Structured JSON)
```json
{
  "level": "info",
  "message": "Export job completed",
  "export_id": "uuid",
  "user_id": "uuid",
  "duration_ms": 1234
}
```

### Alerts
- Échecs > 2% sur 10 minutes
- Worker down (pas de processing depuis 5 min)
- S3/MinIO inaccessible

## Installation

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
psql -U molam -d molam_id -f sql/019_export_profile.sql

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

### Kubernetes
```bash
# Build Docker image
docker build -t molam/id-export-profile:latest .

# Deploy to Kubernetes
kubectl apply -f k8s/deployment.yaml
```

### Environment Variables
See `.env.example` for all required variables.

## Sécurité

### GDPR Compliance
- ✅ Droit d'accès (Article 15)
- ✅ Droit à la portabilité (Article 20)
- ✅ Transparence des données collectées
- ✅ Limitation au périmètre Molam ID uniquement
- ✅ Audit trail complet

### Data Protection
- ✅ Signed URLs avec expiration courte
- ✅ HMAC webhooks
- ✅ Audit logs de toutes les demandes
- ✅ Rate limiting anti-abuse
- ✅ JWT RS256 authentication
- ✅ Aucune donnée sensible module (KYC des filiales)

## Webhooks

### Event: id.export.ready

**Payload:**
```json
{
  "type": "id.export.ready",
  "timestamp": 1704000000000,
  "payload": {
    "export_id": "uuid",
    "user_id": "uuid",
    "json_url": "https://...",
    "pdf_url": "https://...",
    "expires_at": "2025-01-28T12:00:00Z"
  }
}
```

**Signature:** HMAC-SHA256 dans header `X-Molam-Signature`

## Cleanup

### Automatic Cleanup
- Fonction SQL : `cleanup_old_exports()`
- Retention : 30 jours
- Exécution : Cron job quotidien (à configurer)

```bash
# Cron job example (daily at 2 AM)
0 2 * * * psql -U molam -d molam_id -c "SELECT cleanup_old_exports();"
```

## License

UNLICENSED - Propriété de Molam
