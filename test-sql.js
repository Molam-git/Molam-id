#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'molam',
  password: 'molam_pass',
  database: 'molam',
});

async function test() {
  const sql = fs.readFileSync('sql/000_unified_schema.sql', 'utf8');

  try {
    await pool.query(sql);
    console.log('✅ SQL exécuté avec succès!');
  } catch (error) {
    console.error('❌ Erreur:', error.message);

    if (error.position) {
      const pos = parseInt(error.position);
      const before = sql.substring(Math.max(0, pos - 200), pos);
      const after = sql.substring(pos, pos + 200);

      console.error('\n📍 Position de l\'erreur (caractère', pos, '):');
      console.error('\nAVANT:');
      console.error(before);
      console.error('\n>>> ERREUR ICI <<<');
      console.error('\nAPRÈS:');
      console.error(after);
    }
  } finally {
    await pool.end();
  }
}

test();
