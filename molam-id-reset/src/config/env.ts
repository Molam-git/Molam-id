// src/config/env.ts
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Recréer __dirname en mode ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger le .env à partir de la racine du projet
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Debug (optionnel)
console.log('DEBUG: PG_URL type', typeof process.env.PG_URL);
console.log('DEBUG: PG_URL value', process.env.PG_URL);

export const env = {
    // PostgreSQL
    PG_URL: process.env.PG_URL || 'postgres://molam_ussd_user:pass@localhost:5433/molam_ussd',

    // Serveur
    PORT: parseInt(process.env.PORT || '3000', 10),

    // JWT général
    JWT_SECRET: process.env.JWT_SECRET || 'supersecretkey',

    // JWT pour reset PIN / mot de passe
    JWT_RESET_SECRET: process.env.JWT_RESET_SECRET || 'rotated-in-vault',
    JWT_RESET_TTL_S: parseInt(process.env.JWT_RESET_TTL_S || '900', 10),

    // Rate limiting
    RATE_LIMIT_WINDOW_S: parseInt(process.env.RATE_LIMIT_WINDOW_S || '3600', 10),
    RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '10', 10),

    // OTP (One-Time Password) configuration
    OTP_TTL_SECONDS: parseInt(process.env.OTP_TTL_SECONDS || '600', 10),
    OTP_ATTEMPTS_PER_HOUR: parseInt(process.env.OTP_ATTEMPTS_PER_HOUR || '3', 10),

    // Langue par défaut
    DEFAULT_LANG: 'en',

    // Pepper pour le hachage des PIN/mot de passe
    PEPPER: process.env.PEPPER || 'use-hsm-key-ref'
};
