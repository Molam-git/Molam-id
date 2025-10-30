#!/usr/bin/env node
/**
 * Tests de structure pour Brique 13 - Blacklist & Suspensions
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

console.log('🧪 Tests de structure - Brique 13 Blacklist & Suspensions\n');

// Test 1: Fichiers SQL
console.log('Test 1: Fichiers SQL');
test('Schéma SQL présent', () => {
  fileExists('sql/013_blacklist_suspensions.sql');
});

// Test 2: Structure du projet
console.log('\nTest 2: Structure du projet');
test('Structure des répertoires OK', () => {
  dirExists('src');
  dirExists('src/blacklist');
  dirExists('src/util');
  dirExists('tests');
  dirExists('k8s');
  dirExists('sql');
});

// Test 3: Fichiers source TypeScript
console.log('\nTest 3: Fichiers source TypeScript');
test('Tous les fichiers source présents', () => {
  fileExists('src/blacklist/config.ts');
  fileExists('src/blacklist/routes.ts');
  fileExists('src/util/pg.ts');
  fileExists('src/util/redis.ts');
  fileExists('src/util/auth.ts');
  fileExists('src/util/errors.ts');
  fileExists('src/util/audit.ts');
  fileExists('src/util/events.ts');
  fileExists('src/server.ts');
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
  if (!pkg.dependencies.jsonwebtoken) throw new Error('Missing jsonwebtoken');
  if (!pkg.dependencies.uuid) throw new Error('Missing uuid');
});

// Test 6: Fichiers de tests
console.log('\nTest 6: Fichiers de tests');
test('Tests présents', () => {
  fileExists('tests/blacklist.test.ts');
  dirExists('tests');
});

// Test 7: Contenu du schéma SQL
console.log('\nTest 7: Contenu du schéma SQL');
test('Toutes les tables SQL présentes', () => {
  const sql = fs.readFileSync('sql/013_blacklist_suspensions.sql', 'utf8');
  const tables = [
    'molam_blacklist',
    'molam_blacklist_audit'
  ];

  tables.forEach(table => {
    if (!sql.includes(table)) {
      throw new Error(`Table ${table} not found in SQL`);
    }
  });
});

// Test 8: Type ENUM
console.log('\nTest 8: Type ENUM');
test('Type suspension_scope défini', () => {
  const sql = fs.readFileSync('sql/013_blacklist_suspensions.sql', 'utf8');
  if (!sql.includes('suspension_scope')) {
    throw new Error('Type suspension_scope not found');
  }
  // Vérifier les valeurs
  const scopes = ['global', 'module'];
  scopes.forEach(scope => {
    if (!sql.includes(scope)) {
      throw new Error(`Scope ${scope} not found in ENUM`);
    }
  });
});

// Test 9: Fonctions SQL
console.log('\nTest 9: Fonctions SQL');
test('Fonctions principales présentes', () => {
  const sql = fs.readFileSync('sql/013_blacklist_suspensions.sql', 'utf8');
  const functions = ['expire_suspensions', 'is_user_blacklisted'];
  functions.forEach(fn => {
    if (!sql.includes(fn)) {
      throw new Error(`Function ${fn} not found`);
    }
  });
});

// Test 10: Index de performance
console.log('\nTest 10: Index de performance');
test('Index optimisés présents', () => {
  const sql = fs.readFileSync('sql/013_blacklist_suspensions.sql', 'utf8');
  const indexes = [
    'idx_blacklist_user_id',
    'idx_blacklist_status',
    'idx_blacklist_active_check'
  ];
  indexes.forEach(idx => {
    if (!sql.includes(idx)) {
      throw new Error(`Index ${idx} not found`);
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
