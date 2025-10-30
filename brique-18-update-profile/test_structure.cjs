#!/usr/bin/env node
/**
 * Tests de structure pour Brique 18 - Update Profile
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

console.log('🧪 Tests de structure - Brique 18 Update Profile\n');

// Test 1: SQL
console.log('Test 1: Fichiers SQL');
test('Schéma SQL présent', () => {
  fileExists('sql/018_update_profile.sql');
});

test('Hotfix SQL présent', () => {
  fileExists('sql/hotfix_signup_login_required.sql');
});

// Test 2: Structure
console.log('\nTest 2: Structure du projet');
test('Structure des répertoires OK', () => {
  dirExists('src');
  dirExists('src/util');
  dirExists('src/routes');
  dirExists('tests');
  dirExists('k8s');
  dirExists('sql');
});

// Test 3: Utilities
console.log('\nTest 3: Fichiers utilitaires');
test('Tous les fichiers utilitaires présents', () => {
  fileExists('src/util/pg.ts');
  fileExists('src/util/redis.ts');
  fileExists('src/util/auth.ts');
  fileExists('src/util/rbac.ts');
  fileExists('src/util/phone.ts');
  fileExists('src/util/events.ts');
  fileExists('src/util/errors.ts');
});

// Test 4: Routes
console.log('\nTest 4: Fichiers de routes');
test('Tous les fichiers de routes présents', () => {
  fileExists('src/routes/prefs.ts');
  fileExists('src/routes/contacts.ts');
});

// Test 5: Server
console.log('\nTest 5: Server');
test('Fichier server.ts présent', () => {
  fileExists('src/server.ts');
});

// Test 6: Tests
console.log('\nTest 6: Fichiers de tests');
test('Tous les fichiers de tests présents', () => {
  fileExists('tests/prefs.test.ts');
  fileExists('tests/contacts.test.ts');
  fileExists('tests/hotfix.test.ts');
});

// Test 7: Documentation
console.log('\nTest 7: Documentation');
test('Documentation complète', () => {
  fileExists('README.md');
  fileExists('.env.example');
  fileExists('package.json');
  fileExists('tsconfig.json');
});

// Test 8: Package.json
console.log('\nTest 8: Configuration package.json');
test('Dépendances correctes', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.dependencies) throw new Error('No dependencies');
  if (!pkg.dependencies.express) throw new Error('Missing express');
  if (!pkg.dependencies.pg) throw new Error('Missing pg');
  if (!pkg.dependencies.redis) throw new Error('Missing redis');
  if (!pkg.dependencies.zod) throw new Error('Missing zod');
  if (!pkg.dependencies['libphonenumber-js']) throw new Error('Missing libphonenumber-js');
});

// Test 9: SQL Content - Main Schema
console.log('\nTest 9: Contenu du schéma SQL principal');
test('Tables et colonnes présentes', () => {
  const sql = fs.readFileSync('sql/018_update_profile.sql', 'utf8');
  const elements = [
    'preferred_language',
    'preferred_currency',
    'timezone',
    'date_format',
    'number_format',
    'notify_email',
    'notify_sms',
    'notify_push',
    'theme',
    'molam_user_contacts',
    'channel_type',
    'channel_value',
    'contact_user_id'
  ];
  elements.forEach(elem => {
    if (!sql.includes(elem)) {
      throw new Error(`Element ${elem} not found`);
    }
  });
});

// Test 10: SQL Content - Hotfix
console.log('\nTest 10: Contenu du hotfix SQL');
test('Contraintes signup/login présentes', () => {
  const sql = fs.readFileSync('sql/hotfix_signup_login_required.sql', 'utf8');
  const elements = [
    'chk_user_primary_identifier',
    'chk_user_password_required',
    'auth_mode',
    'molam_feature_flags',
    'ENFORCE_IDENTITY_STRICT'
  ];
  elements.forEach(elem => {
    if (!sql.includes(elem)) {
      throw new Error(`Element ${elem} not found`);
    }
  });
});

// Test 11: Phone Utility
console.log('\nTest 11: Phone normalization utility');
test('Fonctions de normalisation présentes', () => {
  const phone = fs.readFileSync('src/util/phone.ts', 'utf8');
  const functions = ['normalizePhoneE164', 'iso3ToIso2', 'iso2ToIso3', 'isValidE164'];
  functions.forEach(fn => {
    if (!phone.includes(`function ${fn}`) && !phone.includes(`export function ${fn}`)) {
      throw new Error(`Function ${fn} not found`);
    }
  });
});

// Test 12: Events Utility
console.log('\nTest 12: Events utility');
test('Fonctions d\'événements présentes', () => {
  const events = fs.readFileSync('src/util/events.ts', 'utf8');
  const functions = ['publishDomainEvent', 'emitProfileUpdated', 'emitContactAdded', 'emitContactDeleted'];
  functions.forEach(fn => {
    if (!events.includes(fn)) {
      throw new Error(`Function ${fn} not found`);
    }
  });
});

// Test 13: RBAC Utility
console.log('\nTest 13: RBAC utility');
test('Fonctions RBAC présentes', () => {
  const rbac = fs.readFileSync('src/util/rbac.ts', 'utf8');
  const functions = ['canUpdateProfile', 'hasPermission', 'isSubsidiaryScopedAdmin'];
  functions.forEach(fn => {
    if (!rbac.includes(fn)) {
      throw new Error(`Function ${fn} not found`);
    }
  });
});

// Test 14: Preferences Routes
console.log('\nTest 14: Preferences routes');
test('Routes de préférences présentes', () => {
  const prefs = fs.readFileSync('src/routes/prefs.ts', 'utf8');
  const routes = ['/v1/profile/prefs', '/v1/admin/prefs'];
  routes.forEach(route => {
    if (!prefs.includes(route)) {
      throw new Error(`Route ${route} not found`);
    }
  });
});

// Test 15: Contacts Routes
console.log('\nTest 15: Contacts routes');
test('Routes de contacts présentes', () => {
  const contacts = fs.readFileSync('src/routes/contacts.ts', 'utf8');
  const routes = ['/v1/profile/contacts'];
  routes.forEach(route => {
    if (!contacts.includes(route)) {
      throw new Error(`Route ${route} not found`);
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
