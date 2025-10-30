// test_structure.cjs
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); console.log(`✅ PASS: ${name}`); passed++; }
  catch (err) { console.log(`❌ FAIL: ${name}\n   ${err.message}`); failed++; }
}

function fileExists(f) {
  if (!fs.existsSync(path.join(__dirname, f))) throw new Error(`File not found: ${f}`);
}

function fileContains(f, c) {
  fileExists(f);
  if (!fs.readFileSync(path.join(__dirname, f), 'utf-8').includes(c)) throw new Error(`${f} missing: ${c}`);
}

console.log('\n🧪 Tests de structure - Brique 26 Admin Console\n');

console.log('Test 1: SQL Migration');
test('SQL file présent', () => fileExists('sql/026_admin_ui.sql'));
test('Table molam_employees', () => fileContains('sql/026_admin_ui.sql', 'molam_employees'));
test('Table molam_admin_actions', () => fileContains('sql/026_admin_ui.sql', 'molam_admin_actions'));
test('Functions SQL', () => {
  fileContains('sql/026_admin_ui.sql', 'get_employees_by_department');
  fileContains('sql/026_admin_ui.sql', 'can_admin_manage_department');
  fileContains('sql/026_admin_ui.sql', 'log_admin_action');
});

console.log('\nTest 2: Backend API');
test('Types', () => {
  fileExists('api/src/types/index.ts');
  fileContains('api/src/types/index.ts', 'Employee');
  fileContains('api/src/types/index.ts', 'Department');
});
test('Services', () => {
  fileExists('api/src/services/admin.service.ts');
  fileContains('api/src/services/admin.service.ts', 'listEmployees');
  fileContains('api/src/services/admin.service.ts', 'getAdminPermissions');
});
test('Controllers', () => {
  fileExists('api/src/controllers/admin.controller.ts');
  fileContains('api/src/controllers/admin.controller.ts', 'listEmployees');
});
test('Routes', () => {
  fileExists('api/src/routes/admin.routes.ts');
  fileContains('api/src/routes/admin.routes.ts', '/api/id/admin/employees');
});
test('Middleware', () => {
  fileExists('api/src/middleware/auth.ts');
  fileExists('api/src/middleware/authz.ts');
});
test('Server & Config', () => {
  fileExists('api/src/server.ts');
  fileExists('api/package.json');
  fileExists('api/tsconfig.json');
});

console.log('\nTest 3: Web UI');
test('AdminDashboard', () => {
  fileExists('web/src/pages/AdminDashboard.tsx');
  fileContains('web/src/pages/AdminDashboard.tsx', 'AdminDashboard');
});
test('Config Web', () => fileExists('web/package.json'));

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`📊 Résumé: ${passed}/${passed + failed} tests réussis (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log('═══════════════════════════════════════════════════════════');

if (failed > 0) {
  console.log('❌ Tests ÉCHOUÉS\n');
  process.exit(1);
} else {
  console.log('✅ Tests de structure RÉUSSIS\n');
  process.exit(0);
}
