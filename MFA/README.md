# Brique 11 - Authentification Multi-Facteurs Industrielle

## 🎯 Objectif
Fournir une authentification multi-facteurs industrielle et multi-pays pour tous les utilisateurs externes et internes de la super app Molam.

## ✨ Fonctionnalités
- **Facteurs supportés**: OTP (SMS/Email), TOTP (RFC6238), WebAuthn/FIDO2, Codes de récupération, Push In-App, PIN USSD
- **Politiques risk-based**: Step-up basé sur la confiance du device, géolocalisation, rôle et signaux SIRA
- **Sécurité industrielle**: OTP hashés (Argon2id), anti-bruteforce, chiffrement des secrets, audit immuable
- **Intégration entreprise**: Séparation par filiales (Pay, Eats, Talk, Ads, Shop, Free)

## � Démarrage rapide

```bash
# Installation
npm install

# Configuration
cp .env.example .env
# Éditer .env avec vos paramètres

# Migration DB
npm run migrate

# Développement
npm run dev

# Production
npm run build
npm start