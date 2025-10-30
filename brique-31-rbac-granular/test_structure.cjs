// brique-31-rbac-granular/test_structure.cjs
// Test structure validation for Brique 31 - RBAC granularité

const fs = require('fs');
const path = require('path');

// =====================================================
// TEST CONFIGURATION
// =====================================================

const baseDir = __dirname;
const results = { passed: 0, failed: 0, tests: [] };

function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`✓ ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
}

function fileExists(relativePath) {
  const fullPath = path.join(baseDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${relativePath}`);
  }
  return fullPath;
}

function fileContains(relativePath, searchString) {
  const fullPath = fileExists(relativePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  if (!content.includes(searchString)) {
    throw new Error(`File ${relativePath} does not contain: ${searchString}`);
  }
}

function fileMatchesRegex(relativePath, regex, description) {
  const fullPath = fileExists(relativePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  if (!regex.test(content)) {
    throw new Error(`File ${relativePath} does not match pattern: ${description}`);
  }
}

// =====================================================
// SQL MIGRATION TESTS
// =====================================================

console.log('\n📦 Testing SQL Migration (031_rbac.sql)...\n');

test('SQL: File exists', () => {
  fileExists('sql/031_rbac.sql');
});

test('SQL: Contains role_definitions table', () => {
  fileMatchesRegex('sql/031_rbac.sql', /CREATE TABLE.*molam_role_definitions/i, 'role_definitions table');
});

test('SQL: Contains user_roles table', () => {
  fileMatchesRegex('sql/031_rbac.sql', /CREATE TABLE.*molam_user_roles/i, 'user_roles table');
});

test('SQL: Contains role_permissions table', () => {
  fileMatchesRegex('sql/031_rbac.sql', /CREATE TABLE.*molam_role_permissions/i, 'role_permissions table');
});

test('SQL: Contains role_audit table', () => {
  fileMatchesRegex('sql/031_rbac.sql', /CREATE TABLE.*molam_role_audit/i, 'role_audit table');
});

test('SQL: Defines role types enum', () => {
  fileMatchesRegex(
    'sql/031_rbac.sql',
    /role_type\s+(VARCHAR|TEXT|CHECK)/i,
    'role_type field with constraints'
  );
});

test('SQL: Defines module enum', () => {
  fileMatchesRegex(
    'sql/031_rbac.sql',
    /module\s+(VARCHAR|TEXT|CHECK).*pay.*eats.*shop/is,
    'module field with values (pay, eats, shop, etc.)'
  );
});

test('SQL: Preloads client role', () => {
  fileMatchesRegex('sql/031_rbac.sql', /['"]client['"].*Client.*external/is, 'client role definition');
});

test('SQL: Preloads agent role', () => {
  fileMatchesRegex('sql/031_rbac.sql', /['"]agent['"].*Agent/is, 'agent role definition');
});

test('SQL: Preloads merchant role', () => {
  fileMatchesRegex('sql/031_rbac.sql', /['"]merchant['"].*Marchand/is, 'merchant role definition');
});

test('SQL: Preloads superadmin role', () => {
  fileMatchesRegex('sql/031_rbac.sql', /['"]superadmin['"].*internal/is, 'superadmin role definition');
});

test('SQL: Preloads admin role', () => {
  fileMatchesRegex('sql/031_rbac.sql', /['"]admin['"].*Administrateur/is, 'admin role definition');
});

test('SQL: Preloads auditor role', () => {
  fileMatchesRegex('sql/031_rbac.sql', /['"]auditor['"].*Audit/is, 'auditor role definition');
});

test('SQL: Preloads support role', () => {
  fileMatchesRegex('sql/031_rbac.sql', /['"]support['"].*Support/is, 'support role definition');
});

test('SQL: Preloads bank role', () => {
  fileMatchesRegex('sql/031_rbac.sql', /['"]bank['"].*Banque.*partner/is, 'bank role definition');
});

test('SQL: Preloads regulator role', () => {
  fileMatchesRegex('sql/031_rbac.sql', /['"]regulator['"].*R[ée]gulateur/is, 'regulator role definition');
});

test('SQL: Preloads permissions for client role', () => {
  fileMatchesRegex('sql/031_rbac.sql', /['"]client['"].*['"]pay['"].*['"]transactions['"]/is, 'client permissions');
});

test('SQL: Preloads permissions for agent role', () => {
  fileMatchesRegex('sql/031_rbac.sql', /['"]agent['"].*['"]pay['"].*['"]cash/is, 'agent permissions');
});

test('SQL: Preloads permissions for merchant role', () => {
  fileMatchesRegex('sql/031_rbac.sql', /['"]merchant['"].*['"]pay['"].*['"]payments['"]/is, 'merchant permissions');
});

test('SQL: Contains has_permission function', () => {
  fileContains('sql/031_rbac.sql', 'CREATE OR REPLACE FUNCTION has_permission');
});

test('SQL: Contains get_user_roles function', () => {
  fileContains('sql/031_rbac.sql', 'CREATE OR REPLACE FUNCTION get_user_roles');
});

test('SQL: Contains get_user_permissions function', () => {
  fileContains('sql/031_rbac.sql', 'CREATE OR REPLACE FUNCTION get_user_permissions');
});

test('SQL: Contains assign_role function', () => {
  fileContains('sql/031_rbac.sql', 'CREATE OR REPLACE FUNCTION assign_role');
});

test('SQL: Contains revoke_role function', () => {
  fileContains('sql/031_rbac.sql', 'CREATE OR REPLACE FUNCTION revoke_role');
});

test('SQL: Contains expire_temporal_roles function', () => {
  fileContains('sql/031_rbac.sql', 'CREATE OR REPLACE FUNCTION expire_temporal_roles');
});

test('SQL: Contains get_role_statistics function', () => {
  fileContains('sql/031_rbac.sql', 'CREATE OR REPLACE FUNCTION get_role_statistics');
});

test('SQL: Contains v_active_roles view', () => {
  fileContains('sql/031_rbac.sql', 'CREATE OR REPLACE VIEW v_active_roles');
});

test('SQL: Contains v_pending_role_approvals view', () => {
  fileContains('sql/031_rbac.sql', 'CREATE OR REPLACE VIEW v_pending_role_approvals');
});

test('SQL: Contains auto-audit trigger', () => {
  fileMatchesRegex(
    'sql/031_rbac.sql',
    /CREATE TRIGGER.*audit/i,
    'audit trigger'
  );
});

test('SQL: Contains RLS policies', () => {
  fileMatchesRegex(
    'sql/031_rbac.sql',
    /ALTER TABLE.*ENABLE ROW LEVEL SECURITY/i,
    'RLS enablement'
  );
  fileMatchesRegex(
    'sql/031_rbac.sql',
    /CREATE POLICY/i,
    'at least one policy'
  );
});

test('SQL: Contains trust level validation', () => {
  fileMatchesRegex(
    'sql/031_rbac.sql',
    /trusted_level.*(BETWEEN.*0.*AND.*5|>=.*0.*AND.*<=.*5)/is,
    'trust level range 0-5'
  );
});

test('SQL: Contains approval status field', () => {
  fileContains('sql/031_rbac.sql', 'approval_status');
  fileMatchesRegex(
    'sql/031_rbac.sql',
    /approval_status.*(pending|approved|rejected)/is,
    'approval status values'
  );
});

test('SQL: Contains expires_at field for temporal roles', () => {
  fileContains('sql/031_rbac.sql', 'expires_at');
});

// =====================================================
// SERVICE LAYER TESTS
// =====================================================

console.log('\n📦 Testing RBAC Service (rbac.service.ts)...\n');

test('Service: File exists', () => {
  fileExists('api/src/services/rbac/rbac.service.ts');
});

test('Service: Exports RBACService class', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'export class RBACService');
});

test('Service: Exports types', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'export type RoleType');
  fileContains('api/src/services/rbac/rbac.service.ts', 'export type AccessScope');
  fileContains('api/src/services/rbac/rbac.service.ts', 'export type Module');
});

test('Service: Contains getRoleDefinitions method', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async getRoleDefinitions');
});

test('Service: Contains getUserRoles method', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async getUserRoles');
});

test('Service: Contains assignRole method', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async assignRole');
});

test('Service: Contains revokeRole method', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async revokeRole');
});

test('Service: Contains approveRole method', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async approveRole');
});

test('Service: Contains rejectRole method', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async rejectRole');
});

test('Service: Contains getPendingApprovals method', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async getPendingApprovals');
});

test('Service: Contains getUserPermissions method', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async getUserPermissions');
});

test('Service: Contains hasPermission method', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async hasPermission');
});

test('Service: Contains checkPermission method', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async checkPermission');
});

test('Service: Contains getRoleStatistics method', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async getRoleStatistics');
});

test('Service: Contains getAuditLogs method', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async getAuditLogs');
});

test('Service: Contains expireTemporalRoles method', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async expireTemporalRoles');
});

test('Service: Contains hasRole helper', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async hasRole');
});

test('Service: Contains hasAnyRole helper', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async hasAnyRole');
});

test('Service: Contains getHighestTrustLevel helper', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async getHighestTrustLevel');
});

test('Service: Contains getUserModules helper', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'async getUserModules');
});

