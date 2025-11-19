#!/usr/bin/env node

/**
 * ============================================================================
 * MOLAM-ID - Script complet de création de base de données + tables
 * ============================================================================
 * Ce script combine la création de la base de données ET l'initialisation
 * des tables en une seule commande.
 *
 * Usage:
 *   node setup-complete.js
 * ============================================================================
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool, Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
dotenv.config();

const DB_NAME = process.env.DB_NAME || 'molam';
const DB_USER = process.env.DB_USER || 'molam';
const DB_PASSWORD = process.env.DB_PASSWORD || 'molam_pass';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;

// Liste des fichiers SQL à exécuter
const SQL_FILES = [
  'sql/000_unified_schema.sql',
  'brique-06-password-reset/sql/006_password_pin_reset.sql',
  'brique-07-biometrics/sql/007_biometrics_core.sql',
  'brique-08-kyc-aml/sql/01_kyc_schema.sql',
  'brique-08-kyc-aml/sql/02_kyc_functions.sql',
  'brique-08-voice-auth/sql/002_voice_auth.sql',
  'brique-09-geo/sql/003_geo.sql',
  'brique-09-geo/sql/003_geo_seed.sql',
  'brique-10-device/sql/010_device.sql',
  'brique-11-mfa/sql/011_mfa.sql',
  'brique-12-delegation/sql/012_delegated_access.sql',
  'brique-13-blacklist/sql/013_blacklist_suspensions.sql',
  'brique-14-audit/sql/014_audit_logs.sql',
  'brique-15-i18n/sql/015_i18n.sql',
  'brique-16-fx/sql/016_fx.sql',
  'brique-17-profile/sql/017_profile.sql',
  'brique-18-update-profile/sql/018_update_profile.sql',
  'brique-19-export-profile/sql/019_export_profile.sql',
  'brique-20-rbac-granular/sql/020_rbac_granular.sql',
  'brique-20-rbac-granular/sql/seed_rbac.sql',
  'brique-21-role-mgmt/sql/021_role_mgmt.sql',
  'brique-22-admin-id/sql/022_admin_id.sql',
  'brique-23-sessions-monitoring/sql/023_sessions_monitoring.sql',
  'brique-24-sdk-auth/sql/024_sdk_auth.sql',
  'brique-25-ui-id/sql/025_ui_id.sql',
  'brique-26-admin-ui/sql/026_admin_ui.sql',
  'brique-27-i18n/sql/027_i18n.sql',
  'brique-28-multicurrency/sql/028_multicurrency.sql',
  'brique-29-user-profile/sql/029_user_profile.sql',
  'brique-30-export-profile/sql/030_profile_export.sql',
  'brique-31-rbac-granular/sql/031_rbac.sql',
  'brique-32-api-role-mgmt/sql/032_role_management.sql',
  'brique-33-api-admin/sql/033_admin_id_governance.sql',
  'brique-34-sessions-monitoring/sql/034_sessions_monitoring.sql',
  'brique-36-ui-id/sql/036_ui_id.sql',
  'brique-audit/sql/01_schema.sql',
  'brique-audit/sql/02_functions.sql',
];

/**
 * Étape 1: Créer la base de données
 */
