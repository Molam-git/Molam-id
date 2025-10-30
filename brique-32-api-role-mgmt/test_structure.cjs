// brique-32-api-role-mgmt/test_structure.cjs
// Test structure validation for Brique 32 - API Role Management

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

console.log('\n📦 Testing SQL Migration (032_role_management.sql)...\n');

test('SQL: File exists', () => {
  fileExists('sql/032_role_management.sql');
});

test('SQL: Extends molam_user_roles with delegation fields', () => {
  fileContains('sql/032_role_management.sql', 'ALTER TABLE molam_user_roles');
  fileContains('sql/032_role_management.sql', 'delegated_by');
  fileContains('sql/032_role_management.sql', 'delegation_reason');
});

test('SQL: Contains molam_role_management_audit table', () => {
  fileMatchesRegex(
    'sql/032_role_management.sql',
    /CREATE TABLE.*molam_role_management_audit/i,
    'role_management_audit table'
  );
});

test('SQL: Contains materialized view mv_effective_user_roles', () => {
  fileContains('sql/032_role_management.sql', 'CREATE MATERIALIZED VIEW');
  fileContains('sql/032_role_management.sql', 'mv_effective_user_roles');
});

test('SQL: Contains assign_role_with_delegation function', () => {
  fileContains('sql/032_role_management.sql', 'CREATE OR REPLACE FUNCTION assign_role_with_delegation');
});

test('SQL: Contains revoke_role_by_module function', () => {
  fileContains('sql/032_role_management.sql', 'CREATE OR REPLACE FUNCTION revoke_role_by_module');
});

test('SQL: Contains search_users_by_role function', () => {
  fileContains('sql/032_role_management.sql', 'CREATE OR REPLACE FUNCTION search_users_by_role');
});

test('SQL: Contains get_role_statistics_by_module function', () => {
  fileContains('sql/032_role_management.sql', 'CREATE OR REPLACE FUNCTION get_role_statistics_by_module');
});

test('SQL: Contains expire_roles function', () => {
  fileContains('sql/032_role_management.sql', 'CREATE OR REPLACE FUNCTION expire_roles');
});

test('SQL: Contains refresh_effective_roles_view function', () => {
  fileContains('sql/032_role_management.sql', 'CREATE OR REPLACE FUNCTION refresh_effective_roles_view');
});

test('SQL: Contains v_user_role_assignments view', () => {
  fileContains('sql/032_role_management.sql', 'CREATE OR REPLACE VIEW v_user_role_assignments');
});

test('SQL: Contains v_delegation_summary view', () => {
  fileContains('sql/032_role_management.sql', 'CREATE OR REPLACE VIEW v_delegation_summary');
});

test('SQL: Contains notify_role_change trigger function', () => {
  fileContains('sql/032_role_management.sql', 'CREATE OR REPLACE FUNCTION notify_role_change');
});

test('SQL: Contains indexes for performance', () => {
  fileMatchesRegex(
    'sql/032_role_management.sql',
    /CREATE INDEX.*idx_user_roles_user_module/i,
    'user_module index'
  );
  fileMatchesRegex(
    'sql/032_role_management.sql',
    /CREATE INDEX.*idx_user_roles_expires_at/i,
    'expires_at index'
  );
});

test('SQL: Contains unique constraint for superadmin', () => {
  fileContains('sql/032_role_management.sql', 'uniq_superadmin_per_user');
});

test('SQL: Contains delegation validation constraints', () => {
  fileMatchesRegex(
    'sql/032_role_management.sql',
    /delegation_reason IS NOT NULL.*delegation_reason IS NULL/is,
    'delegation validation'
  );
});

// =====================================================
// VALIDATION SCHEMAS TESTS
// =====================================================

console.log('\n📦 Testing Validation Schemas (rbac.schemas.ts)...\n');

test('Schemas: File exists', () => {
  fileExists('api/src/validators/rbac.schemas.ts');
});

