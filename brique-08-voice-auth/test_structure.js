#!/usr/bin/env node
/**
 * Tests de structure pour Brique 8 - Voice Auth
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

console.log('🧪 Tests de structure - Brique 8 Voice Auth\n');

// Test 1: Fichiers SQL
console.log('Test 1: Fichiers SQL');
test('Schéma SQL présent', () => {
  fileExists('sql/002_voice_auth.sql');
});

// Test 2: Structure du projet
console.log('\nTest 2: Structure du projet');
test('Structure des répertoires OK', () => {
  dirExists('src');
  dirExists('src/util');
  dirExists('src/routes');
  dirExists('web');
  dirExists('mobile');
  dirExists('tests');
  dirExists('k8s');
});

// Test 3: Fichiers source TypeScript
console.log('\nTest 3: Fichiers source TypeScript');
test('Tous les fichiers source présents', () => {
  fileExists('src/config.ts');
  fileExists('src/server.ts');
  fileExists('src/voiceML.ts');
  fileExists('src/util/kms.ts');
  fileExists('src/util/hash.ts');
  fileExists('src/util/s3.ts');
  fileExists('src/util/redis.ts');
  fileExists('src/util/pg.ts');
  fileExists('src/util/audit.ts');
  fileExists('src/util/sira.ts');
  fileExists('src/util/auth.ts');
  fileExists('src/util/errors.ts');
  fileExists('src/routes/voice.ts');
  fileExists('src/routes/ivr.ts');
});

// Test 4: Exemples frontend
console.log('\nTest 4: Exemples frontend');
test('Exemples frontend présents', () => {
  fileExists('web/src/voiceAuth.ts');
  fileExists('mobile/ios/VoiceAuthManager.swift');
  fileExists('mobile/android/VoiceAuthManager.kt');
});

// Test 5: Documentation
console.log('\nTest 5: Documentation');
test('Documentation complète', () => {
  fileExists('README.md');
  fileExists('.env.example');
  fileExists('package.json');
  fileExists('tsconfig.json');
});

// Test 6: Configuration package.json
console.log('\nTest 6: Configuration package.json');
test('Dépendances correctes', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.dependencies) throw new Error('No dependencies');
  if (!pkg.dependencies.express) throw new Error('Missing express');
  if (!pkg.dependencies.pg) throw new Error('Missing pg');
  if (!pkg.dependencies.redis) throw new Error('Missing redis');
  if (!pkg.dependencies['@aws-sdk/client-s3']) throw new Error('Missing AWS SDK');
});

// Test 7: Fichiers de tests
console.log('\nTest 7: Fichiers de tests');
test('Tests présents', () => {
  fileExists('tests/voice.test.ts');
  dirExists('tests');
});

// Test 8: Kubernetes config
console.log('\nTest 8: Configuration Kubernetes');
test('Config K8s présente', () => {
  fileExists('k8s/deployment.yaml');
});

// Test 9: Compilation TypeScript
console.log('\nTest 9: Compilation TypeScript');
test('Fichiers compilés présents', () => {
  dirExists('dist');
  fileExists('dist/server.js');
  fileExists('dist/config.js');
  fileExists('dist/voiceML.js');
});

// Test 10: Contenu du schéma SQL
console.log('\nTest 10: Contenu du schéma SQL');
test('Toutes les tables SQL présentes', () => {
  const sql = fs.readFileSync('sql/002_voice_auth.sql', 'utf8');
  const tables = [
    'molam_voice_credentials',
    'molam_voice_prefs',
    'molam_voice_attempts',
    'molam_auth_events',
    'molam_voice_phrases'
  ];

  tables.forEach(table => {
    if (!sql.includes(table)) {
      throw new Error(`Table ${table} not found in SQL`);
    }
  });
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
