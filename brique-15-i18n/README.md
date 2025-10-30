# Brique 15 - Multilingue (i18n avec fallback)

Service d'internationalisation centralisé avec fallback hiérarchique, bundles signés, cache Redis, et support multi-canal (app, web, USSD, SMS).

## Fonctionnalités

- **Fallback hiérarchique**: fr-SN → fr → en
- **Multi-canal**: app, web, USSD, SMS, dashboard
- **Bundles signés**: Ed25519 pour intégrité
- **Cache Redis**: TTL 1h
- **CDN S3**: Distribution mondiale
- **USSD/SMS**: Templates avec contraintes de longueur
- **CI lint**: Vérification cohérence des variables

## API Endpoints

- `GET /v1/i18n/resolve` - Résoudre traductions
- `POST /v1/i18n/entries` - Upsert entrée
- `POST /v1/i18n/releases` - Créer release
- `POST /v1/i18n/releases/:id/publish` - Publier
- `GET /v1/i18n/missing-keys` - Clés manquantes
- `GET /v1/i18n/stats` - Statistiques

## Usage

```bash
npm install
npm run build
npm start
```

## Tests

```bash
npm test
npm run test:structure
npm run lint:i18n
```

© 2024 Molam
