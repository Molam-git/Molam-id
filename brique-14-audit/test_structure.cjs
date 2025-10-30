#!/usr/bin/env node
/**
 * Tests de structure pour Brique 14 - Audit logs centralisés
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

console.log('🧪 Tests de structure - Brique 14 Audit logs centralisés\n');

// Test 1: Fichiers SQL
console.log('Test 1: Fichiers SQL');
test('Schéma SQL présent', () => {
  fileExists('sql/014_audit_logs.sql');
});

// Test 2: Structure du projet
console.log('\nTest 2: Structure du projet');
test('Structure des répertoires OK', () => {
  dirExists('src');
  dirExists('src/audit');
  dirExists('src/util');
  dirExists('src/middleware');
  dirExists('src/jobs');
  dirExists('tests');
  dirExists('k8s');
  dirExists('sql');
});

// Test 3: Fichiers source TypeScript
console.log('\nTest 3: Fichiers source TypeScript');
test('Tous les fichiers source présents', () => {
  fileExists('src/audit/config.ts');
  fileExists('src/audit/audit.service.ts');
  fileExists('src/audit/audit.routes.ts');
  fileExists('src/util/pg.ts');
  fileExists('src/util/redis.ts');
  fileExists('src/util/auth.ts');
  fileExists('src/util/errors.ts');
  fileExists('src/middleware/auditLogger.ts');
  fileExists('src/jobs/audit-archive.ts');
  fileExists('src/jobs/audit-kafka.ts');
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
  if (!pkg.dependencies['@aws-sdk/client-s3']) throw new Error('Missing @aws-sdk/client-s3');
  if (!pkg.dependencies.kafkajs) throw new Error('Missing kafkajs');
  if (!pkg.dependencies['node-cron']) throw new Error('Missing node-cron');
});

// Test 6: Fichiers de tests
console.log('\nTest 6: Fichiers de tests');
test('Tests présents', () => {
  fileExists('tests/audit.test.ts');
  dirExists('tests');
});

// Test 7: Contenu du schéma SQL
console.log('\nTest 7: Contenu du schéma SQL');
test('Table principale et partitionnement', () => {
  const sql = fs.readFileSync('sql/014_audit_logs.sql', 'utf8');
  if (!sql.includes('molam_audit_logs')) {
    throw new Error('Table molam_audit_logs not found');
  }
  if (!sql.includes('PARTITION BY RANGE')) {
    throw new Error('Partitioning not found');
  }
});

// Test 8: Fonctions d'immutabilité
console.log('\nTest 8: Fonctions d\'immutabilité');
test('Triggers et fonctions d\'immutabilité présents', () => {
  const sql = fs.readFileSync('sql/014_audit_logs.sql', 'utf8');
  const functions = [
    'f_audit_no_update',
    'f_audit_compute_hash',
    'verify_audit_chain'
  ];
  functions.forEach(fn => {
    if (!sql.includes(fn)) {
      throw new Error(`Function ${fn} not found`);
    }
  });
});

// Test 9: Row Level Security
console.log('\nTest 9: Row Level Security');
test('RLS activé avec politiques', () => {
  const sql = fs.readFileSync('sql/014_audit_logs.sql', 'utf8');
  if (!sql.includes('ENABLE ROW LEVEL SECURITY')) {
    throw new Error('RLS not enabled');
  }
  if (!sql.includes('CREATE POLICY')) {
    throw new Error('No policies found');
  }
});

// Test 10: Index de performance
console.log('\nTest 10: Index de performance');
test('Index optimisés présents', () => {
  const sql = fs.readFileSync('sql/014_audit_logs.sql', 'utf8');
  const indexes = [
    'idx_audit_module_created',
    'idx_audit_actor',
    'idx_audit_resource',
    'idx_audit_gin_redacted'
  ];
  indexes.forEach(idx => {
    if (!sql.includes(idx)) {
      throw new Error(`Index ${idx} not found`);
    }
  });
});

// Test 11: Service TypeScript
console.log('\nTest 11: Service TypeScript');
test('Méthodes principales du service', () => {
  const service = fs.readFileSync('src/audit/audit.service.ts', 'utf8');
  const methods = ['append', 'appendBatch', 'search', 'verifyChain', 'getLogsForExport'];
  methods.forEach(method => {
    if (!service.includes(`async ${method}`)) {
      throw new Error(`Method ${method} not found`);
    }
  });
});

// Test 12: Chaînage cryptographique
console.log('\nTest 12: Chaînage cryptographique');
test('Logique de chaînage présente', () => {
  const service = fs.readFileSync('src/audit/audit.service.ts', 'utf8');
  if (!service.includes('getPrevHash')) {
    throw new Error('getPrevHash method not found');
  }
  if (!service.includes('prev_hash')) {
    throw new Error('prev_hash usage not found');
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
