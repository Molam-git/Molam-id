// test_structure.cjs
// Structure validation tests for Brique 25 - UI ID Management

const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ FAIL: ${name}\n   ${err.message}`);
    failed++;
  }
}

function fileExists(f) {
  const fullPath = path.join(__dirname, f);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${f}`);
  }
}

function fileContains(f, content) {
  const fullPath = path.join(__dirname, f);
  fileExists(f);
  const fileContent = fs.readFileSync(fullPath, 'utf-8');
  if (!fileContent.includes(content)) {
    throw new Error(`${f} missing content: ${content}`);
  }
}

console.log('\n🧪 Tests de structure - Brique 25 UI ID Management\n');

// ============================================================================
// Test 1: SQL Migration
// ============================================================================
console.log('Test 1: SQL Migration');
test('SQL file présent', () => {
  fileExists('sql/025_ui_id.sql');
});
test('Table molam_user_settings', () => {
  fileContains('sql/025_ui_id.sql', 'molam_user_settings');
});
test('Table molam_user_devices', () => {
  fileContains('sql/025_ui_id.sql', 'molam_user_devices');
});
test('Table molam_user_notifications', () => {
  fileContains('sql/025_ui_id.sql', 'molam_user_notifications');
});
test('Functions SQL', () => {
  fileContains('sql/025_ui_id.sql', 'get_user_settings');
  fileContains('sql/025_ui_id.sql', 'mark_notification_read');
  fileContains('sql/025_ui_id.sql', 'create_security_notification');
});

// ============================================================================
// Test 2: Backend API
// ============================================================================
console.log('\nTest 2: Backend API');
test('Types définis', () => {
  fileExists('api/src/types/index.ts');
  fileContains('api/src/types/index.ts', 'UserProfile');
  fileContains('api/src/types/index.ts', 'UserSettings');
  fileContains('api/src/types/index.ts', 'UserDevice');
  fileContains('api/src/types/index.ts', 'SessionInfo');
});

test('Services', () => {
  fileExists('api/src/services/ui.service.ts');
  fileContains('api/src/services/ui.service.ts', 'getUserProfile');
  fileContains('api/src/services/ui.service.ts', 'updateUserSettings');
  fileContains('api/src/services/ui.service.ts', 'getUserSessions');
  fileContains('api/src/services/ui.service.ts', 'getUserDevices');
});

test('Controllers', () => {
  fileExists('api/src/controllers/ui.controller.ts');
  fileContains('api/src/controllers/ui.controller.ts', 'getMe');
  fileContains('api/src/controllers/ui.controller.ts', 'updateSettings');
  fileContains('api/src/controllers/ui.controller.ts', 'listSessions');
  fileContains('api/src/controllers/ui.controller.ts', 'revokeSession');
});

test('Middleware', () => {
  fileExists('api/src/middleware/auth.ts');
  fileExists('api/src/middleware/authz.ts');
  fileContains('api/src/middleware/auth.ts', 'requireAuth');
  fileContains('api/src/middleware/authz.ts', 'authzEnforce');
});

test('Routes', () => {
  fileExists('api/src/routes/ui.routes.ts');
  fileContains('api/src/routes/ui.routes.ts', '/api/id/me');
  fileContains('api/src/routes/ui.routes.ts', '/api/id/settings');
  fileContains('api/src/routes/ui.routes.ts', '/api/id/security/sessions');
  fileContains('api/src/routes/ui.routes.ts', '/api/id/security/devices');
  fileContains('api/src/routes/ui.routes.ts', '/api/id/roles');
  fileContains('api/src/routes/ui.routes.ts', '/api/id/notifications');
});

test('Server', () => {
  fileExists('api/src/server.ts');
  fileContains('api/src/server.ts', 'express');
});

test('Configuration API', () => {
  fileExists('api/package.json');
  fileExists('api/tsconfig.json');
});

// ============================================================================
// Test 3: Web UI (React)
// ============================================================================
console.log('\nTest 3: Web UI (React + Tailwind)');
test('Page IdDashboard', () => {
  fileExists('web/src/pages/IdDashboard.tsx');
  fileContains('web/src/pages/IdDashboard.tsx', 'IdDashboard');
});

test('Composants UI', () => {
  fileExists('web/src/components/ProfileCard.tsx');
  fileExists('web/src/components/SettingsCard.tsx');
  fileExists('web/src/components/SecurityCard.tsx');
  fileExists('web/src/components/RolesCard.tsx');
  fileExists('web/src/components/NotificationsCard.tsx');
});

test('i18n', () => {
  fileExists('web/src/i18n/en.json');
  fileExists('web/src/i18n/fr.json');
  fileContains('web/src/i18n/en.json', 'profile');
  fileContains('web/src/i18n/fr.json', 'profil');
});

test('Configuration Web', () => {
  fileExists('web/package.json');
  fileExists('web/vite.config.ts');
  fileExists('web/tailwind.config.js');
  fileExists('web/src/main.tsx');
  fileExists('web/src/index.css');
});

// ============================================================================
// Test 4: Desktop (Electron)
// ============================================================================
console.log('\nTest 4: Desktop (Electron)');
test('Electron main', () => {
  fileExists('desktop/main.js');
  fileContains('desktop/main.js', 'BrowserWindow');
  fileContains('desktop/main.js', 'createWindow');
});

test('Electron preload', () => {
  fileExists('desktop/preload.js');
  fileContains('desktop/preload.js', 'contextBridge');
});

test('Configuration Desktop', () => {
  fileExists('desktop/package.json');
  fileContains('desktop/package.json', 'electron');
});

// ============================================================================
// Test 5: Mobile (React Native)
// ============================================================================
console.log('\nTest 5: Mobile (React Native)');
test('Screen IdManager', () => {
  fileExists('mobile/src/screens/IdManagerScreen.tsx');
  fileContains('mobile/src/screens/IdManagerScreen.tsx', 'IdManagerScreen');
  fileContains('mobile/src/screens/IdManagerScreen.tsx', 'react-native');
});

test('Configuration Mobile', () => {
  fileExists('mobile/package.json');
  fileContains('mobile/package.json', 'react-native');
});

// ============================================================================
// Test 6: HarmonyOS (ArkTS)
// ============================================================================
console.log('\nTest 6: HarmonyOS (ArkTS)');
test('Page IdSettings (HarmonyOS)', () => {
  fileExists('harmony/feature/id/IdSettingsPage.ets');
  fileContains('harmony/feature/id/IdSettingsPage.ets', '@Entry');
  fileContains('harmony/feature/id/IdSettingsPage.ets', '@Component');
  fileContains('harmony/feature/id/IdSettingsPage.ets', 'IdSettingsPage');
});

// ============================================================================
// Test 7: Tests
// ============================================================================
console.log('\nTest 7: Tests');
test('Fichier de tests', () => {
  fileExists('tests/ui.test.ts');
  fileContains('tests/ui.test.ts', 'describe');
});

// ============================================================================
// SUMMARY
// ============================================================================
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
