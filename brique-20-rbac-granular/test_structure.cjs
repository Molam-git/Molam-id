#!/usr/bin/env node
/**
 * Tests de structure pour Brique 20 - RBAC Granular
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

console.log('🧪 Tests de structure - Brique 20 RBAC Granular\n');

// Test 1: SQL
console.log('Test 1: Fichiers SQL');
test('Schéma SQL présent', () => {
  fileExists('sql/020_rbac_granular.sql');
});

test('Seed data SQL présent', () => {
  fileExists('sql/seed_rbac.sql');
});

// Test 2: Structure
console.log('\nTest 2: Structure du projet');
test('Structure des répertoires OK', () => {
  dirExists('src');
  dirExists('src/util');
  dirExists('src/rbac');
  dirExists('src/routes');
  dirExists('src/middleware');
  dirExists('tests');
  dirExists('policies');
  dirExists('sql');
});

// Test 3: RBAC Core
console.log('\nTest 3: RBAC core logic');
test('Fichier check.ts présent', () => {
  fileExists('src/rbac/check.ts');
});

// Test 4: Middleware
console.log('\nTest 4: Middleware');
test('Fichier rbac middleware présent', () => {
  fileExists('src/middleware/rbac.ts');
});

// Test 5: Utilities
console.log('\nTest 5: Fichiers utilitaires');
test('Tous les fichiers utilitaires présents', () => {
  fileExists('src/util/pg.ts');
  fileExists('src/util/cache.ts');
  fileExists('src/util/auth.ts');
});

// Test 6: Routes
console.log('\nTest 6: Fichiers de routes');
test('Fichier rbac routes présent', () => {
  fileExists('src/routes/rbac.ts');
});

// Test 7: Server
console.log('\nTest 7: Server');
test('Fichier server.ts présent', () => {
  fileExists('src/server.ts');
});

// Test 8: Tests
console.log('\nTest 8: Fichiers de tests');
test('Fichier de tests présent', () => {
  fileExists('tests/rbac.test.ts');
});

// Test 9: Documentation
console.log('\nTest 9: Documentation');
test('Documentation complète', () => {
  fileExists('.env.example');
  fileExists('package.json');
  fileExists('tsconfig.json');
});

// Test 10: Policies
console.log('\nTest 10: Policies');
test('Fichier policy YAML présent', () => {
  fileExists('policies/rbac-policy-v1.yaml');
});

// Test 11: Package.json
console.log('\nTest 11: Configuration package.json');
test('Dépendances correctes', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.dependencies) throw new Error('No dependencies');
  if (!pkg.dependencies.express) throw new Error('Missing express');
  if (!pkg.dependencies.pg) throw new Error('Missing pg');
  if (!pkg.dependencies.redis) throw new Error('Missing redis');
  if (!pkg.dependencies.zod) throw new Error('Missing zod');
});

// Test 12: SQL Content - Schema
console.log('\nTest 12: Contenu du schéma SQL');
test('Tables présentes', () => {
  const sql = fs.readFileSync('sql/020_rbac_granular.sql', 'utf8');
  const elements = [
    'molam_permissions',
    'molam_roles_v2',
    'molam_role_permissions',
    'molam_user_roles',
    'molam_rbac_audit',
    'molam_policy_versions',
    'has_permission',
    'get_user_permissions',
    'grant_role',
    'revoke_role'
  ];
  elements.forEach(elem => {
    if (!sql.includes(elem)) {
      throw new Error(`Element ${elem} not found`);
    }
  });
});

// Test 13: SQL Content - Seed
console.log('\nTest 13: Contenu du seed SQL');
test('Roles et permissions présents', () => {
  const sql = fs.readFileSync('sql/seed_rbac.sql', 'utf8');
  const roles = ['client', 'agent', 'merchant', 'bank', 'super_admin', 'auditor'];
  roles.forEach(role => {
    if (!sql.includes(role)) {
      throw new Error(`Role ${role} not found`);
    }
  });
});

// Test 14: RBAC Check Functions
console.log('\nTest 14: RBAC check functions');
test('Fonctions de vérification présentes', () => {
  const check = fs.readFileSync('src/rbac/check.ts', 'utf8');
  const functions = ['checkPermission', 'getUserPermissions', 'grantRole', 'revokeRole', 'hasRole'];
  functions.forEach(fn => {
    if (!check.includes(fn)) {
      throw new Error(`Function ${fn} not found`);
    }
  });
});

// Test 15: Middleware Functions
console.log('\nTest 15: Middleware functions');
test('Fonctions middleware présentes', () => {
  const middleware = fs.readFileSync('src/middleware/rbac.ts', 'utf8');
  const functions = ['requirePermission', 'requireAnyPermission', 'requireAllPermissions', 'requireRole'];
  functions.forEach(fn => {
    if (!middleware.includes(fn)) {
      throw new Error(`Function ${fn} not found`);
    }
  });
});

// Test 16: Policy YAML
console.log('\nTest 16: Policy YAML content');
test('Policy content valide', () => {
  const yaml = fs.readFileSync('policies/rbac-policy-v1.yaml', 'utf8');
  if (!yaml.includes('version:')) throw new Error('Missing version');
  if (!yaml.includes('roles:')) throw new Error('Missing roles');
  if (!yaml.includes('permissions:')) throw new Error('Missing permissions');
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
