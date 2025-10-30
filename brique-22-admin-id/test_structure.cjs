/**
 * Structure tests for Brique 22 - Admin ID
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
  } catch (err) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${err.message}`);
    failed++;
  }
}

function fileExists(filepath) {
  if (!fs.existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }
}

function fileContains(filepath, content) {
  fileExists(filepath);
  const fileContent = fs.readFileSync(filepath, 'utf-8');
  if (!fileContent.includes(content)) {
    throw new Error(`File ${filepath} does not contain: ${content}`);
  }
}

function directoryExists(dirpath) {
  if (!fs.existsSync(dirpath) || !fs.statSync(dirpath).isDirectory()) {
    throw new Error(`Directory not found: ${dirpath}`);
  }
}

console.log('\n🧪 Tests de structure - Brique 22 Admin ID\n');

// Test 1: SQL Migration
console.log('Test 1: Fichiers SQL');
test('Schéma SQL présent', () => {
  fileExists('sql/022_admin_id.sql');
  fileContains('sql/022_admin_id.sql', 'molam_tenants');
  fileContains('sql/022_admin_id.sql', 'molam_tenant_modules');
  fileContains('sql/022_admin_id.sql', 'molam_policies');
  fileContains('sql/022_admin_id.sql', 'molam_emergency_locks');
  fileContains('sql/022_admin_id.sql', 'molam_key_registry');
  fileContains('sql/022_admin_id.sql', 'molam_admin_audit');
});

// Test 2: Project Structure
console.log('\nTest 2: Structure du projet');
test('Structure des répertoires OK', () => {
  directoryExists('src');
  directoryExists('src/admin');
  directoryExists('src/types');
  directoryExists('src/repo');
  directoryExists('src/crypto');
  directoryExists('src/routes');
  directoryExists('src/middleware');
  directoryExists('src/util');
  directoryExists('tests');
});

// Test 3: Type Definitions
console.log('\nTest 3: Définitions de types');
test('Fichier types présent', () => {
  fileExists('src/types/index.ts');
  fileContains('src/types/index.ts', 'TenantDTO');
  fileContains('src/types/index.ts', 'ModuleUpdateDTO');
  fileContains('src/types/index.ts', 'PolicyDTO');
  fileContains('src/types/index.ts', 'LockDTO');
});

// Test 4: Repository
console.log('\nTest 4: Repository');
test('Fichier repo index présent', () => {
  fileExists('src/repo/index.ts');
});
test('Fichier admin repo présent', () => {
  fileExists('src/admin/repo.ts');
  fileContains('src/admin/repo.ts', 'createTenant');
  fileContains('src/admin/repo.ts', 'updateTenantModule');
  fileContains('src/admin/repo.ts', 'upsertPolicy');
  fileContains('src/admin/repo.ts', 'createLock');
  fileContains('src/admin/repo.ts', 'registerKey');
});

// Test 5: Service Layer
console.log('\nTest 5: Service layer');
test('Fichier admin service présent', () => {
  fileExists('src/admin/service.ts');
  fileContains('src/admin/service.ts', 'svcCreateTenant');
  fileContains('src/admin/service.ts', 'svcUpdateModule');
  fileContains('src/admin/service.ts', 'svcUpsertPolicy');
  fileContains('src/admin/service.ts', 'svcCreateLock');
  fileContains('src/admin/service.ts', 'svcRotateKeys');
});

// Test 6: Crypto/Vault
console.log('\nTest 6: Crypto/Vault');
test('Fichier vault présent', () => {
  fileExists('src/crypto/vault.ts');
  fileContains('src/crypto/vault.ts', 'vaultRotateJwtKey');
});

// Test 7: Middleware
console.log('\nTest 7: Middleware');
test('Auth middleware présent', () => {
  fileExists('src/middleware/auth.ts');
  fileContains('src/middleware/auth.ts', 'authMiddleware');
});
test('Locks middleware présent', () => {
  fileExists('src/middleware/locks.ts');
  fileContains('src/middleware/locks.ts', 'checkEmergencyLocks');
});
test('Error middleware présent', () => {
  fileExists('src/middleware/error.ts');
  fileContains('src/middleware/error.ts', 'errorHandler');
});

// Test 8: Routes
console.log('\nTest 8: Routes');
test('Fichier admin routes présent', () => {
  fileExists('src/routes/admin.routes.ts');
  fileContains('src/routes/admin.routes.ts', '/v1/admin/tenants');
  fileContains('src/routes/admin.routes.ts', '/v1/admin/policies');
  fileContains('src/routes/admin.routes.ts', '/v1/admin/locks');
  fileContains('src/routes/admin.routes.ts', '/v1/admin/keys/rotate');
});

// Test 9: Utilities
console.log('\nTest 9: Fichiers utilitaires');
test('RBAC util présent', () => {
  fileExists('src/util/rbac.ts');
});
test('Redis util présent', () => {
  fileExists('src/util/redis.ts');
});
test('Kafka util présent', () => {
  fileExists('src/util/kafka.ts');
});

// Test 10: Server
console.log('\nTest 10: Server');
test('Fichier server.ts présent', () => {
  fileExists('src/server.ts');
  fileContains('src/server.ts', 'startServer');
  fileContains('src/server.ts', 'stopServer');
});

// Test 11: Tests
console.log('\nTest 11: Fichiers de tests');
test('Fichier de tests présent', () => {
  fileExists('tests/admin.test.ts');
});

// Test 12: Configuration
console.log('\nTest 12: Configuration');
test('Package.json présent', () => {
  fileExists('package.json');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  if (!pkg.name.includes('admin')) {
    throw new Error('Package name incorrect');
  }
});
test('TypeScript config présent', () => {
  fileExists('tsconfig.json');
});

// Test 13: SQL Functions
console.log('\nTest 13: Fonctions SQL');
test('Fonctions SQL présentes', () => {
  fileContains('sql/022_admin_id.sql', 'is_locked');
  fileContains('sql/022_admin_id.sql', 'get_policy_value');
  fileContains('sql/022_admin_id.sql', 'cleanup_expired_locks');
});

// Test 14: Views
console.log('\nTest 14: Vues SQL');
test('Vues SQL présentes', () => {
  fileContains('sql/022_admin_id.sql', 'v_active_locks');
  fileContains('sql/022_admin_id.sql', 'v_tenant_modules_overview');
  fileContains('sql/022_admin_id.sql', 'v_active_keys');
});

// Summary
console.log('\n═══════════════════════════════════════════════════════════');
console.log(`📊 Résumé: ${passed}/${passed + failed} tests réussis (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log('═══════════════════════════════════════════════════════════');

if (failed > 0) {
  console.log('❌ Tests de structure ÉCHOUÉS');
  process.exit(1);
} else {
  console.log('✅ Tests de structure RÉUSSIS');
  process.exit(0);
}
