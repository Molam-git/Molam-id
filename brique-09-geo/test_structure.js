#!/usr/bin/env node
/**
 * Tests de structure pour Brique 9 - Géolocalisation
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${error.message}`);
    failed++;
  }
}

function fileExists(filepath) {
  if (!fs.existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }
}

function dirExists(dirpath) {
  if (!fs.existsSync(dirpath) || !fs.statSync(dirpath).isDirectory()) {
    throw new Error(`Directory not found: ${dirpath}`);
  }
}

console.log('🧪 Tests de structure - Brique 9 Géolocalisation\n');

// Test 1: Fichiers SQL
console.log('Test 1: Fichiers SQL');
test('Schéma SQL présent', () => {
  fileExists('sql/003_geo.sql');
});

test('Seed data SQL présent', () => {
  fileExists('sql/003_geo_seed.sql');
});

// Test 2: Structure du projet
console.log('\nTest 2: Structure du projet');
test('Structure des répertoires OK', () => {
  dirExists('src');
  dirExists('src/util');
  dirExists('src/routes');
  dirExists('src/geo');
  dirExists('tests');
  dirExists('k8s');
});

// Test 3: Fichiers source TypeScript
console.log('\nTest 3: Fichiers source TypeScript');
test('Tous les fichiers source présents', () => {
  fileExists('src/config.ts');
  fileExists('src/server.ts');
  fileExists('src/util/pg.ts');
  fileExists('src/util/redis.ts');
  fileExists('src/util/kms.ts');
  fileExists('src/util/audit.ts');
  fileExists('src/util/auth.ts');
  fileExists('src/util/errors.ts');
  fileExists('src/geo/maxmind.ts');
  fileExists('src/geo/geohash.ts');
  fileExists('src/geo/countryMatrix.ts');
  fileExists('src/geo/fraud.ts');
  fileExists('src/routes/geo.ts');
  fileExists('src/routes/ussd.ts');
});

// Test 4: Documentation
console.log('\nTest 4: Documentation');
test('Documentation complète', () => {
  fileExists('README.md');
  fileExists('.env.example');
  fileExists('package.json');
  fileExists('tsconfig.json');
});

// Test 5: Configuration package.json
console.log('\nTest 5: Configuration package.json');
test('Dépendances correctes', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.dependencies) throw new Error('No dependencies');
  if (!pkg.dependencies.express) throw new Error('Missing express');
  if (!pkg.dependencies.pg) throw new Error('Missing pg');
  if (!pkg.dependencies.redis) throw new Error('Missing redis');
  if (!pkg.dependencies['@maxmind/geoip2-node']) throw new Error('Missing MaxMind');
  if (!pkg.dependencies['@aws-sdk/client-kms']) throw new Error('Missing AWS KMS SDK');
});

// Test 6: Fichiers de tests
console.log('\nTest 6: Fichiers de tests');
test('Tests présents', () => {
  fileExists('tests/geo.test.ts');
  dirExists('tests');
});

// Test 7: Kubernetes config
console.log('\nTest 7: Configuration Kubernetes');
test('Config K8s présente', () => {
  fileExists('k8s/deployment.yaml');
});

// Test 8: Contenu du schéma SQL
console.log('\nTest 8: Contenu du schéma SQL');
test('Toutes les tables SQL présentes', () => {
  const sql = fs.readFileSync('sql/003_geo.sql', 'utf8');
  const tables = [
    'molam_user_geo_prefs',
    'molam_geo_last_context',
    'molam_geo_events',
    'molam_gps_ephemeral',
    'molam_country_matrix'
  ];

  tables.forEach(table => {
    if (!sql.includes(table)) {
      throw new Error(`Table ${table} not found in SQL`);
    }
  });
});

// Test 9: Seed data
console.log('\nTest 9: Seed data');
test('Pays principaux dans seed', () => {
  const seed = fs.readFileSync('sql/003_geo_seed.sql', 'utf8');
  const countries = ['SN', 'CI', 'GH', 'NG', 'FR'];

  countries.forEach(country => {
    if (!seed.includes(`'${country}'`)) {
      throw new Error(`Country ${country} not found in seed data`);
    }
  });
});

// Test 10: Fonctions SQL
console.log('\nTest 10: Fonctions SQL');
test('Fonction purge_expired_gps présente', () => {
  const sql = fs.readFileSync('sql/003_geo.sql', 'utf8');
  if (!sql.includes('purge_expired_gps')) {
    throw new Error('Function purge_expired_gps not found');
  }
});

// Résumé
console.log('\n═══════════════════════════════════════════════════════════');
console.log(`📊 Résumé: ${passed}/${passed + failed} tests réussis (${Math.round(passed / (passed + failed) * 100)}%)`);
console.log('═══════════════════════════════════════════════════════════');

if (failed === 0) {
  console.log('✅ Tests de structure RÉUSSIS');
  process.exit(0);
} else {
  console.log(`❌ ${failed} test(s) échoué(s)`);
  process.exit(1);
}
