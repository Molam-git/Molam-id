// test_structure.js - Tests simples de structure (pas de WebAuthn réel)
import { existsSync } from 'fs';
import { join } from 'path';

console.log('🧪 Tests de structure - Brique 7 Biométrie\n');

let passed = 0;
let failed = 0;

// Test 1: Vérifier les fichiers SQL
console.log('Test 1: Fichiers SQL');
const sqlFile = 'sql/007_biometrics_core.sql';
if (existsSync(sqlFile)) {
  console.log('✅ PASS: Schéma SQL présent\n');
  passed++;
} else {
  console.log('❌ FAIL: Schéma SQL manquant\n');
  failed++;
}

// Test 2: Vérifier la structure du projet
console.log('Test 2: Structure du projet');
const requiredDirs = [
  'src/config',
  'src/util',
  'src/routes',
  'web/src/components',
  'web/src/utils',
  'mobile/ios',
  'mobile/android',
  'tests'
];

let dirsPassed = true;
for (const dir of requiredDirs) {
  if (!existsSync(dir)) {
    console.log(`❌ Répertoire manquant: ${dir}`);
    dirsPassed = false;
  }
}

if (dirsPassed) {
  console.log('✅ PASS: Structure des répertoires OK\n');
  passed++;
} else {
  console.log('❌ FAIL: Structure des répertoires incomplète\n');
  failed++;
}

// Test 3: Vérifier les fichiers source TypeScript
console.log('Test 3: Fichiers source TypeScript');
const requiredFiles = [
  'src/config/index.ts',
  'src/util/pg.ts',
  'src/util/redis.ts',
  'src/util/audit.ts',
  'src/util/sira.ts',
  'src/util/auth.ts',
  'src/util/rate.ts',
  'src/util/errors.ts',
  'src/util/webauthn.ts',
  'src/routes/biometrics.ts',
  'src/server.ts'
];

let filesPassed = true;
for (const file of requiredFiles) {
  if (!existsSync(file)) {
    console.log(`❌ Fichier manquant: ${file}`);
    filesPassed = false;
  }
}

if (filesPassed) {
  console.log('✅ PASS: Tous les fichiers source présents\n');
  passed++;
} else {
  console.log('❌ FAIL: Fichiers source manquants\n');
  failed++;
}

// Test 4: Vérifier les exemples frontend
console.log('Test 4: Exemples frontend');
const frontendFiles = [
  'web/src/utils/webauthn.ts',
  'web/src/components/BiometricsButton.tsx',
  'mobile/ios/BiometricsManager.swift',
  'mobile/android/BiometricsManager.kt'
];

let frontendPassed = true;
for (const file of frontendFiles) {
  if (!existsSync(file)) {
    console.log(`❌ Fichier frontend manquant: ${file}`);
    frontendPassed = false;
  }
}

if (frontendPassed) {
  console.log('✅ PASS: Exemples frontend présents\n');
  passed++;
} else {
  console.log('❌ FAIL: Exemples frontend manquants\n');
  failed++;
}

// Test 5: Vérifier la documentation
console.log('Test 5: Documentation');
const docFiles = [
  'README.md',
  'DEPLOYMENT.md',
  'CHANGELOG.md',
  '.env.example',
  'package.json',
  'tsconfig.json'
];

let docPassed = true;
for (const file of docFiles) {
  if (!existsSync(file)) {
    console.log(`❌ Documentation manquante: ${file}`);
    docPassed = false;
  }
}

if (docPassed) {
  console.log('✅ PASS: Documentation complète\n');
  passed++;
} else {
  console.log('❌ FAIL: Documentation incomplète\n');
  failed++;
}

// Test 6: Vérifier package.json
console.log('Test 6: Configuration package.json');
try {
  const pkg = JSON.parse(await import('fs').then(fs => fs.promises.readFile('package.json', 'utf-8')));

  const requiredDeps = [
    'express',
    'pg',
    'redis',
    '@simplewebauthn/server',
    'jsonwebtoken',
    'zod'
  ];

  let depsPassed = true;
  for (const dep of requiredDeps) {
    if (!pkg.dependencies || !pkg.dependencies[dep]) {
      console.log(`❌ Dépendance manquante: ${dep}`);
      depsPassed = false;
    }
  }

  if (depsPassed) {
    console.log('✅ PASS: Dépendances correctes\n');
    passed++;
  } else {
    console.log('❌ FAIL: Dépendances manquantes\n');
    failed++;
  }
} catch (err) {
  console.log('❌ FAIL: Erreur lecture package.json\n');
  failed++;
}

// Test 7: Vérifier les tests
console.log('Test 7: Fichiers de tests');
if (existsSync('tests/biometrics.test.ts')) {
  console.log('✅ PASS: Tests présents\n');
  passed++;
} else {
  console.log('❌ FAIL: Tests manquants\n');
  failed++;
}

// Test 8: Vérifier le SQL Schema
console.log('Test 8: Contenu du schéma SQL');
try {
  const sqlContent = await import('fs').then(fs => fs.promises.readFile('sql/007_biometrics_core.sql', 'utf-8'));

  const requiredTables = [
    'molam_devices',
    'molam_webauthn_credentials',
    'molam_biometric_prefs',
    'molam_auth_events'
  ];

  let tablesPassed = true;
  for (const table of requiredTables) {
    if (!sqlContent.includes(table)) {
      console.log(`❌ Table manquante dans SQL: ${table}`);
      tablesPassed = false;
    }
  }

  if (tablesPassed) {
    console.log('✅ PASS: Toutes les tables SQL présentes\n');
    passed++;
  } else {
    console.log('❌ FAIL: Tables SQL manquantes\n');
    failed++;
  }
} catch (err) {
  console.log('❌ FAIL: Erreur lecture SQL\n');
  failed++;
}

// Résumé
const total = passed + failed;
const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

console.log('═══════════════════════════════════════════════════════════');
console.log(`📊 Résumé: ${passed}/${total} tests réussis (${passRate}%)`);
console.log('═══════════════════════════════════════════════════════════');

if (passRate >= 75) {
  console.log('✅ Tests de structure RÉUSSIS');
  process.exit(0);
} else {
  console.log('❌ Tests de structure ÉCHOUÉS');
  process.exit(1);
}
