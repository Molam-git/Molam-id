# Brique 16 - Multidevise (FX)

Service de conversion automatique de devises via API forex multi-sources.

## Fonctionnalités
- Référentiel devises ISO 4217
- Taux multi-sources avec priorités
- Conversion traçable avec audit WORM
- Règles d'arrondi par pays (pricing/cash)
- Cache Redis + rate limiting
- SDK client

## API
- `GET /api/fx/convert` - Convertir montant
- `GET /api/fx/rates` - Taux disponibles
- `POST /api/fx/ingest` - Ingestion (admin)

© 2024 Molam
