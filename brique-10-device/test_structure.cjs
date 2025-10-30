#!/usr/bin/env node
/**
 * Tests de structure pour Brique 10 - Device Fingerprint
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

console.log('🧪 Tests de structure - Brique 10 Device Fingerprint\n');

// Test 1: Fichiers SQL
console.log('Test 1: Fichiers SQL');
test('Schéma SQL présent', () => {
  fileExists('sql/010_device.sql');
});

// Test 2: Structure du projet
console.log('\nTest 2: Structure du projet');
test('Structure des répertoires OK', () => {
  dirExists('src');
  dirExists('src/device');
  dirExists('sql');
  dirExists('tests');
});

// Test 3: Fichiers source
console.log('\nTest 3: Fichiers source JavaScript');
test('Tous les fichiers source présents', () => {
  fileExists('src/server.js');
  fileExists('src/device/config.js');
  fileExists('src/device/hash.js');
  fileExists('src/device/attest.js');
  fileExists('src/device/routes.js');
  fileExists('src/device/repo.js');
});

// Test 4: Documentation
console.log('\nTest 4: Documentation');
test('Documentation complète', () => {
  fileExists('README.md');
  fileExists('.env.example');
  fileExists('package.json');
});

// Test 5: Configuration package.json
console.log('\nTest 5: Configuration package.json');
test('Dépendances correctes', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.dependencies) throw new Error('No dependencies');
  if (!pkg.dependencies.express) throw new Error('Missing express');
  if (!pkg.dependencies.pg) throw new Error('Missing pg');
});

// Test 6: Fichiers de tests
console.log('\nTest 6: Fichiers de tests');
test('Tests présents', () => {
  fileExists('test_brique10.js');
  dirExists('tests');
});

// Test 7: Contenu du schéma SQL
console.log('\nTest 7: Contenu du schéma SQL');
test('Toutes les tables SQL présentes', () => {
  const sql = fs.readFileSync('sql/010_device.sql', 'utf8');
  const tables = [
    'molam_devices',
    'molam_device_bindings',
    'molam_device_attestations',
    'molam_device_events'
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
