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
  // 1. Schéma principal unifié (tables de base)
  'sql/000_unified_schema.sql',

  // 2. Schémas additionnels pour les briques
  'sql/010_device_fingerprinting.sql',  // Brique 10: Device Fingerprinting
  'sql/011_mfa.sql',                    // Brique 11: MFA/2FA
  'sql/013_blacklist.sql',              // Brique 13: Blacklist
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
    console.error(`   ❌ Erreur:`, error.message);
    throw error;
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
