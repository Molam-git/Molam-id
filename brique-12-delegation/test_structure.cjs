#!/usr/bin/env node
/**
 * Tests de structure pour Brique 12 - Delegated Access
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

console.log('🧪 Tests de structure - Brique 12 Delegated Access\n');

// Test 1: Fichiers SQL
console.log('Test 1: Fichiers SQL');
test('Schéma SQL présent', () => {
  fileExists('sql/012_delegated_access.sql');
});

// Test 2: Structure du projet
console.log('\nTest 2: Structure du projet');
test('Structure des répertoires OK', () => {
  dirExists('src');
  dirExists('src/delegation');
  dirExists('src/util');
  dirExists('tests');
  dirExists('k8s');
  dirExists('sql');
});

// Test 3: Fichiers source TypeScript
console.log('\nTest 3: Fichiers source TypeScript');
test('Tous les fichiers source présents', () => {
  fileExists('src/delegation/config.ts');
  fileExists('src/delegation/routes.ts');
  fileExists('src/util/pg.ts');
  fileExists('src/util/redis.ts');
  fileExists('src/util/auth.ts');
  fileExists('src/util/errors.ts');
  fileExists('src/util/audit.ts');
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
  fileExists('tests/delegation.test.ts');
  dirExists('tests');
});

// Test 7: Contenu du schéma SQL
console.log('\nTest 7: Contenu du schéma SQL');
test('Toutes les tables SQL présentes', () => {
  const sql = fs.readFileSync('sql/012_delegated_access.sql', 'utf8');
  const tables = [
    'molam_delegations',
    'molam_delegation_approvals',
    'molam_delegation_audit',
    'molam_delegation_templates'
  ];

  tables.forEach(table => {
    if (!sql.includes(table)) {
      throw new Error(`Table ${table} not found in SQL`);
    }
  });
});

// Test 8: Type ENUM
console.log('\nTest 8: Type ENUM');
test('Type delegation_status défini', () => {
  const sql = fs.readFileSync('sql/012_delegated_access.sql', 'utf8');
  if (!sql.includes('delegation_status')) {
    throw new Error('Type delegation_status not found');
  }
  // Vérifier les valeurs
  const statuses = ['pending', 'active', 'revoked', 'expired'];
  statuses.forEach(status => {
    if (!sql.includes(status)) {
      throw new Error(`Status ${status} not found in ENUM`);
    }
  });
});

// Test 9: Fonction SQL
console.log('\nTest 9: Fonction SQL');
test('Fonction expire_delegations présente', () => {
  const sql = fs.readFileSync('sql/012_delegated_access.sql', 'utf8');
  if (!sql.includes('expire_delegations')) {
    throw new Error('Function expire_delegations not found');
  }
});

// Test 10: Templates par défaut
console.log('\nTest 10: Templates par défaut');
test('Templates insérés dans SQL', () => {
  const sql = fs.readFileSync('sql/012_delegated_access.sql', 'utf8');
  if (!sql.includes('molam_delegation_templates')) {
    throw new Error('Templates table not found');
  }
  if (!sql.includes('INSERT INTO molam_delegation_templates')) {
    throw new Error('Default templates INSERT not found');
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
