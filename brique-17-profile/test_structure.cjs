#!/usr/bin/env node
const fs = require('fs');
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ FAIL: ${name} - ${e.message}`);
    failed++;
  }
}

console.log('🧪 Tests Brique 17 - Profil\n');

test('SQL schema présent', () => {
  if (!fs.existsSync('sql/017_profile.sql')) throw new Error('Not found');
});

test('Tables SQL présentes', () => {
  const sql = fs.readFileSync('sql/017_profile.sql', 'utf8');
  ['molam_profiles', 'molam_profile_events'].forEach(t => {
    if (!sql.includes(t)) throw new Error(`Table ${t} missing`);
  });
});

test('Routes présentes', () => {
  if (!fs.existsSync('src/profile/profile.routes.ts')) throw new Error('Not found');
});

test('Storage S3 présent', () => {
  if (!fs.existsSync('src/util/storage.ts')) throw new Error('Not found');
});

test('Documentation OK', () => {
  if (!fs.existsSync('README.md')) throw new Error('Missing');
});

console.log(`\n📊 Résumé: ${passed}/${passed+failed} tests réussis`);
process.exit(failed === 0 ? 0 : 1);
