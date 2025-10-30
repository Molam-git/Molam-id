#!/usr/bin/env node
/**
 * Tests de structure pour Brique 11 - 2FA/MFA unifié
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

console.log('🧪 Tests de structure - Brique 11 2FA/MFA unifié\n');

// Test 1: Fichiers SQL
console.log('Test 1: Fichiers SQL');
test('Schéma SQL présent', () => {
  fileExists('sql/011_mfa.sql');
});

// Test 2: Structure du projet
console.log('\nTest 2: Structure du projet');
test('Structure des répertoires OK', () => {
  dirExists('src');
  dirExists('src/mfa');
  dirExists('src/adapters');
  dirExists('sql');
});

// Test 3: Fichiers source
console.log('\nTest 3: Fichiers source MFA');
test('Tous les fichiers MFA présents', () => {
  fileExists('src/mfa/config.js');
  fileExists('src/mfa/crypto.js');
  fileExists('src/mfa/kms.js');
  fileExists('src/mfa/repo.js');
  fileExists('src/mfa/auth.js');
  fileExists('src/mfa/rate.js');
  fileExists('src/mfa/totp.js');
  fileExists('src/mfa/routes.js');
  fileExists('src/server.js');
});

// Test 4: Adapters
console.log('\nTest 4: Adapters de notification');
test('Adapter notify présent', () => {
  fileExists('src/adapters/notify.js');
});

// Test 5: Documentation
console.log('\nTest 5: Documentation');
test('Documentation complète', () => {
  fileExists('README.md');
  fileExists('package.json');
});

// Test 6: Configuration package.json
console.log('\nTest 6: Configuration package.json');
test('Dépendances correctes', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.dependencies) throw new Error('No dependencies');
  if (!pkg.dependencies.express) throw new Error('Missing express');
  if (!pkg.dependencies.pg) throw new Error('Missing pg');
  if (!pkg.dependencies.redis) throw new Error('Missing redis');
  if (!pkg.dependencies.jsonwebtoken) throw new Error('Missing jsonwebtoken');
  if (!pkg.dependencies.argon2) throw new Error('Missing argon2');
  if (!pkg.dependencies.uuid) throw new Error('Missing uuid');
});

// Test 7: Contenu du schéma SQL
console.log('\nTest 7: Contenu du schéma SQL');
test('Toutes les tables SQL présentes', () => {
  const sql = fs.readFileSync('sql/011_mfa.sql', 'utf8');
  const tables = [
    'molam_mfa_factors',
    'molam_mfa_otps',
    'molam_mfa_webauthn_credentials',
    'molam_mfa_recovery_codes',
    'molam_mfa_policies',
    'molam_ussd_pins',
    'molam_mfa_events'
  ];

  tables.forEach(table => {
    if (!sql.includes(table)) {
      throw new Error(`Table ${table} not found in SQL`);
    }
  });
});

// Test 8: Type ENUM
console.log('\nTest 8: Type ENUM');
test('Type mfa_factor défini', () => {
  const sql = fs.readFileSync('sql/011_mfa.sql', 'utf8');
  if (!sql.includes('mfa_factor')) {
    throw new Error('Type mfa_factor not found');
  }
  // Vérifier les valeurs
  const factors = ['sms_otp', 'email_otp', 'totp', 'webauthn', 'recovery_code', 'push', 'ussd_pin'];
  factors.forEach(factor => {
    if (!sql.includes(factor)) {
      throw new Error(`Factor ${factor} not found in ENUM`);
    }
  });
});

// Test 9: Routes principales
console.log('\nTest 9: Routes dans le code');
test('Routes /enroll, /challenge, /verify présentes', () => {
  const routes = fs.readFileSync('src/mfa/routes.js', 'utf8');
  if (!routes.includes('/enroll')) throw new Error('Route /enroll not found');
  if (!routes.includes('/challenge')) throw new Error('Route /challenge not found');
  if (!routes.includes('/verify')) throw new Error('Route /verify not found');
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
