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

console.log('\n🧪 Tests de structure - Brique 24 SDK Auth\n');

console.log('Test 1: SQL');
test('SQL migration présent', () => {
  fileExists('sql/024_sdk_auth.sql');
  fileContains('sql/024_sdk_auth.sql', 'molam_sdk_clients');
  fileContains('sql/024_sdk_auth.sql', 'molam_refresh_tokens');
});

console.log('\nTest 2: SDK JavaScript/TypeScript');
test('SDK JS présent', () => {
  fileExists('sdk/js/molam-auth.ts');
  fileContains('sdk/js/molam-auth.ts', 'export class MolamAuth');
  fileContains('sdk/js/molam-auth.ts', 'async login');
  fileContains('sdk/js/molam-auth.ts', 'async refresh');
  fileContains('sdk/js/molam-auth.ts', 'async logout');
});

test('Package.json SDK JS', () => {
  fileExists('sdk/js/package.json');
  fileContains('sdk/js/package.json', '@molam/auth');
});

console.log('\nTest 3: SDK iOS (Swift)');
test('SDK iOS présent', () => {
  fileExists('sdk/ios/MolamAuth.swift');
  fileContains('sdk/ios/MolamAuth.swift', 'public class MolamAuth');
  fileContains('sdk/ios/MolamAuth.swift', 'func login');
  fileContains('sdk/ios/MolamAuth.swift', 'func refresh');
  fileContains('sdk/ios/MolamAuth.swift', 'func logout');
});

test('Podspec iOS', () => {
  fileExists('sdk/ios/MolamAuth.podspec');
  fileContains('sdk/ios/MolamAuth.podspec', 'MolamAuth');
});

console.log('\nTest 4: SDK Android (Kotlin)');
test('SDK Android présent', () => {
  fileExists('sdk/android/MolamAuth.kt');
  fileContains('sdk/android/MolamAuth.kt', 'class MolamAuth');
  fileContains('sdk/android/MolamAuth.kt', 'suspend fun login');
  fileContains('sdk/android/MolamAuth.kt', 'suspend fun refresh');
  fileContains('sdk/android/MolamAuth.kt', 'suspend fun logout');
});

test('Build.gradle Android', () => {
  fileExists('sdk/android/build.gradle');
  fileContains('sdk/android/build.gradle', 'com.molam.auth');
});

console.log('\nTest 5: Security');
test('Secure storage présent dans SDK JS', () => {
  fileContains('sdk/js/molam-auth.ts', 'localStorage');
  fileContains('sdk/js/molam-auth.ts', 'sessionStorage');
});

test('Keychain présent dans SDK iOS', () => {
  fileContains('sdk/ios/MolamAuth.swift', 'Keychain');
  fileContains('sdk/ios/MolamAuth.swift', 'kSecClass');
});

test('EncryptedSharedPreferences présent dans SDK Android', () => {
  fileContains('sdk/android/MolamAuth.kt', 'EncryptedSharedPreferences');
  fileContains('sdk/android/MolamAuth.kt', 'AES256_GCM');
});

console.log('\nTest 6: Auto-refresh');
test('Auto-refresh présent dans SDK JS', () => {
  fileContains('sdk/js/molam-auth.ts', 'scheduleRefresh');
  fileContains('sdk/js/molam-auth.ts', 'autoRefresh');
});

test('Auto-refresh présent dans SDK iOS', () => {
  fileContains('sdk/ios/MolamAuth.swift', 'scheduleRefresh');
});

test('Auto-refresh présent dans SDK Android', () => {
  fileContains('sdk/android/MolamAuth.kt', 'scheduleRefresh');
});

console.log('\nTest 7: Documentation');
test('README présent', () => {
  fileExists('README.md');
  fileContains('README.md', 'Molam Auth SDK');
  fileContains('README.md', 'JavaScript/TypeScript');
  fileContains('README.md', 'iOS (Swift)');
  fileContains('README.md', 'Android (Kotlin)');
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`📊 Résumé: ${passed}/${passed + failed} tests réussis (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log('═══════════════════════════════════════════════════════════');

if (failed > 0) {
  console.log('❌ Tests ÉCHOUÉS');
  process.exit(1);
} else {
  console.log('✅ Tests de structure RÉUSSIS');
  process.exit(0);
}