test('Schemas: Exports AssignRoleSchema', () => {
  fileContains('api/src/validators/rbac.schemas.ts', 'export const AssignRoleSchema');
});

test('Schemas: Exports RevokeRoleSchema', () => {
  fileContains('api/src/validators/rbac.schemas.ts', 'export const RevokeRoleSchema');
});

test('Schemas: Exports SearchUsersSchema', () => {
  fileContains('api/src/validators/rbac.schemas.ts', 'export const SearchUsersSchema');
});

test('Schemas: Exports AuditQuerySchema', () => {
  fileContains('api/src/validators/rbac.schemas.ts', 'export const AuditQuerySchema');
});

test('Schemas: Exports BulkAssignSchema', () => {
  fileContains('api/src/validators/rbac.schemas.ts', 'export const BulkAssignSchema');
});

test('Schemas: Exports BulkRevokeSchema', () => {
  fileContains('api/src/validators/rbac.schemas.ts', 'export const BulkRevokeSchema');
});

test('Schemas: Uses Zod for validation', () => {
  fileContains('api/src/validators/rbac.schemas.ts', "from 'zod'");
});

test('Schemas: Defines Module enum', () => {
  fileContains('api/src/validators/rbac.schemas.ts', 'ModuleEnum');
  fileMatchesRegex(
    'api/src/validators/rbac.schemas.ts',
    /['"]pay['"].*['"]eats['"].*['"]shop['"]/s,
    'module values'
  );
});

test('Schemas: Defines AccessScope enum', () => {
  fileContains('api/src/validators/rbac.schemas.ts', 'AccessScopeEnum');
  fileMatchesRegex(
    'api/src/validators/rbac.schemas.ts',
    /['"]read['"].*['"]write['"].*['"]admin['"]/s,
    'access scope values'
  );
});

test('Schemas: Validates delegation requirements', () => {
  fileMatchesRegex(
    'api/src/validators/rbac.schemas.ts',
    /delegation_reason.*expires_at/is,
    'delegation validation refine'
  );
});

// =====================================================
// SERVICE LAYER TESTS
// =====================================================

console.log('\n📦 Testing Service Layer (role-management.service.ts)...\n');

test('Service: File exists', () => {
  fileExists('api/src/services/role-management.service.ts');
});

test('Service: Exports RoleManagementService class', () => {
  fileContains('api/src/services/role-management.service.ts', 'export class RoleManagementService');
});

test('Service: Exports custom error classes', () => {
  fileContains('api/src/services/role-management.service.ts', 'export class RoleManagementError');
  fileContains('api/src/services/role-management.service.ts', 'export class PermissionDeniedError');
  fileContains('api/src/services/role-management.service.ts', 'export class RoleNotFoundError');
});

test('Service: Contains listUserRoles method', () => {
  fileContains('api/src/services/role-management.service.ts', 'async listUserRoles');
});

test('Service: Contains ensureCallerCanManage method', () => {
  fileContains('api/src/services/role-management.service.ts', 'async ensureCallerCanManage');
});

test('Service: Contains assignRole method', () => {
  fileContains('api/src/services/role-management.service.ts', 'async assignRole');
});

test('Service: Contains revokeRole method', () => {
  fileContains('api/src/services/role-management.service.ts', 'async revokeRole');
});

test('Service: Contains searchUsers method', () => {
  fileContains('api/src/services/role-management.service.ts', 'async searchUsers');
});

test('Service: Contains getRoleStatistics method', () => {
  fileContains('api/src/services/role-management.service.ts', 'async getRoleStatistics');
});

test('Service: Contains getAuditLogs method', () => {
  fileContains('api/src/services/role-management.service.ts', 'async getAuditLogs');
});

test('Service: Contains bulkAssignRoles method', () => {
  fileContains('api/src/services/role-management.service.ts', 'async bulkAssignRoles');
});

