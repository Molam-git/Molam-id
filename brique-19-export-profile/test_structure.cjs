#!/usr/bin/env node
/**
 * Tests de structure pour Brique 19 - Export Profile
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

console.log('🧪 Tests de structure - Brique 19 Export Profile\n');

// Test 1: SQL
console.log('Test 1: Fichiers SQL');
test('Schéma SQL présent', () => {
  fileExists('sql/019_export_profile.sql');
});

// Test 2: Structure
console.log('\nTest 2: Structure du projet');
test('Structure des répertoires OK', () => {
  dirExists('src');
  dirExists('src/util');
  dirExists('src/routes');
  dirExists('src/workers');
  dirExists('tests');
  dirExists('k8s');
  dirExists('sql');
});

// Test 3: Utilities
console.log('\nTest 3: Fichiers utilitaires');
test('Tous les fichiers utilitaires présents', () => {
  fileExists('src/util/pg.ts');
  fileExists('src/util/storage.ts');
  fileExists('src/util/auth.ts');
  fileExists('src/util/events.ts');
  fileExists('src/util/i18n.ts');
  fileExists('src/util/pdf.ts');
  fileExists('src/util/time.ts');
});

// Test 4: Routes
console.log('\nTest 4: Fichiers de routes');
test('Fichier export routes présent', () => {
  fileExists('src/routes/export.ts');
});

// Test 5: Worker
console.log('\nTest 5: Worker');
test('Fichier exportWorker présent', () => {
  fileExists('src/workers/exportWorker.ts');
});

// Test 6: Server
console.log('\nTest 6: Server');
test('Fichier server.ts présent', () => {
  fileExists('src/server.ts');
});

// Test 7: Tests
console.log('\nTest 7: Fichiers de tests');
test('Fichier de tests présent', () => {
  fileExists('tests/export.test.ts');
});

// Test 8: Documentation
console.log('\nTest 8: Documentation');
test('Documentation complète', () => {
  fileExists('README.md');
  fileExists('.env.example');
  fileExists('package.json');
  fileExists('tsconfig.json');
});

// Test 9: Package.json
console.log('\nTest 9: Configuration package.json');
test('Dépendances correctes', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.dependencies) throw new Error('No dependencies');
  if (!pkg.dependencies.express) throw new Error('Missing express');
  if (!pkg.dependencies.pg) throw new Error('Missing pg');
  if (!pkg.dependencies.pdfkit) throw new Error('Missing pdfkit');
  if (!pkg.dependencies['@aws-sdk/client-s3']) throw new Error('Missing @aws-sdk/client-s3');
  if (!pkg.dependencies['@aws-sdk/s3-request-presigner']) throw new Error('Missing @aws-sdk/s3-request-presigner');
});

// Test 10: SQL Content
console.log('\nTest 10: Contenu du schéma SQL');
test('Tables et vues présentes', () => {
  const sql = fs.readFileSync('sql/019_export_profile.sql', 'utf8');
  const elements = [
    'molam_exports',
    'v_export_user_profile',
    'v_export_user_contacts',
    'v_export_id_events',
    'v_export_user_sessions',
    'get_export_data',
    'can_request_export',
    'cleanup_old_exports'
  ];
  elements.forEach(elem => {
    if (!sql.includes(elem)) {
      throw new Error(`Element ${elem} not found`);
    }
  });
});

// Test 11: Storage Utility
console.log('\nTest 11: Storage utility');
test('Fonctions de storage présentes', () => {
  const storage = fs.readFileSync('src/util/storage.ts', 'utf8');
  const functions = ['putObject', 'signDownloadUrl', 'deleteObject', 'initS3', 'healthCheckS3'];
  functions.forEach(fn => {
    if (!storage.includes(`function ${fn}`) && !storage.includes(`export function ${fn}`) && !storage.includes(`export async function ${fn}`)) {
      throw new Error(`Function ${fn} not found`);
    }
  });
});

// Test 12: PDF Utility
console.log('\nTest 12: PDF utility');
test('Fonctions de PDF présentes', () => {
  const pdf = fs.readFileSync('src/util/pdf.ts', 'utf8');
  const functions = ['renderPdfBuffer'];
  functions.forEach(fn => {
    if (!pdf.includes(fn)) {
      throw new Error(`Function ${fn} not found`);
    }
  });
});

// Test 13: i18n Utility
console.log('\nTest 13: i18n utility');
test('Fonctions i18n présentes', () => {
  const i18n = fs.readFileSync('src/util/i18n.ts', 'utf8');
  const functions = ['getUserLocale', 'isRTL', 'getSupportedLocales'];
  const locales = ['fr', 'en', 'ar', 'wo', 'pt', 'es'];

  functions.forEach(fn => {
    if (!i18n.includes(fn)) {
      throw new Error(`Function ${fn} not found`);
    }
  });

  locales.forEach(locale => {
    if (!i18n.includes(locale + ':')) {
      throw new Error(`Locale ${locale} not found`);
    }
  });
});

// Test 14: Export Routes
console.log('\nTest 14: Export routes');
test('Routes d\'export présentes', () => {
  const routes = fs.readFileSync('src/routes/export.ts', 'utf8');
  const endpoints = ['/v1/profile/export'];
  endpoints.forEach(endpoint => {
    if (!routes.includes(endpoint)) {
      throw new Error(`Route ${endpoint} not found`);
    }
  });
});

// Test 15: Export Worker
console.log('\nTest 15: Export worker');
test('Fonctions du worker présentes', () => {
  const worker = fs.readFileSync('src/workers/exportWorker.ts', 'utf8');
  const functions = ['processExportJob', 'pollExports', 'startExportWorker', 'fetchExportData'];
  functions.forEach(fn => {
    if (!worker.includes(fn)) {
      throw new Error(`Function ${fn} not found`);
    }
  });
});

// Test 16: Kubernetes
console.log('\nTest 16: Kubernetes deployment');
test('Fichier deployment.yaml présent', () => {
  fileExists('k8s/deployment.yaml');
  const yaml = fs.readFileSync('k8s/deployment.yaml', 'utf8');
  if (!yaml.includes('id-export-profile')) {
    throw new Error('Deployment name not found');
  }
  if (!yaml.includes('3019')) {
    throw new Error('Port 3019 not found');
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
