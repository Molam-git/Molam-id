#!/usr/bin/env node

/**
 * ============================================================================
 * MOLAM-ID - Script d'initialisation de la base de données
 * ============================================================================
 * Ce script applique toutes les tables et schémas nécessaires pour Molam-ID
 *
 * Usage:
 *   node init-database.js
 *
 * Prérequis:
 *   - PostgreSQL doit être démarré
 *   - Fichier .env configuré avec DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 * ============================================================================
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
dotenv.config();

// Configuration de la connexion
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'molam',
  password: process.env.DB_PASSWORD || 'molam_pass',
  database: process.env.DB_NAME || 'molam',
});

// Liste des fichiers SQL à exécuter dans l'ordre
const SQL_FILES = [
  // 1. Schéma principal unifié (tables de base + briques 1-5)
  'sql/000_unified_schema.sql',

  // 1.5. Correctifs pour les relations manquantes
  'fix-schemas.sql',

  // 2. Schémas des briques additionnelles (ordre numérique)
  'brique-06-password-reset/sql/006_password_pin_reset.sql',   // Brique 6: Password/PIN Reset
  'brique-07-biometrics/sql/007_biometrics_core.sql',          // Brique 7: Biometrics
  'brique-08-kyc-aml/sql/01_kyc_schema.sql',                   // Brique 8: KYC/AML Schema
  'brique-08-kyc-aml/sql/02_kyc_functions.sql',                // Brique 8: KYC/AML Functions
  'brique-08-voice-auth/sql/002_voice_auth.sql',               // Brique 8: Voice Auth
  'brique-09-geo/sql/003_geo.sql',                             // Brique 9: Geo-location
  'brique-09-geo/sql/003_geo_seed.sql',                        // Brique 9: Geo seed data
  'brique-10-device/sql/010_device.sql',                       // Brique 10: Device Fingerprinting
  'brique-11-mfa/sql/011_mfa.sql',                             // Brique 11: MFA/2FA
  'brique-12-delegation/sql/012_delegated_access.sql',         // Brique 12: Delegation
  'brique-13-blacklist/sql/013_blacklist_suspensions.sql',     // Brique 13: Blacklist
  'brique-14-audit/sql/014_audit_logs.sql',                    // Brique 14: Audit Logs
  'brique-15-i18n/sql/015_i18n.sql',                           // Brique 15: i18n
  'brique-16-fx/sql/016_fx.sql',                               // Brique 16: Foreign Exchange
  'brique-17-profile/sql/017_profile.sql',                     // Brique 17: User Profile
  'brique-18-update-profile/sql/018_update_profile.sql',       // Brique 18: Update Profile
  'brique-19-export-profile/sql/019_export_profile.sql',       // Brique 19: Export Profile
  'brique-20-rbac-granular/sql/020_rbac_granular.sql',         // Brique 20: RBAC Granular
  'brique-20-rbac-granular/sql/seed_rbac.sql',                 // Brique 20: RBAC Seed Data
  'brique-21-role-mgmt/sql/021_role_mgmt.sql',                 // Brique 21: Role Management
  'brique-22-admin-id/sql/022_admin_id.sql',                   // Brique 22: Admin ID
  'brique-23-sessions-monitoring/sql/023_sessions_monitoring.sql', // Brique 23: Sessions Monitoring
  'brique-24-sdk-auth/sql/024_sdk_auth.sql',                   // Brique 24: SDK Auth
  'brique-25-ui-id/sql/025_ui_id.sql',                         // Brique 25: UI ID
  'brique-26-admin-ui/sql/026_admin_ui.sql',                   // Brique 26: Admin UI
  'brique-27-i18n/sql/027_i18n.sql',                           // Brique 27: i18n (extended)
  'brique-28-multicurrency/sql/028_multicurrency.sql',         // Brique 28: Multi-currency
  'brique-29-user-profile/sql/029_user_profile.sql',           // Brique 29: User Profile (extended)
  'brique-30-export-profile/sql/030_profile_export.sql',       // Brique 30: Profile Export
  'brique-31-rbac-granular/sql/031_rbac.sql',                  // Brique 31: RBAC (extended)
  'brique-32-api-role-mgmt/sql/032_role_management.sql',       // Brique 32: API Role Management
  'brique-33-api-admin/sql/033_admin_id_governance.sql',       // Brique 33: Admin ID Governance
  'brique-34-sessions-monitoring/sql/034_sessions_monitoring.sql', // Brique 34: Sessions Monitoring (extended)
  'brique-36-ui-id/sql/036_ui_id.sql',                         // Brique 36: UI ID (extended)
  'brique-audit/sql/01_schema.sql',                            // Brique Audit: Schema
  'brique-audit/sql/02_functions.sql',                         // Brique Audit: Functions
];

/**
 * Exécute un fichier SQL
 */
