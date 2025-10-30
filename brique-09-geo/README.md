# Brique 9 — Géolocalisation & Fuseaux horaires

Service de géolocalisation multi-pays avec support de la privacy by design pour Molam ID.

## Vue d'ensemble

Ce service fournit des capacités de géolocalisation, détection de pays, gestion des fuseaux horaires et routage USSD pour une expérience utilisateur optimisée dans plusieurs pays d'Afrique de l'Ouest.

### Fonctionnalités principales

- **Multi-pays**: Support de SN, CI, GH, NG, FR et extensible
- **Détection de pays**: Via IP (MaxMind), MCC/MNC SIM, ou numéro de téléphone
- **Privacy by design**: Geohash pour limiter la précision, opt-in GPS explicite
- **Détection de fraude**: Impossible travel, VPN/proxy, changement de pays suspect
- **USSD routing**: Webhooks pour intégration IVR multi-pays
- **Multi-currency**: XOF, GHS, NGN, EUR selon le pays
- **Timezone management**: Gestion automatique des fuseaux horaires
- **Données éphémères**: GPS stocké max 24h avec encryption

## Architecture

### Stack technique

- **Runtime**: Node.js 18+ / TypeScript 5.3
- **Framework**: Express.js
- **Database**: PostgreSQL (5 tables)
- **Cache**: Redis
- **Geolocation**: MaxMind GeoLite2 (City + ASN)
- **Encryption**: AWS KMS envelope encryption
- **Déploiement**: Kubernetes

### Tables SQL

1. **molam_user_geo_prefs**: Préférences utilisateur (opt-in GPS, précision, pays, devise, locale)
2. **molam_geo_last_context**: Dernier contexte géographique (pour fraude et routage)
3. **molam_geo_events**: Audit trail des événements géo (country mismatch, VPN, impossible travel)
4. **molam_gps_ephemeral**: Stockage éphémère GPS (max 24h, encrypted)
5. **molam_country_matrix**: Configuration multi-pays (devise, timezone, USSD, regex phone)

## Installation

### Prérequis

```bash
# Node.js 18+
node --version  # v18.0.0+

# PostgreSQL
psql --version  # 14+

# Redis
redis-cli --version  # 6+
```

### Setup

```bash
# Install dependencies
npm install

# Setup database
psql -U postgres -d molam_id -f sql/003_geo.sql
psql -U postgres -d molam_id -f sql/003_geo_seed.sql

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Download MaxMind databases (requires account)
# https://www.maxmind.com/en/geolite2/signup

# Build
npm run build

# Start
npm start

# Development mode
npm run dev
```

## API Endpoints

### Public endpoints (no auth required)

#### GET /v1/geo/countries

Liste tous les pays actifs.

**Response:**
```json
{
  "countries": [
    {
      "code": "SN",
      "name": "Sénégal",
      "currency": "XOF",
      "currencySymbol": "CFA",
      "timezone": "Africa/Dakar",
      "phonePrefix": "+221",
      "phoneExample": "+221 77 123 45 67",
      "locale": "fr_SN",
      "supportsUssd": true,
      "supportsMobileMoney": true
    }
  ]
}
```

#### GET /v1/geo/countries/:code

Détails d'un pays spécifique.

**Example:**
```bash
curl https://id.molam.com/v1/geo/countries/SN
```

#### POST /v1/geo/detect

Détecte le pays depuis téléphone, IP ou MCC/MNC.

**Request:**
```json
{
  "phone": "+221771234567",
  "ip": "41.82.1.1",
  "mcc": 608,
  "mnc": 1
}
```

**Response:**
```json
{
  "country": "SN",
  "detectionMethod": "phone",
  "countryData": { ... },
  "geoData": {
    "city": "Dakar",
    "region": "Dakar",
    "timezone": "Africa/Dakar",
    "isVpn": false,
    "isMobile": true
  }
}
```

### Protected endpoints (require JWT)

#### GET /v1/geo/prefs

Récupère les préférences géo de l'utilisateur.

**Headers:**
```
Authorization: Bearer <JWT>
```

**Response:**
```json
{
  "prefs": {
    "gpsOptIn": false,
    "precisionLevel": "city",
    "preferredCountry": "SN",
    "preferredCurrency": "XOF",
    "preferredLocale": "fr_SN",
    "preferredTimezone": "Africa/Dakar",
    "homeCountry": "SN"
  }
}
```

#### PUT /v1/geo/prefs

Met à jour les préférences géo.

**Request:**
```json
{
  "gpsOptIn": true,
  "precisionLevel": "precise",
  "preferredCountry": "SN",
  "preferredCurrency": "XOF",
  "preferredLocale": "fr_SN"
}
```