test('Service: Contains PermissionDeniedError class', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', 'export class PermissionDeniedError');
  fileContains('api/src/services/rbac/rbac.service.ts', 'PERMISSION_DENIED');
});

test('Service: Uses pg Pool', () => {
  fileContains('api/src/services/rbac/rbac.service.ts', "from 'pg'");
  fileContains('api/src/services/rbac/rbac.service.ts', 'Pool');
});

// =====================================================
// API ROUTES TESTS
// =====================================================

console.log('\n📦 Testing API Routes (rbac.routes.ts)...\n');

test('Routes: File exists', () => {
  fileExists('api/src/routes/rbac.routes.ts');
});

test('Routes: Exports createRBACRouter function', () => {
  fileContains('api/src/routes/rbac.routes.ts', 'export function createRBACRouter');
});

test('Routes: Uses Express Router', () => {
  fileContains('api/src/routes/rbac.routes.ts', "from 'express'");
  fileContains('api/src/routes/rbac.routes.ts', 'Router');
});

test('Routes: Uses RBACService', () => {
  fileContains('api/src/routes/rbac.routes.ts', 'RBACService');
});

test('Routes: Uses Zod validation', () => {
  fileContains('api/src/routes/rbac.routes.ts', "from 'zod'");
});

test('Routes: Uses rate limiting', () => {
  fileContains('api/src/routes/rbac.routes.ts', 'express-rate-limit');
  fileContains('api/src/routes/rbac.routes.ts', 'rateLimit');
});