test('Service: Contains bulkRevokeRoles method', () => {
  fileContains('api/src/services/role-management.service.ts', 'async bulkRevokeRoles');
});

test('Service: Contains expireRoles method', () => {
  fileContains('api/src/services/role-management.service.ts', 'async expireRoles');
});

test('Service: Contains refreshMaterializedView method', () => {
  fileContains('api/src/services/role-management.service.ts', 'async refreshMaterializedView');
});

test('Service: Contains getDelegationsByUser method', () => {
  fileContains('api/src/services/role-management.service.ts', 'async getDelegationsByUser');
});

test('Service: Contains getExpiringSoon method', () => {
  fileContains('api/src/services/role-management.service.ts', 'async getExpiringSoon');
});

test('Service: Uses PostgreSQL Pool', () => {
  fileContains('api/src/services/role-management.service.ts', "from 'pg'");
  fileContains('api/src/services/role-management.service.ts', 'Pool');
});

test('Service: Implements idempotency key support', () => {
  fileContains('api/src/services/role-management.service.ts', 'idempotency_key');
});

// =====================================================
// API ROUTES TESTS
// =====================================================

console.log('\n📦 Testing API Routes (role-management.routes.ts)...\n');

test('Routes: File exists', () => {
  fileExists('api/src/routes/role-management.routes.ts');
});

test('Routes: Exports createRoleManagementRouter function', () => {
  fileContains('api/src/routes/role-management.routes.ts', 'export function createRoleManagementRouter');
});

test('Routes: Uses Express Router', () => {
  fileContains('api/src/routes/role-management.routes.ts', "from 'express'");
  fileContains('api/src/routes/role-management.routes.ts', 'Router');
});

test('Routes: Uses RoleManagementService', () => {
  fileContains('api/src/routes/role-management.routes.ts', 'RoleManagementService');
});

test('Routes: Uses rate limiting', () => {
  fileContains('api/src/routes/role-management.routes.ts', 'express-rate-limit');
  fileContains('api/src/routes/role-management.routes.ts', 'strictRateLimit');
  fileContains('api/src/routes/role-management.routes.ts', 'moderateRateLimit');
});

test('Routes: Has authenticate middleware', () => {
  fileContains('api/src/routes/role-management.routes.ts', 'authenticate');
});