**Precision levels:**
- `country`: ~630km (geohash 2)
- `region`: ~78km (geohash 3)
- `city`: ~2.4km (geohash 5) — **default**
- `precise`: ~76m (geohash 7)

#### POST /v1/geo/context

Capture le contexte géographique de l'utilisateur.

**Request:**
```json
{
  "latitude": 14.6928,
  "longitude": -17.4467,
  "accuracy": 10,
  "mcc": 608,
  "mnc": 1,
  "carrier": "Orange SN"
}
```

**Response:**
```json
{
  "status": "ok",
  "context": {
    "country": "SN",
    "city": "Dakar",
    "timezone": "Africa/Dakar",
    "source": "gps"
  }
}
```

**Notes:**
- GPS coordinates ne sont stockées QUE si `gpsOptIn = true`
- Précision limitée selon `precisionLevel`
- Geohash utilisé pour privacy-preserving location
- Détection automatique de VPN/proxy
- Vérification d'impossible travel (>800 km/h)

#### GET /v1/geo/context

Récupère le dernier contexte géographique.

**Response:**
```json
{
  "context": {
    "source": "gps",
    "country": "SN",
    "region": "Dakar",
    "city": "Dakar",
    "geohash": "ed52jt",
    "timezone": "Africa/Dakar",
    "isVpn": false,
    "isMobile": true,
    "carrier": "Orange SN",
    "capturedAt": "2024-01-15T10:30:00Z"
  }
}
```

### USSD endpoints

#### POST /v1/ussd/webhook

