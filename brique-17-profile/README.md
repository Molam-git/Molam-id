# Brique 17 - Profil utilisateur

Système de profils enrichis et unifiés pour tous les modules Molam.

## Fonctionnalités

- **Profil de base**: nom, email, téléphone, pays, devise/langue
- **Avatar**: stocké S3 avec URLs signées (TTL 1h)
- **Badges**: kyc_verified, merchant_pro, employee, agent
- **Préférences**: theme, notifications, locale, accessibility
- **Timeline**: historique des modifications (audit trail)
- **RGPD**: export profil, droits d'effacement

## API Endpoints

- `GET /v1/profile/me` - Obtenir son profil
- `PATCH /v1/profile/me` - Mettre à jour son profil
- `POST /v1/profile/avatar/upload` - Demander URL upload avatar
- `POST /v1/profile/:user_id/badges` - Ajouter badge (admin)

## Badges Disponibles

- `kyc_verified` - KYC vérifié
- `merchant_pro` - Marchand professionnel
- `employee` - Employé Molam
- `agent` - Agent Molam
- `partner_bank` - Partenaire bancaire

## Usage

```bash
npm install
npm run build
npm start
```

© 2024 Molam