test('Routes: GET /api/id/rbac/:userId/roles', () => {
  fileMatchesRegex(
    'api/src/routes/role-management.routes.ts',
    /router\.get\s*\(\s*['"]\/api\/id\/rbac\/:userId\/roles['"]/,
    'GET user roles endpoint'
  );
});

test('Routes: POST /api/id/rbac/:userId/assign', () => {
  fileMatchesRegex(
    'api/src/routes/role-management.routes.ts',
    /router\.post\s*\(\s*['"]\/api\/id\/rbac\/:userId\/assign['"]/,
    'POST assign role endpoint'
  );
});

test('Routes: POST /api/id/rbac/:userId/revoke', () => {
  fileMatchesRegex(
    'api/src/routes/role-management.routes.ts',
    /router\.post\s*\(\s*['"]\/api\/id\/rbac\/:userId\/revoke['"]/,
    'POST revoke role endpoint'
  );
});

test('Routes: GET /api/id/rbac/search', () => {
  fileMatchesRegex(
    'api/src/routes/role-management.routes.ts',
    /router\.get\s*\(\s*['"]\/api\/id\/rbac\/search['"]/,
    'GET search users endpoint'
  );
});

test('Routes: GET /api/id/rbac/statistics', () => {
  fileMatchesRegex(
    'api/src/routes/role-management.routes.ts',
    /router\.get\s*\(\s*['"]\/api\/id\/rbac\/statistics['"]/,
    'GET statistics endpoint'
  );
});

test('Routes: GET /api/id/rbac/audit', () => {
  fileMatchesRegex(
    'api/src/routes/role-management.routes.ts',
    /router\.get\s*\(\s*['"]\/api\/id\/rbac\/audit['"]/,
    'GET audit logs endpoint'
  );
});

test('Routes: GET /api/id/rbac/delegations/:userId', () => {
  fileMatchesRegex(
    'api/src/routes/role-management.routes.ts',
    /router\.get\s*\(\s*['"]\/api\/id\/rbac\/delegations\/:userId['"]/,
    'GET delegations endpoint'
  );
});

test('Routes: GET /api/id/rbac/expiring', () => {
  fileMatchesRegex(
    'api/src/routes/role-management.routes.ts',
    /router\.get\s*\(\s*['"]\/api\/id\/rbac\/expiring['"]/,
    'GET expiring roles endpoint'
  );
});

test('Routes: POST /api/id/rbac/bulk/assign', () => {
  fileMatchesRegex(
    'api/src/routes/role-management.routes.ts',
    /router\.post\s*\(\s*['"]\/api\/id\/rbac\/bulk\/assign['"]/,
    'POST bulk assign endpoint'
  );
});

test('Routes: POST /api/id/rbac/bulk/revoke', () => {
  fileMatchesRegex(
    'api/src/routes/role-management.routes.ts',
    /router\.post\s*\(\s*['"]\/api\/id\/rbac\/bulk\/revoke['"]/,
    'POST bulk revoke endpoint'
  );
});

test('Routes: POST /api/id/rbac/maintenance/expire', () => {
  fileMatchesRegex(
    'api/src/routes/role-management.routes.ts',
    /router\.post\s*\(\s*['"]\/api\/id\/rbac\/maintenance\/expire['"]/,
    'POST expire roles endpoint'
  );
});

test('Routes: POST /api/id/rbac/maintenance/refresh-view', () => {
  fileMatchesRegex(
    'api/src/routes/role-management.routes.ts',
    /router\.post\s*\(\s*['"]\/api\/id\/rbac\/maintenance\/refresh-view['"]/,
    'POST refresh view endpoint'
  );
});

test('Routes: GET /api/id/rbac/:userId/trust-level', () => {
  fileMatchesRegex(
    'api/src/routes/role-management.routes.ts',
    /router\.get\s*\(\s*['"]\/api\/id\/rbac\/:userId\/trust-level['"]/,
    'GET trust level endpoint'
  );
});

test('Routes: GET /api/id/rbac/health', () => {
  fileMatchesRegex(
    'api/src/routes/role-management.routes.ts',
    /router\.get\s*\(\s*['"]\/api\/id\/rbac\/health['"]/,
    'GET health check endpoint'
  );
});

test('Routes: Has error handler middleware', () => {
  fileMatchesRegex(
    'api/src/routes/role-management.routes.ts',
    /router\.use\s*\(\s*\(error/,
    'error handler middleware'
  );
});

test('Routes: Handles Zod validation errors', () => {
  fileContains('api/src/routes/role-management.routes.ts', 'ZodError');
  fileContains('api/src/routes/role-management.routes.ts', 'VALIDATION_ERROR');
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
    /#.*Brique 32.*API Role Management/i,
    'Brique 32 title'
  );
});

test('Docs: README documents delegation feature', () => {
  fileMatchesRegex(
    'README.md',
    /delegation|delegate/i,
    'delegation documentation'
  );
});

test('Docs: README has API examples', () => {
  fileMatchesRegex(
    'README.md',
    /```.*curl|http|POST|GET/is,
    'API examples with curl or HTTP methods'
  );
});

test('Docs: README documents SQL setup', () => {
  fileMatchesRegex(
    'README.md',
    /psql|postgres|migration/i,
    'SQL setup instructions'
  );
});

test('Docs: README documents security features', () => {
  fileMatchesRegex(
    'README.md',
    /security|audit|rate.*limit/i,
    'security documentation'
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
