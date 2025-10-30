/**
 * Structure tests for Brique 21 - Role Management
 * Validates project structure, files, and key implementations
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

console.log('\n🧪 Tests de structure - Brique 21 Role Management\n');

// Test 1: SQL Migration Files
console.log('Test 1: Fichiers SQL');
test('Schéma SQL présent', () => {
  fileExists('sql/021_role_mgmt.sql');
});

// Test 2: Project Structure
console.log('\nTest 2: Structure du projet');
test('Structure des répertoires OK', () => {
  directoryExists('src');
  directoryExists('src/types');
  directoryExists('src/repo');
  directoryExists('src/services');
  directoryExists('src/routes');
  directoryExists('src/middleware');
  directoryExists('src/util');
  directoryExists('tests');
});

// Test 3: Type Definitions
console.log('\nTest 3: Définitions de types');
test('Fichier types présent', () => {
  fileExists('src/types/index.ts');
  fileContains('src/types/index.ts', 'ModuleScope');
  fileContains('src/types/index.ts', 'RoleDTO');
  fileContains('src/types/index.ts', 'GrantDTO');
  fileContains('src/types/index.ts', 'ApprovalDTO');
});

// Test 4: Repository Layer
console.log('\nTest 4: Repository layer');
test('Fichier repo index présent', () => {
  fileExists('src/repo/index.ts');
  fileContains('src/repo/index.ts', 'initPool');
  fileContains('src/repo/index.ts', 'query');
});
test('Fichier roles repo présent', () => {
  fileExists('src/repo/roles.repo.ts');
  fileContains('src/repo/roles.repo.ts', 'upsertRole');
  fileContains('src/repo/roles.repo.ts', 'addGrant');
  fileContains('src/repo/roles.repo.ts', 'revokeGrant');
});
test('Fichier Redis présent', () => {
  fileExists('src/repo/redis.ts');
  fileContains('src/repo/redis.ts', 'invalidateUserCache');
});

// Test 5: Services
console.log('\nTest 5: Services');
test('Service idempotency présent', () => {
  fileExists('src/services/idempotency.ts');
  fileContains('src/services/idempotency.ts', 'withIdempotency');
});
test('Service roles présent', () => {
  fileExists('src/services/roles.service.ts');
  fileContains('src/services/roles.service.ts', 'createOrUpdateRole');
  fileContains('src/services/roles.service.ts', 'grantRole');
  fileContains('src/services/roles.service.ts', 'revokeRole');
  fileContains('src/services/roles.service.ts', 'approveGrant');
});

// Test 6: Middleware
console.log('\nTest 6: Middleware');
test('Auth middleware présent', () => {
  fileExists('src/middleware/auth.ts');
  fileContains('src/middleware/auth.ts', 'authMiddleware');
});
test('RBAC middleware présent', () => {
  fileExists('src/middleware/rbac.ts');
  fileContains('src/middleware/rbac.ts', 'requirePermission');
});
test('Error middleware présent', () => {
  fileExists('src/middleware/error.ts');
  fileContains('src/middleware/error.ts', 'errorHandler');
});

// Test 7: Routes
console.log('\nTest 7: Routes');
test('Fichier routes présent', () => {
  fileExists('src/routes/roles.routes.ts');
  fileContains('src/routes/roles.routes.ts', '/v1/roles');
  fileContains('src/routes/roles.routes.ts', '/v1/roles/grants');
  fileContains('src/routes/roles.routes.ts', '/v1/roles/grants/revoke');
  fileContains('src/routes/roles.routes.ts', '/v1/roles/grants/approve');
});

// Test 8: Utilities
console.log('\nTest 8: Fichiers utilitaires');
test('Kafka util présent', () => {
  fileExists('src/util/kafka.ts');
  fileContains('src/util/kafka.ts', 'publish');
});
test('RBAC util présent', () => {
  fileExists('src/util/rbac.ts');
  fileContains('src/util/rbac.ts', 'checkPermission');
});

// Test 9: Server
console.log('\nTest 9: Server');
test('Fichier server.ts présent', () => {
  fileExists('src/server.ts');
  fileContains('src/server.ts', 'startServer');
  fileContains('src/server.ts', 'stopServer');
});

// Test 10: Tests
console.log('\nTest 10: Fichiers de tests');
test('Fichier de tests présent', () => {
  fileExists('tests/roles.test.ts');
  fileContains('tests/roles.test.ts', 'Role Management');
});

// Test 11: Configuration
console.log('\nTest 11: Configuration');
test('Package.json présent', () => {
  fileExists('package.json');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  if (!pkg.name.includes('role-mgmt')) {
    throw new Error('Package name incorrect');
  }
  if (!pkg.dependencies.express) {
    throw new Error('Express dependency missing');
  }
  if (!pkg.dependencies.pg) {
    throw new Error('PostgreSQL dependency missing');
  }
  if (!pkg.dependencies.redis) {
    throw new Error('Redis dependency missing');
  }
  if (!pkg.dependencies.zod) {
    throw new Error('Zod dependency missing');
  }
});
test('TypeScript config présent', () => {
  fileExists('tsconfig.json');
});

// Test 12: SQL Schema Content
console.log('\nTest 12: Contenu du schéma SQL');
test('Tables présentes dans migration', () => {
  fileContains('sql/021_role_mgmt.sql', 'molam_role_grants_approvals');
  fileContains('sql/021_role_mgmt.sql', 'molam_idempotency_keys');
  fileContains('sql/021_role_mgmt.sql', 'trusted_level');
});
test('Fonctions de garde présentes', () => {
  fileContains('sql/021_role_mgmt.sql', 'can_manage_scope');
  fileContains('sql/021_role_mgmt.sql', 'has_higher_trust');
  fileContains('sql/021_role_mgmt.sql', 'check_self_elevation');
});
test('Vues présentes', () => {
  fileContains('sql/021_role_mgmt.sql', 'v_user_roles');
  fileContains('sql/021_role_mgmt.sql', 'v_pending_role_approvals');
});

// Test 13: Service Functions
console.log('\nTest 13: Fonctions de service');
test('Toutes les fonctions de service présentes', () => {
  const serviceFile = fs.readFileSync('src/services/roles.service.ts', 'utf-8');
  const requiredFunctions = [
    'createOrUpdateRole',
    'grantRole',
    'revokeRole',
    'approveGrant',
    'listAllRoles',
    'getRole',
  ];
  requiredFunctions.forEach((fn) => {
    if (!serviceFile.includes(`export async function ${fn}`)) {
      throw new Error(`Function ${fn} not found`);
    }
  });
});

// Test 14: Repository Functions
console.log('\nTest 14: Fonctions de repository');
test('Toutes les fonctions de repo présentes', () => {
  const repoFile = fs.readFileSync('src/repo/roles.repo.ts', 'utf-8');
  const requiredFunctions = [
    'upsertRole',
    'getRoleById',
    'addGrant',
    'revokeGrant',
    'canManageScope',
    'hasHigherTrust',
    'createApprovalRequest',
    'getApprovalRequest',
    'updateApprovalStatus',
  ];
  requiredFunctions.forEach((fn) => {
    if (!repoFile.includes(`export async function ${fn}`)) {
      throw new Error(`Function ${fn} not found`);
    }
  });
});

// Test 15: Middleware Functions
console.log('\nTest 15: Fonctions middleware');
test('Toutes les fonctions middleware présentes', () => {
  const authFile = fs.readFileSync('src/middleware/auth.ts', 'utf-8');
  const rbacFile = fs.readFileSync('src/middleware/rbac.ts', 'utf-8');

  if (!authFile.includes('export function authMiddleware')) {
    throw new Error('authMiddleware not found');
  }
  if (!rbacFile.includes('export function requirePermission')) {
    throw new Error('requirePermission not found');
  }
});

// Test 16: API Routes
console.log('\nTest 16: Routes API');
test('Tous les endpoints présents', () => {
  const routesFile = fs.readFileSync('src/routes/roles.routes.ts', 'utf-8');
  const requiredEndpoints = [
    "'/v1/roles'",
    "'/v1/roles/:id'",
    "'/v1/roles/grants'",
    "'/v1/roles/grants/revoke'",
    "'/v1/roles/grants/approve'",
    "'/v1/roles/grants/pending'",
    "'/v1/roles/me'",
  ];
  requiredEndpoints.forEach((endpoint) => {
    if (!routesFile.includes(endpoint)) {
      throw new Error(`Endpoint ${endpoint} not found`);
    }
  });
});

// Test 17: Validation Schemas
console.log('\nTest 17: Schémas de validation');
test('Schémas Zod présents', () => {
  const routesFile = fs.readFileSync('src/routes/roles.routes.ts', 'utf-8');
  const requiredSchemas = ['roleSchema', 'grantSchema', 'revokeSchema', 'approvalSchema'];
  requiredSchemas.forEach((schema) => {
    if (!routesFile.includes(schema)) {
      throw new Error(`Schema ${schema} not found`);
    }
  });
});

// Test 18: Security Features
console.log('\nTest 18: Fonctionnalités de sécurité');
test('Trust hierarchy validation présente', () => {
  fileContains('src/services/roles.service.ts', 'hasHigherTrust');
  fileContains('src/services/roles.service.ts', 'canManageScope');
});
test('Approval workflow présent', () => {
  fileContains('src/services/roles.service.ts', 'APPROVAL_THRESHOLD');
  fileContains('src/services/roles.service.ts', 'needsApproval');
});
test('Idempotency présente', () => {
  fileContains('src/routes/roles.routes.ts', 'Idempotency-Key');
  fileContains('src/services/idempotency.ts', 'withIdempotency');
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
