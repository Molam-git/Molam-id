#!/usr/bin/env node
const fs = require('fs');
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ FAIL: ${name} - ${error.message}`);
    failed++;
  }
}

console.log('🧪 Tests de structure - Brique 16 FX\n');

test('SQL schema présent', () => {
  if (!fs.existsSync('sql/016_fx.sql')) throw new Error('Not found');
});

test('Structure répertoires OK', () => {
  ['src', 'sql', 'tests', 'k8s', 'packages/sdk-fx/src'].forEach(d => {
    if (!fs.existsSync(d)) throw new Error(`Dir ${d} not found`);
  });
});

test('Documentation complète', () => {
  if (!fs.existsSync('README.md')) throw new Error('README missing');
  if (!fs.existsSync('.env.example')) throw new Error('.env.example missing');
});

test('SQL tables présentes', () => {
  const sql = fs.readFileSync('sql/016_fx.sql', 'utf8');
  ['fx_currencies', 'fx_rates', 'fx_sources', 'fx_convert_audit'].forEach(t => {
    if (!sql.includes(t)) throw new Error(`Table ${t} missing`);
  });
});

console.log(`\n📊 Résumé: ${passed}/${passed+failed} tests réussis`);
process.exit(failed === 0 ? 0 : 1);