async function executeSQLFile(filePath) {
  const fullPath = path.join(__dirname, filePath);

  console.log(`\n📄 Exécution: ${filePath}`);

  // Vérifier si le fichier existe
  if (!fs.existsSync(fullPath)) {
    console.log(`   ⚠️  Fichier non trouvé: ${filePath} (ignoré)`);
    return;
  }

  // Lire le contenu
  const sql = fs.readFileSync(fullPath, 'utf8');

  try {
    // Exécuter le SQL
    await pool.query(sql);
    console.log(`   ✅ Succès`);
  } catch (error) {
    console.error(`   ⚠️  Erreur (ignorée):`, error.message.substring(0, 80));
    // Ne pas throw - continuer avec les autres fichiers
  }
}

/**
 * Vérifie la connexion à la base de données
 */
async function testConnection() {
  console.log('🔌 Test de connexion à la base de données...');
  console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`   Port: ${process.env.DB_PORT || 5432}`);
  console.log(`   Database: ${process.env.DB_NAME || 'molam'}`);
  console.log(`   User: ${process.env.DB_USER || 'molam'}`);

  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log(`   ✅ Connexion réussie`);
    console.log(`   ⏰ ${result.rows[0].current_time}`);
    console.log(`   📦 ${result.rows[0].pg_version.split(',')[0]}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Erreur de connexion:`, error.message);
    return false;
  }
}

/**
 * Affiche un résumé des tables créées
 */
async function showSummary() {
  console.log('\n📊 Résumé des tables créées:');
  console.log('='.repeat(80));

  const result = await pool.query(`
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'molam_%'
    ORDER BY tablename;
  `);

  console.log(`\n   Total: ${result.rows.length} tables\n`);

  result.rows.forEach((row, index) => {
    console.log(`   ${(index + 1).toString().padStart(2, '0')}. ${row.tablename.padEnd(40, ' ')} (${row.size})`);
  });

  console.log('\n' + '='.repeat(80));
}

/**
 * Fonction principale
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║         MOLAM-ID - INITIALISATION DE LA BASE DE DONNÉES          ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  try {
    // 1. Tester la connexion
    const connected = await testConnection();
    if (!connected) {
      console.error('\n❌ Impossible de se connecter à la base de données');
      console.error('   Vérifiez que PostgreSQL est démarré et que votre .env est correct');
      process.exit(1);
    }

    // 2. Demander confirmation
    console.log('\n⚠️  ATTENTION: Ce script va créer/modifier les tables de la base de données');
    console.log('   Appuyez sur CTRL+C pour annuler, ou attendez 5 secondes...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // 3. Exécuter les fichiers SQL
    console.log('\n🚀 Début de l\'initialisation...');
    console.log('='.repeat(80));

    for (const sqlFile of SQL_FILES) {
      await executeSQLFile(sqlFile);
    }

    // 4. Afficher le résumé
    await showSummary();

    console.log('\n✅ Initialisation terminée avec succès!\n');
    console.log('💡 Vous pouvez maintenant lancer votre serveur avec: npm start\n');

  } catch (error) {
    console.error('\n❌ Erreur fatale:', error.message);
    console.error('\n   Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Fermer le pool
    await pool.end();
  }
}

// Exécuter le script
main();
