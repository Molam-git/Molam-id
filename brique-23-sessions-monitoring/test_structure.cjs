const fs = require('fs');
let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); console.log(`✅ PASS: ${name}`); passed++; }
  catch (err) { console.log(`❌ FAIL: ${name}\n   ${err.message}`); failed++; }
}

function fileExists(f) {
  if (!fs.existsSync(f)) throw new Error(`File not found: ${f}`);
}

function fileContains(f, c) {
  fileExists(f);
  if (!fs.readFileSync(f, 'utf-8').includes(c)) throw new Error(`${f} missing: ${c}`);
}

console.log('\n🧪 Tests de structure - Brique 23 Sessions Monitoring\n');

console.log('Test 1: SQL');
test('SQL migration présent', () => {
  fileExists('sql/023_sessions_monitoring.sql');
  fileContains('sql/023_sessions_monitoring.sql', 'molam_sessions_active');
  fileContains('sql/023_sessions_monitoring.sql', 'molam_session_anomalies');
});

console.log('\nTest 2: Structure');
test('Répertoires présents', () => {
  ['src', 'src/sessions', 'src/routes', 'tests'].forEach(d => {
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) throw new Error(`Missing: ${d}`);
  });
});

console.log('\nTest 3: Types');
test('Types définis', () => {
  fileExists('src/types/index.ts');
  fileContains('src/types/index.ts', 'SessionRecord');
});

console.log('\nTest 4: Repository');
test('Repo présent', () => {
  fileExists('src/sessions/repo.ts');
  fileContains('src/sessions/repo.ts', 'listUserSessions');
  fileContains('src/sessions/repo.ts', 'terminateSession');
});

console.log('\nTest 5: Routes');
test('Routes présentes', () => {
  fileExists('src/routes/sessions.routes.ts');
  fileContains('src/routes/sessions.routes.ts', '/sessions/active');
});

console.log('\nTest 6: Config');
test('Configuration OK', () => {
  fileExists('package.json');
  fileExists('tsconfig.json');
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`📊 Résumé: ${passed}/${passed + failed} tests réussis (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log('═══════════════════════════════════════════════════════════');

if (failed > 0) {
  console.log('❌ Tests ÉCHOUÉS');
  process.exit(1);
} else {
  console.log('✅ Tests RÉUSSIS');
  process.exit(0);
}
