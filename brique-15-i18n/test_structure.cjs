#!/usr/bin/env node
/**
 * Tests de structure pour Brique 15 - Multilingue (i18n)
 */

const fs = require('fs');

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

console.log('🧪 Tests de structure - Brique 15 Multilingue (i18n)\n');

// Test 1: SQL
console.log('Test 1: Fichiers SQL');
test('Schéma SQL présent', () => {
  fileExists('sql/015_i18n.sql');
});

// Test 2: Structure
console.log('\nTest 2: Structure du projet');
test('Structure des répertoires OK', () => {
  dirExists('src');
  dirExists('src/i18n');
  dirExists('src/ussd');
  dirExists('src/util');
  dirExists('tools');
  dirExists('packages/sdk-i18n/src');
  dirExists('tests');
  dirExists('k8s');
  dirExists('sql');
});

// Test 3: Sources TypeScript
console.log('\nTest 3: Fichiers source TypeScript');
test('Tous les fichiers source présents', () => {
  fileExists('src/i18n/config.ts');
  fileExists('src/i18n/i18n.service.ts');
  fileExists('src/i18n/i18n.routes.ts');
  fileExists('src/util/pg.ts');
  fileExists('src/util/redis.ts');
  fileExists('src/util/auth.ts');
  fileExists('src/util/errors.ts');
  fileExists('src/ussd/i18nUssd.ts');
  fileExists('src/server.ts');
});

// Test 4: SDK Client
console.log('\nTest 4: SDK Client');
test('SDK i18n client présent', () => {
  fileExists('packages/sdk-i18n/src/index.ts');
});

// Test 5: CI Tools
console.log('\nTest 5: CI Tools');
test('Lint tool présent', () => {
  fileExists('tools/i18n-lint.ts');
});

// Test 6: Documentation
console.log('\nTest 6: Documentation');
test('Documentation complète', () => {
  fileExists('README.md');
  fileExists('.env.example');
  fileExists('package.json');
  fileExists('tsconfig.json');
});

// Test 7: Package.json
console.log('\nTest 7: Configuration package.json');
test('Dépendances correctes', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.dependencies) throw new Error('No dependencies');
  if (!pkg.dependencies.express) throw new Error('Missing express');
  if (!pkg.dependencies.pg) throw new Error('Missing pg');
  if (!pkg.dependencies.redis) throw new Error('Missing redis');
  if (!pkg.dependencies['@aws-sdk/client-s3']) throw new Error('Missing @aws-sdk/client-s3');
});

// Test 8: SQL Content
console.log('\nTest 8: Contenu du schéma SQL');
test('Tables principales présentes', () => {
  const sql = fs.readFileSync('sql/015_i18n.sql', 'utf8');
  const tables = [
    'i18n_locales',
    'i18n_modules',
    'i18n_entries',
    'i18n_releases',
    'i18n_bundles',
    'i18n_audit'
  ];
  tables.forEach(table => {
    if (!sql.includes(table)) {
      throw new Error(`Table ${table} not found`);
    }
  });
});

// Test 9: Fonctions SQL
console.log('\nTest 9: Fonctions SQL');
test('Fonctions de fallback présentes', () => {
  const sql = fs.readFileSync('sql/015_i18n.sql', 'utf8');
  const functions = [
    'get_locale_fallback_chain',
    'resolve_i18n_key',
    'count_missing_keys'
  ];
  functions.forEach(fn => {
    if (!sql.includes(fn)) {
      throw new Error(`Function ${fn} not found`);
    }
  });
});

// Test 10: Service TypeScript
console.log('\nTest 10: Service TypeScript');
test('Méthodes principales du service', () => {
  const service = fs.readFileSync('src/i18n/i18n.service.ts', 'utf8');
  const methods = ['resolve', 'getFallbackChain', 'upsertEntry', 'buildBundle', 'publishRelease'];
  methods.forEach(method => {
    if (!service.includes(`async ${method}`) && !service.includes(`${method}(`)) {
      throw new Error(`Method ${method} not found`);
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