test('Routes: Has authenticate middleware', () => {
  fileContains('api/src/routes/rbac.routes.ts', 'authenticate');
});

test('Routes: Has requirePermission middleware', () => {
  fileContains('api/src/routes/rbac.routes.ts', 'requirePermission');
});

test('Routes: GET /api/id/rbac/roles', () => {
  fileMatchesRegex(
    'api/src/routes/rbac.routes.ts',
    /router\.get\s*\(\s*['"]\/api\/id\/rbac\/roles['"]/,
    'GET roles endpoint'
  );
});

test('Routes: GET /api/id/rbac/me/roles', () => {
  fileMatchesRegex(
    'api/src/routes/rbac.routes.ts',
    /router\.get\s*\(\s*['"]\/api\/id\/rbac\/me\/roles['"]/,
    'GET own roles endpoint'
  );
});

test('Routes: GET /api/id/rbac/me/permissions', () => {
  fileMatchesRegex(
    'api/src/routes/rbac.routes.ts',
    /router\.get\s*\(\s*['"]\/api\/id\/rbac\/me\/permissions['"]/,
    'GET own permissions endpoint'
  );
});

test('Routes: POST /api/id/rbac/me/check', () => {
  fileMatchesRegex(
    'api/src/routes/rbac.routes.ts',
    /router\.post\s*\(\s*['"]\/api\/id\/rbac\/me\/check['"]/,
    'POST check permission endpoint'
  );
});

test('Routes: GET /api/id/rbac/users/:userId/roles', () => {
  fileMatchesRegex(
    'api/src/routes/rbac.routes.ts',
    /router\.get\s*\(\s*['"]\/api\/id\/rbac\/users\/:userId\/roles['"]/,
    'GET user roles endpoint'
  );
});

test('Routes: POST /api/id/rbac/users/:userId/roles', () => {
  fileMatchesRegex(
    'api/src/routes/rbac.routes.ts',
    /router\.post\s*\(\s*['"]\/api\/id\/rbac\/users\/:userId\/roles['"]/,
    'POST assign role endpoint'
  );
});

test('Routes: DELETE /api/id/rbac/user-roles/:userRoleId', () => {
  fileMatchesRegex(
    'api/src/routes/rbac.routes.ts',
    /router\.delete\s*\(\s*['"]\/api\/id\/rbac\/user-roles\/:userRoleId['"]/,
    'DELETE revoke role endpoint'
  );
});

test('Routes: GET /api/id/rbac/pending', () => {
  fileMatchesRegex(
    'api/src/routes/rbac.routes.ts',
    /router\.get\s*\(\s*['"]\/api\/id\/rbac\/pending['"]/,
    'GET pending approvals endpoint'
  );
});

test('Routes: POST /api/id/rbac/user-roles/:userRoleId/approve', () => {
  fileMatchesRegex(
    'api/src/routes/rbac.routes.ts',
    /router\.post\s*\(\s*['"]\/api\/id\/rbac\/user-roles\/:userRoleId\/approve['"]/,
    'POST approve role endpoint'
  );
});

test('Routes: POST /api/id/rbac/user-roles/:userRoleId/reject', () => {
  fileMatchesRegex(
    'api/src/routes/rbac.routes.ts',
    /router\.post\s*\(\s*['"]\/api\/id\/rbac\/user-roles\/:userRoleId\/reject['"]/,
    'POST reject role endpoint'
  );
});

test('Routes: GET /api/id/rbac/statistics', () => {
  fileMatchesRegex(
    'api/src/routes/rbac.routes.ts',
    /router\.get\s*\(\s*['"]\/api\/id\/rbac\/statistics['"]/,
    'GET statistics endpoint'
  );
});

test('Routes: GET /api/id/rbac/audit', () => {
  fileMatchesRegex(
    'api/src/routes/rbac.routes.ts',
    /router\.get\s*\(\s*['"]\/api\/id\/rbac\/audit['"]/,
    'GET audit logs endpoint'
  );
});

test('Routes: POST /api/id/rbac/maintenance/expire-roles', () => {
  fileMatchesRegex(
    'api/src/routes/rbac.routes.ts',
    /router\.post\s*\(\s*['"]\/api\/id\/rbac\/maintenance\/expire-roles['"]/,
    'POST expire roles endpoint'
  );
});

test('Routes: GET /api/id/rbac/health', () => {
  fileMatchesRegex(
    'api/src/routes/rbac.routes.ts',
    /router\.get\(['"]\s*\/api\/id\/rbac\/health/,
    'GET health check endpoint'
  );
});

test('Routes: Has validation schemas', () => {
  fileContains('api/src/routes/rbac.routes.ts', 'AssignRoleSchema');
  fileContains('api/src/routes/rbac.routes.ts', 'RevokeRoleSchema');
});

// =====================================================
// MIDDLEWARE TESTS
// =====================================================

console.log('\n📦 Testing AuthZ Middleware (authz.ts)...\n');

test('Middleware: File exists', () => {
  fileExists('api/src/middleware/authz.ts');
});

test('Middleware: Exports createAuthZMiddleware function', () => {
  fileContains('api/src/middleware/authz.ts', 'export function createAuthZMiddleware');
});

test('Middleware: Returns injectRBAC middleware', () => {
  fileContains('api/src/middleware/authz.ts', 'injectRBAC');
});

test('Middleware: Returns requirePermission middleware', () => {
  fileContains('api/src/middleware/authz.ts', 'requirePermission');
});

test('Middleware: Returns requireRole middleware', () => {
  fileContains('api/src/middleware/authz.ts', 'requireRole');
});

test('Middleware: Returns requireAnyRole middleware', () => {
  fileContains('api/src/middleware/authz.ts', 'requireAnyRole');
});

test('Middleware: Returns requireTrustLevel middleware', () => {
  fileContains('api/src/middleware/authz.ts', 'requireTrustLevel');
});

test('Middleware: Returns requireOwnership middleware', () => {
  fileContains('api/src/middleware/authz.ts', 'requireOwnership');
});

test('Middleware: Returns requireOwnershipOrPermission middleware', () => {
  fileContains('api/src/middleware/authz.ts', 'requireOwnershipOrPermission');
});

test('Middleware: Exports UserIdExtractors', () => {
  fileContains('api/src/middleware/authz.ts', 'export const UserIdExtractors');
  fileContains('api/src/middleware/authz.ts', 'fromParams');
  fileContains('api/src/middleware/authz.ts', 'fromQuery');
  fileContains('api/src/middleware/authz.ts', 'fromBody');
});

test('Middleware: Exports ContextExtractors', () => {
  fileContains('api/src/middleware/authz.ts', 'export const ContextExtractors');
  fileContains('api/src/middleware/authz.ts', 'withAmount');
  fileContains('api/src/middleware/authz.ts', 'withSubsidiary');
});

test('Middleware: Uses RBACService', () => {
  fileContains('api/src/middleware/authz.ts', 'RBACService');
});

test('Middleware: Returns error codes', () => {
  fileContains('api/src/middleware/authz.ts', 'PERMISSION_DENIED');
  fileContains('api/src/middleware/authz.ts', 'UNAUTHENTICATED');
});

test('Middleware: Has comprehensive examples', () => {
  fileMatchesRegex(
    'api/src/middleware/authz.ts',
    /EXAMPLE USAGE/i,
    'usage examples section'
  );
});

// =====================================================
// DOCUMENTATION TESTS
// =====================================================

console.log('\n📦 Testing Documentation...\n');

test('Docs: README exists', () => {
  fileExists('README.md');
});

test('Docs: README has title', () => {
  fileMatchesRegex(
    'README.md',
    /#.*Brique 31.*RBAC/i,
    'Brique 31 RBAC title'
  );
});

test('Docs: README describes architecture', () => {
  fileMatchesRegex(
    'README.md',
    /architecture|overview|system/i,
    'architecture section'
  );
});

test('Docs: README documents role types', () => {
  fileContains('README.md', 'external');
  fileContains('README.md', 'internal');
  fileContains('README.md', 'partner');
});

test('Docs: README documents modules', () => {
  fileContains('README.md', 'pay');
  fileContains('README.md', 'eats');
  fileContains('README.md', 'shop');
});

test('Docs: README documents trust levels', () => {
  fileMatchesRegex(
    'README.md',
    /trust.*level.*0.*5/is,
    'trust level 0-5'
  );
});

test('Docs: README has API examples', () => {
  fileMatchesRegex(
    'README.md',
    /```.*curl|http|POST|GET/is,
    'API examples with curl or HTTP methods'
  );
});

test('Docs: README has SQL setup instructions', () => {
  fileMatchesRegex(
    'README.md',
    /psql|postgres|migration/i,
    'SQL setup instructions'
  );
});

test('Docs: README documents permissions', () => {
  fileMatchesRegex(
    'README.md',
    /permission|access.*control|authorization/i,
    'permissions documentation'
  );
});

test('Docs: README has security considerations', () => {
  fileMatchesRegex(
    'README.md',
    /security|audit|compliance/i,
    'security section'
  );
});

// =====================================================
// SUMMARY
// =====================================================

console.log('\n' + '='.repeat(50));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(50));
console.log(`Total tests: ${results.passed + results.failed}`);
console.log(`✓ Passed: ${results.passed}`);
console.log(`✗ Failed: ${results.failed}`);
console.log(`Success rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
console.log('='.repeat(50) + '\n');

// Exit with error code if any tests failed
process.exit(results.failed > 0 ? 1 : 0);