Webhook pour intégration USSD (Africa's Talking, Twilio).

**Headers:**
```
X-USSD-Signature: sha256=...
```

**Request (Africa's Talking format):**
```json
{
  "sessionId": "ATUid_...",
  "serviceCode": "*131#",
  "phoneNumber": "+221771234567",
  "text": "1*2"
}
```

**Response (plain text):**
```
CON Mon compte
1. Vérifier mon identité
2. Voir mes infos
3. Changer mot de passe
0. Retour
```

**Menu structure:**
- `*131#`: Menu principal
- `*131*1#`: Mon compte
- `*131*2#`: Réinitialiser PIN
- `*131*3#`: Support
- `*131*4#`: Langue

## Privacy by design

### Principes

1. **Opt-in explicite**: GPS nécessite consentement utilisateur
2. **Précision limitée**: Geohash selon préférence (city par défaut)
3. **Données éphémères**: GPS max 24h, purge automatique
4. **Encryption at rest**: Coordonnées GPS encrypted via KMS
5. **Minimisation**: Seules données nécessaires collectées
6. **Transparence**: Audit trail complet dans `molam_geo_events`

### Geohash precision

| Level | Precision | Use case |
|-------|-----------|----------|
| 2 | ±630 km | Country detection |
| 3 | ±78 km | Region/state |
| 5 | ±2.4 km | City (default) |
| 6 | ±610 m | Neighborhood |
| 7 | ±76 m | Building (requires gpsOptIn) |

### Auto-purge

```sql
-- Fonction appelée quotidiennement via CronJob K8s
SELECT purge_expired_gps();
```

Purge automatique des coordonnées GPS expirées (>24h).

## Fraud detection

### Impossible travel

Détecte les déplacements physiquement impossibles (>800 km/h).

**Example:**
```
User A login from Dakar (14.69, -17.44) at 10:00
User A login from Paris (48.85, 2.35) at 10:30
→ Distance: 4200 km in 30 min = 8400 km/h
→ IMPOSSIBLE TRAVEL detected
→ Risk score: 95/100
→ Action: step_up authentication required
```

### VPN/Proxy detection

Détection via ASN organization (MaxMind).

**Indicators:**
- ASN org contains "VPN", "proxy", "hosting", "datacenter", "cloud"
- Risk score: 30/100
- Action: log_only (ou step_up selon config)

### Country mismatch

Détecte incohérence entre pays SIM (MCC) et pays IP.

**Example:**
```
MCC 608 (Senegal) but IP resolves to France
→ Risk score: 50/100
→ Possible scenarios: roaming, VPN, fraud
```

## Multi-country configuration

### Supported countries

| Code | Country | Currency | Timezone | USSD | Mobile Money |
|------|---------|----------|----------|------|--------------|
| SN | Sénégal | XOF (CFA) | Africa/Dakar | ✅ | ✅ |
| CI | Côte d'Ivoire | XOF (CFA) | Africa/Abidjan | ✅ | ✅ |
| GH | Ghana | GHS (₵) | Africa/Accra | ✅ | ✅ |
| NG | Nigeria | NGN (₦) | Africa/Lagos | ✅ | ✅ |
| FR | France | EUR (€) | Europe/Paris | ❌ | ❌ |

Future: ML, BF, TG, BJ (inactive for now).

### Country matrix

Stocke la configuration de chaque pays:

```sql
SELECT * FROM molam_country_matrix WHERE country_code = 'SN';
```

**Fields:**
- Phone format: regex, prefix, example
- Currency: code, symbol
- Timezones: array, default
- USSD: prefix, gateway URL
- Locales: default, supported array
- Flags: active, supports_ussd, supports_mobile_money
- Metadata: carriers, MCC, capital

## Intégrations

### MaxMind GeoLite2

Free geolocation database (requires account).

**Setup:**
1. Create account: https://www.maxmind.com/en/geolite2/signup
2. Generate license key
3. Download databases:
   - GeoLite2-City.mmdb
   - GeoLite2-ASN.mmdb
4. Place in `/data/` or configure `MAXMIND_DB_PATH`

**Auto-update (K8s):**
- CronJob weekly (every Sunday 2 AM)
- Downloads latest databases via init container

### USSD Providers

Supported:
- Africa's Talking (SN, CI, GH, NG)
- Twilio Programmable Voice
- Infobip

**Webhook signature:**
```bash
HMAC-SHA256(webhook_secret, JSON.stringify(body))
```

### AWS KMS

Envelope encryption pour coordonnées GPS.

**Flow:**
1. Generate random 256-bit data key
2. Encrypt data key with KMS master key
3. Encrypt GPS coordinate with data key (AES-256-GCM)
4. Store: `iv (12) + tag (16) + ciphertext`

## Déploiement

### Kubernetes

```bash
kubectl apply -f k8s/deployment.yaml
```

**Resources:**
- Deployment: 2 replicas, rolling update
- Service: ClusterIP on port 3009
- ServiceAccount: For AWS KMS access
- CronJob: MaxMind updater (weekly)
- CronJob: GPS purge (daily)

**Secrets required:**
- `postgres-secret`: DATABASE_URL
- `redis-secret`: REDIS_URL
- `jwt-keys`: JWT_PUBLIC_KEY
- `kms-secret`: KMS_KEY_ID
- `maxmind-secret`: MAXMIND_ACCOUNT_ID, MAXMIND_LICENSE_KEY
- `ussd-secret`: USSD_WEBHOOK_SECRET

### Health checks

```bash
# Liveness
curl http://localhost:3009/livez

# Readiness
curl http://localhost:3009/healthz

# Detailed health
curl http://localhost:3009/health
```

## Tests

```bash
# Run tests
npm test

# Structure tests
node test_structure.js
```

## Monitoring

### Metrics (Prometheus)

```yaml
# TODO: Add Prometheus metrics
- http_requests_total
- geo_lookups_total
- fraud_detections_total
- gps_captures_total
```

### Audit events

Tous les événements géo sont loggés dans `molam_geo_events`:

- `location_captured`: Context géo capturé
- `country_mismatch`: Incohérence pays SIM vs IP
- `vpn_detected`: VPN/proxy détecté
- `impossible_travel`: Déplacement impossible détecté
- `ussd_routed`: Requête USSD routée
- `currency_switched`: Changement de devise
- `timezone_updated`: Changement de timezone

## Sécurité

### Best practices

1. ✅ JWT RS256 verification
2. ✅ Webhook signature verification (HMAC-SHA256)
3. ✅ GPS coordinates encrypted at rest (KMS)
4. ✅ Rate limiting (via API Gateway)
5. ✅ CORS restricted to `*.molam.com`
6. ✅ Helmet.js security headers
7. ✅ Auto-purge ephemeral data (24h)
8. ✅ Audit trail complet

### RGPD compliance

- Opt-in explicite pour GPS
- Droit à l'effacement (via DELETE /prefs)
- Minimisation des données (geohash)
- Durée de conservation limitée (24h max)
- Encryption at rest
- Audit trail

## Roadmap

- [ ] Add Prometheus metrics
- [ ] Implement rate limiting per country
- [ ] Support reverse geocoding (lat/lon → address)
- [ ] Add weather API integration (optional)
- [ ] Support for more countries (ML, BF, TG, BJ)
- [ ] Mobile SDK (React Native)
- [ ] Admin dashboard for country matrix management

## Support

- **Email**: support@molam.com
- **Docs**: https://docs.molam.com/geo
- **Status**: https://status.molam.com

## License

PROPRIETARY - © 2024 Molam
