#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'molam',
  password: process.env.DB_PASSWORD || 'molam_pass',
  database: process.env.DB_NAME || 'molam',
});

async function clean() {
  console.log('🧹 Nettoyage de la base de données...\n');

  try {
    await pool.query('DROP SCHEMA public CASCADE');
    console.log('   ✅ Schéma supprimé');

    await pool.query('CREATE SCHEMA public');
    console.log('   ✅ Schéma recréé');

    await pool.query('GRANT ALL ON SCHEMA public TO ' + (process.env.DB_USER || 'molam'));
    await pool.query('GRANT ALL ON SCHEMA public TO public');
    console.log('   ✅ Privilèges restaurés\n');

    console.log('✅ Base de données nettoyée!\n');
    console.log('💡 Exécutez maintenant: node init-database.js\n');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

clean();