async function createDatabase() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║         ÉTAPE 1: CRÉATION DE LA BASE DE DONNÉES                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  // Connexion au serveur PostgreSQL (base postgres par défaut)
  const client = new Client({
    host: DB_HOST,
    port: parseInt(DB_PORT),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || undefined,
    database: 'postgres',
  });

  try {
    await client.connect();
    console.log(`✅ Connecté au serveur PostgreSQL sur ${DB_HOST}:${DB_PORT}`);

    // Vérifier si la base existe déjà
    const checkDb = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [DB_NAME]
    );

    if (checkDb.rows.length > 0) {
      console.log(`⚠️  La base de données "${DB_NAME}" existe déjà`);
      console.log('   Suppression en cours...');

      // Terminer les connexions existantes
      await client.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = $1
          AND pid <> pg_backend_pid()
      `, [DB_NAME]);

      // Supprimer la base
      await client.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
      console.log('   ✅ Base supprimée');
    }

    // Vérifier si l'utilisateur existe
    const checkUser = await client.query(
      "SELECT 1 FROM pg_catalog.pg_user WHERE usename = $1",
      [DB_USER]
    );

    if (checkUser.rows.length === 0) {
      console.log(`\n📝 Création de l'utilisateur "${DB_USER}"...`);
      await client.query(`CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}'`);
      console.log('   ✅ Utilisateur créé');
    } else {
      console.log(`\n✅ L'utilisateur "${DB_USER}" existe déjà`);
    }

    // Créer la base de données
    console.log(`\n📝 Création de la base de données "${DB_NAME}"...`);
    await client.query(`
      CREATE DATABASE ${DB_NAME}
        WITH OWNER = ${DB_USER}
        ENCODING = 'UTF8'
        LC_COLLATE = 'C'
        LC_CTYPE = 'C'
        TEMPLATE = template0
    `);
    console.log('   ✅ Base créée');

  } catch (error) {
    console.error('\n❌ Erreur lors de la création de la base:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Étape 2: Activer les extensions et configurer les privilèges
 */
async function setupExtensions() {
  console.log('\n📝 Configuration des extensions...');

  const pool = new Pool({
    host: DB_HOST,
    port: parseInt(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  try {
    // Activer les extensions
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    console.log('   ✅ Extensions activées (uuid-ossp, pgcrypto)');

    // Donner les privilèges
    await pool.query(`GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER}`);
    await pool.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ' + DB_USER);
    await pool.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ' + DB_USER);
    await pool.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ' + DB_USER);
    await pool.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ' + DB_USER);
    console.log('   ✅ Privilèges configurés');

  } catch (error) {
    console.error('\n❌ Erreur lors de la configuration:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Étape 3: Créer les tables
 */
async function createTables() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║         ÉTAPE 2: CRÉATION DES TABLES                             ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  const pool = new Pool({
    host: DB_HOST,
    port: parseInt(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  let successCount = 0;
  let skipCount = 0;

  try {
    console.log(`📦 ${SQL_FILES.length} fichiers SQL à exécuter\n`);

    for (const sqlFile of SQL_FILES) {
      const fullPath = path.join(__dirname, sqlFile);

      // Afficher le nom du fichier
      const fileName = path.basename(sqlFile);
      process.stdout.write(`   ${fileName.padEnd(50, ' ')}`);

      // Vérifier si le fichier existe
      if (!fs.existsSync(fullPath)) {
        console.log('⚠️  Ignoré (fichier non trouvé)');
        skipCount++;
        continue;
      }

      // Lire et exécuter le SQL
      try {
        const sql = fs.readFileSync(fullPath, 'utf8');
        await pool.query(sql);
        console.log('✅');
        successCount++;
      } catch (error) {
        console.log(`❌ (${error.message.substring(0, 40)}...)`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`📊 Résumé: ${successCount} réussis, ${skipCount} ignorés, ${SQL_FILES.length - successCount - skipCount} erreurs`);

  } catch (error) {
    console.error('\n❌ Erreur fatale:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Afficher un résumé des tables créées
 */
async function showSummary() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║         RÉSUMÉ DES TABLES CRÉÉES                                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  const pool = new Pool({
    host: DB_HOST,
    port: parseInt(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  try {
    const result = await pool.query(`
      SELECT
        tablename,
        pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename LIKE 'molam_%'
      ORDER BY tablename;
    `);

    console.log(`   Total: ${result.rows.length} tables\n`);

    result.rows.forEach((row, index) => {
      console.log(`   ${(index + 1).toString().padStart(2, '0')}. ${row.tablename.padEnd(45, ' ')} ${row.size}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération du résumé:', error.message);
  } finally {
    await pool.end();
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║         MOLAM-ID - CONFIGURATION COMPLÈTE DE LA BASE            ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\n   Configuration:`);
  console.log(`   - Hôte: ${DB_HOST}:${DB_PORT}`);
  console.log(`   - Base de données: ${DB_NAME}`);
  console.log(`   - Utilisateur: ${DB_USER}`);
  console.log('');

  try {
    // Étape 1: Créer la base de données
    await createDatabase();

    // Étape 2: Activer les extensions
    await setupExtensions();

    // Étape 3: Créer les tables
    await createTables();

    // Étape 4: Afficher le résumé
    await showSummary();

    console.log('\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ SUCCÈS !                                     ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');
    console.log('   La base de données Molam-ID est prête!\n');
    console.log('   💡 Prochaine étape: npm start\n');

  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════════════╗');
    console.error('║                    ❌ ERREUR                                       ║');
    console.error('╚════════════════════════════════════════════════════════════════════╝\n');
    console.error('   Message:', error.message);
    console.error('\n   Vérifiez que:');
    console.error('   1. PostgreSQL est démarré');
    console.error('   2. Les identifiants dans .env sont corrects');
    console.error('   3. L\'utilisateur PostgreSQL a les droits nécessaires\n');
    process.exit(1);
  }
}

// Exécuter
main();
