// test_structure.cjs
// Structure tests for Brique 27 - i18n

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${error.message}`);
    failed++;
  }
}

function fileExists(filePath) {
  if (!fs.existsSync(path.join(ROOT, filePath))) {
    throw new Error(`File not found: ${filePath}`);
  }
}

function fileContains(filePath, text) {
  const content = fs.readFileSync(path.join(ROOT, filePath), 'utf8');
  if (!content.includes(text)) {
    throw new Error(`File ${filePath} does not contain: ${text}`);
  }
}

console.log('\n🧪 Tests de structure - Brique 27 i18n\n');

// ============================================================================
// Test 1: SQL Migration
// ============================================================================
console.log('Test 1: SQL Migration');

test('SQL file présent', () => {
  fileExists('sql/027_i18n.sql');
});

test('Table molam_translations', () => {
  fileContains('sql/027_i18n.sql', 'CREATE TABLE IF NOT EXISTS molam_translations');
});

test('Table molam_translation_history', () => {
  fileContains('sql/027_i18n.sql', 'CREATE TABLE IF NOT EXISTS molam_translation_history');
});

test('Table molam_translation_cache', () => {
  fileContains('sql/027_i18n.sql', 'CREATE TABLE IF NOT EXISTS molam_translation_cache');
});

test('Table molam_user_language_prefs', () => {
  fileContains('sql/027_i18n.sql', 'CREATE TABLE IF NOT EXISTS molam_user_language_prefs');
});

test('Table molam_translation_stats', () => {
  fileContains('sql/027_i18n.sql', 'CREATE TABLE IF NOT EXISTS molam_translation_stats');
});

test('Function get_translation', () => {
  fileContains('sql/027_i18n.sql', 'CREATE OR REPLACE FUNCTION get_translation');
});

test('Function get_translation_bundle', () => {
  fileContains('sql/027_i18n.sql', 'CREATE OR REPLACE FUNCTION get_translation_bundle');
});

test('Function refresh_translation_cache', () => {
  fileContains('sql/027_i18n.sql', 'CREATE OR REPLACE FUNCTION refresh_translation_cache');
});

test('Function get_missing_translations', () => {
  fileContains('sql/027_i18n.sql', 'CREATE OR REPLACE FUNCTION get_missing_translations');
});

test('Preloaded translations (5 languages)', () => {
  fileContains('sql/027_i18n.sql', "('home.welcome', 'en',");
  fileContains('sql/027_i18n.sql', "('home.welcome', 'fr',");
  fileContains('sql/027_i18n.sql', "('home.welcome', 'wo',");
  fileContains('sql/027_i18n.sql', "('home.welcome', 'ar',");
  fileContains('sql/027_i18n.sql', "('home.welcome', 'es',");
});

// ============================================================================
// Test 2: Backend API
// ============================================================================
console.log('\nTest 2: Backend API');

test('Types définis', () => {
  fileExists('api/src/types.ts');
  fileContains('api/src/types.ts', "export type Language");
  fileContains('api/src/types.ts', "export interface Translation");
});

test('Service layer', () => {
  fileExists('api/src/service.ts');
  fileContains('api/src/service.ts', 'export async function getTranslationBundle');
  fileContains('api/src/service.ts', 'export async function createTranslation');
  fileContains('api/src/service.ts', 'export async function updateTranslation');
});

test('Routes API', () => {
  fileExists('api/src/routes.ts');
  fileContains('api/src/routes.ts', "router.get('/api/i18n/:lang'");
  fileContains('api/src/routes.ts', "router.post('/api/admin/i18n/translations'");
  fileContains('api/src/routes.ts', "router.get('/api/admin/i18n/coverage'");
});

test('Server configuration', () => {
  fileExists('api/src/server.ts');
  fileExists('api/src/config.ts');
  fileExists('api/package.json');
  fileExists('api/tsconfig.json');
});

// ============================================================================
// Test 3: SDK
// ============================================================================
console.log('\nTest 3: SDK');

test('MolamI18n SDK présent', () => {
  fileExists('sdk/molam-i18n.ts');
});

test('SDK: MolamI18n class', () => {
  fileContains('sdk/molam-i18n.ts', 'export class MolamI18n');
});

test('SDK: Fallback logic', () => {
  fileContains('sdk/molam-i18n.ts', 'fallbackTranslations');
  fileContains('sdk/molam-i18n.ts', 'fallbackLanguage');
});

test('SDK: Translation function', () => {
  fileContains('sdk/molam-i18n.ts', 't(key: string');
});

test('SDK: Language detection', () => {
  fileContains('sdk/molam-i18n.ts', 'detectLanguage');
});

test('SDK: Cache support', () => {
  fileContains('sdk/molam-i18n.ts', 'cache');
  fileContains('sdk/molam-i18n.ts', 'cacheTTL');
});

// ============================================================================
// Test 4: Web UI
// ============================================================================
console.log('\nTest 4: Web UI');

test('Web: Home page', () => {
  fileExists('web/src/pages/Home.tsx');
  fileContains('web/src/pages/Home.tsx', 'MolamI18n');
});

test('Web: Language switcher component', () => {
  fileExists('web/src/components/LanguageSwitcher.tsx');
});

test('Web: Package configuration', () => {
  fileExists('web/package.json');
  fileExists('web/vite.config.ts');
});

// ============================================================================
// Test 5: Mobile (React Native)
// ============================================================================
console.log('\nTest 5: Mobile (React Native)');

test('Mobile: I18n Provider', () => {
  fileExists('mobile/src/I18nProvider.tsx');
  fileContains('mobile/src/I18nProvider.tsx', 'I18nContext');
  fileContains('mobile/src/I18nProvider.tsx', 'useI18n');
});

test('Mobile: Home screen', () => {
  fileExists('mobile/src/HomeScreen.tsx');
  fileContains('mobile/src/HomeScreen.tsx', 'useI18n');
});

// ============================================================================
// Test 6: HarmonyOS (ArkTS)
// ============================================================================
console.log('\nTest 6: HarmonyOS (ArkTS)');

test('HarmonyOS: I18nManager', () => {
  fileExists('harmony/feature/i18n/I18nManager.ets');
  fileContains('harmony/feature/i18n/I18nManager.ets', 'export class I18nManager');
});

test('HarmonyOS: HomePage', () => {
  fileExists('harmony/feature/i18n/HomePage.ets');
  fileContains('harmony/feature/i18n/HomePage.ets', 'I18nManager');
});

// ============================================================================
// Test 7: Admin Dashboard
// ============================================================================
console.log('\nTest 7: Admin Dashboard');

test('Admin: Translations management page', () => {
  fileExists('admin/src/pages/TranslationsAdmin.tsx');
  fileContains('admin/src/pages/TranslationsAdmin.tsx', 'Translation Management');
});

test('Admin: CRUD operations', () => {
  fileContains('admin/src/pages/TranslationsAdmin.tsx', 'handleCreate');
  fileContains('admin/src/pages/TranslationsAdmin.tsx', 'handleDelete');
});

test('Admin: Coverage display', () => {
  fileContains('admin/src/pages/TranslationsAdmin.tsx', 'coverage');
  fileContains('admin/src/pages/TranslationsAdmin.tsx', 'missing');
});

// ============================================================================
// Summary
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════');
console.log(`📊 Résumé: ${passed}/${passed + failed} tests réussis (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log('═══════════════════════════════════════════════════════════');

if (failed === 0) {
  console.log('✅ Tests de structure RÉUSSIS\n');
  process.exit(0);
} else {
  console.log(`❌ ${failed} test(s) échoué(s)\n`);
  process.exit(1);
}
