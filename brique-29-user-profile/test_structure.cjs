// brique-29-user-profile/test_structure.cjs
// Structure validation tests for Brique 29

const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;

// =====================================================
// TEST UTILITIES
// =====================================================

let totalTests = 0;
let passedTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✓ ${description}`);
    passedTests++;
  } catch (error) {
    console.error(`✗ ${description}`);
    console.error(`  ${error.message}`);
  }
}

function fileExists(filePath) {
  const fullPath = path.join(BASE_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }
}

function fileContains(filePath, content) {
  const fullPath = path.join(BASE_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const fileContent = fs.readFileSync(fullPath, 'utf-8');
  if (!fileContent.includes(content)) {
    throw new Error(`File ${filePath} does not contain: ${content}`);
  }
}

function directoryExists(dirPath) {
  const fullPath = path.join(BASE_DIR, dirPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }
  if (!fs.statSync(fullPath).isDirectory()) {
    throw new Error(`Path exists but is not a directory: ${dirPath}`);
  }
}

// =====================================================
// TESTS
// =====================================================

console.log('\n========================================');
console.log('Brique 29: User Profile Structure Tests');
console.log('========================================\n');

// =====================================================
// SQL MIGRATION TESTS
// =====================================================

console.log('SQL Migration Tests:');

test('SQL migration file exists', () => {
  fileExists('sql/029_user_profile.sql');
});

test('SQL creates molam_user_profiles table', () => {
  fileContains('sql/029_user_profile.sql', 'CREATE TABLE IF NOT EXISTS molam_user_profiles');
});

test('SQL creates molam_media_assets table', () => {
  fileContains('sql/029_user_profile.sql', 'CREATE TABLE IF NOT EXISTS molam_media_assets');
});

test('SQL creates molam_badges table', () => {
  fileContains('sql/029_user_profile.sql', 'CREATE TABLE IF NOT EXISTS molam_badges');
});

test('SQL creates molam_user_badges table', () => {
  fileContains('sql/029_user_profile.sql', 'CREATE TABLE IF NOT EXISTS molam_user_badges');
});

test('SQL creates molam_user_activity table', () => {
  fileContains('sql/029_user_profile.sql', 'CREATE TABLE IF NOT EXISTS molam_user_activity');
});

test('SQL creates molam_user_privacy table', () => {
  fileContains('sql/029_user_profile.sql', 'CREATE TABLE IF NOT EXISTS molam_user_privacy');
});

test('SQL creates molam_profile_audit table', () => {
  fileContains('sql/029_user_profile.sql', 'CREATE TABLE IF NOT EXISTS molam_profile_audit');
});

test('SQL creates get_user_profile function', () => {
  fileContains('sql/029_user_profile.sql', 'CREATE OR REPLACE FUNCTION get_user_profile');
});

test('SQL creates get_user_badges function', () => {
  fileContains('sql/029_user_profile.sql', 'CREATE OR REPLACE FUNCTION get_user_badges');
});

test('SQL creates get_user_activity_feed function', () => {
  fileContains('sql/029_user_profile.sql', 'CREATE OR REPLACE FUNCTION get_user_activity_feed');
});

test('SQL creates assign_badge function', () => {
  fileContains('sql/029_user_profile.sql', 'CREATE OR REPLACE FUNCTION assign_badge');
});

test('SQL creates revoke_badge function', () => {
  fileContains('sql/029_user_profile.sql', 'CREATE OR REPLACE FUNCTION revoke_badge');
});

test('SQL creates log_user_activity function', () => {
  fileContains('sql/029_user_profile.sql', 'CREATE OR REPLACE FUNCTION log_user_activity');
});

test('SQL creates get_all_user_data function (GDPR)', () => {
  fileContains('sql/029_user_profile.sql', 'CREATE OR REPLACE FUNCTION get_all_user_data');
});

test('SQL creates delete_all_user_data function (GDPR)', () => {
  fileContains('sql/029_user_profile.sql', 'CREATE OR REPLACE FUNCTION delete_all_user_data');
});

test('SQL preloads badges', () => {
  fileContains('sql/029_user_profile.sql', "INSERT INTO molam_badges");
  fileContains('sql/029_user_profile.sql', "'verified'");
  fileContains('sql/029_user_profile.sql', "'agent_pay'");
});

test('SQL enables RLS on profiles', () => {
  fileContains('sql/029_user_profile.sql', 'ALTER TABLE molam_user_profiles ENABLE ROW LEVEL SECURITY');
});

// =====================================================
// SERVICE TESTS
// =====================================================

console.log('\nService Tests:');

test('Profile service file exists', () => {
  fileExists('api/src/services/profile/profile.service.ts');
});

test('Service exports ProfileService class', () => {
  fileContains('api/src/services/profile/profile.service.ts', 'export class ProfileService');
});

test('Service has getProfile method', () => {
  fileContains('api/src/services/profile/profile.service.ts', 'async getProfile(');
});

test('Service has updateProfile method', () => {
  fileContains('api/src/services/profile/profile.service.ts', 'async updateProfile(');
});

test('Service has uploadMedia method', () => {
  fileContains('api/src/services/profile/profile.service.ts', 'async uploadMedia(');
});

test('Service has S3 integration', () => {
  fileContains('api/src/services/profile/profile.service.ts', '@aws-sdk/client-s3');
  fileContains('api/src/services/profile/profile.service.ts', 'S3Client');
});

test('Service has assignBadge method', () => {
  fileContains('api/src/services/profile/profile.service.ts', 'async assignBadge(');
});

test('Service has revokeBadge method', () => {
  fileContains('api/src/services/profile/profile.service.ts', 'async revokeBadge(');
});

test('Service has logActivity method', () => {
  fileContains('api/src/services/profile/profile.service.ts', 'async logActivity(');
});

test('Service has privacy methods', () => {
  fileContains('api/src/services/profile/profile.service.ts', 'async getPrivacySettings(');
  fileContains('api/src/services/profile/profile.service.ts', 'async updatePrivacySettings(');
});

test('Service has GDPR methods', () => {
  fileContains('api/src/services/profile/profile.service.ts', 'async exportUserData(');
  fileContains('api/src/services/profile/profile.service.ts', 'async deleteProfile(');
});

// =====================================================
// API ROUTES TESTS
// =====================================================

console.log('\nAPI Routes Tests:');

test('Routes file exists', () => {
  fileExists('api/src/routes/profile.routes.ts');
});

test('Routes export createProfileRouter', () => {
  fileContains('api/src/routes/profile.routes.ts', 'export function createProfileRouter');
});

test('Routes have rate limiting', () => {
  fileContains('api/src/routes/profile.routes.ts', 'express-rate-limit');
  fileContains('api/src/routes/profile.routes.ts', 'publicRateLimit');
  fileContains('api/src/routes/profile.routes.ts', 'authRateLimit');
  fileContains('api/src/routes/profile.routes.ts', 'uploadRateLimit');
});

test('Routes have authentication middleware', () => {
  fileContains('api/src/routes/profile.routes.ts', 'const authenticate');
});

test('Routes have RBAC middleware', () => {
  fileContains('api/src/routes/profile.routes.ts', 'const requireRole');
});

test('Routes have multer for file uploads', () => {
  fileContains('api/src/routes/profile.routes.ts', "import multer from 'multer'");
  fileContains('api/src/routes/profile.routes.ts', 'upload.single');
});

test('Routes have public endpoints', () => {
  fileContains('api/src/routes/profile.routes.ts', "router.get('/profile/:userId'");
  fileContains('api/src/routes/profile.routes.ts', "router.get('/profile/:userId/badges'");
  fileContains('api/src/routes/profile.routes.ts', "router.get('/profile/:userId/activity'");
});

test('Routes have authenticated endpoints', () => {
  fileContains('api/src/routes/profile.routes.ts', "router.put('/profile'");
  fileContains('api/src/routes/profile.routes.ts', "router.post('/profile/media'");
  fileContains('api/src/routes/profile.routes.ts', "router.get('/profile/export'");
});

test('Routes have admin endpoints', () => {
  fileContains('api/src/routes/profile.routes.ts', "router.post('/admin/profile/badges/assign'");
  fileContains('api/src/routes/profile.routes.ts', "router.post('/admin/profile/badges/revoke'");
  fileContains('api/src/routes/profile.routes.ts', "router.post('/admin/profile/media/:assetId/moderate'");
});

// =====================================================
// SDK TESTS
// =====================================================

console.log('\nSDK Tests:');

test('SDK file exists', () => {
  fileExists('sdk/molam-profile.ts');
});

test('SDK exports MolamProfile class', () => {
  fileContains('sdk/molam-profile.ts', 'export class MolamProfile');
});

test('SDK has profile methods', () => {
  fileContains('sdk/molam-profile.ts', 'async getProfile(');
  fileContains('sdk/molam-profile.ts', 'async updateProfile(');
});

test('SDK has media methods', () => {
  fileContains('sdk/molam-profile.ts', 'async uploadMedia(');
  fileContains('sdk/molam-profile.ts', 'async uploadAvatar(');
  fileContains('sdk/molam-profile.ts', 'async uploadBanner(');
  fileContains('sdk/molam-profile.ts', 'async getSignedMediaUrl(');
});

test('SDK has badge methods', () => {
  fileContains('sdk/molam-profile.ts', 'async getUserBadges(');
});

test('SDK has activity methods', () => {
  fileContains('sdk/molam-profile.ts', 'async getUserActivity(');
  fileContains('sdk/molam-profile.ts', 'async deleteActivity(');
});

test('SDK has privacy methods', () => {
  fileContains('sdk/molam-profile.ts', 'async getPrivacySettings(');
  fileContains('sdk/molam-profile.ts', 'async updatePrivacySettings(');
});

test('SDK has GDPR method', () => {
  fileContains('sdk/molam-profile.ts', 'async exportData(');
});

test('SDK has helper functions', () => {
  fileContains('sdk/molam-profile.ts', 'export function formatFileSize');
  fileContains('sdk/molam-profile.ts', 'export function validateImageFile');
  fileContains('sdk/molam-profile.ts', 'export function formatActivityTime');
});

// =====================================================
// MEDIA WORKER TESTS
// =====================================================

console.log('\nMedia Worker Tests:');

test('Worker file exists', () => {
  fileExists('api/src/workers/media.worker.ts');
});

test('Worker exports MediaProcessor class', () => {
  fileContains('api/src/workers/media.worker.ts', 'export class MediaProcessor');
});

test('Worker exports MediaWorker class', () => {
  fileContains('api/src/workers/media.worker.ts', 'export class MediaWorker');
});

test('Worker has sharp for image processing', () => {
  fileContains('api/src/workers/media.worker.ts', "import sharp from 'sharp'");
});

test('Worker has S3 integration', () => {
  fileContains('api/src/workers/media.worker.ts', '@aws-sdk/client-s3');
});

test('Worker has processAsset method', () => {
  fileContains('api/src/workers/media.worker.ts', 'async processAsset(');
});

test('Worker generates variants', () => {
  fileContains('api/src/workers/media.worker.ts', 'VARIANTS');
  fileContains('api/src/workers/media.worker.ts', 'avatar');
  fileContains('api/src/workers/media.worker.ts', 'banner');
  fileContains('api/src/workers/media.worker.ts', 'thumbnail');
});

// =====================================================
// ADMIN DASHBOARD TESTS
// =====================================================

console.log('\nAdmin Dashboard Tests:');

test('Admin dashboard file exists', () => {
  fileExists('admin/src/pages/ProfileAdmin.tsx');
});

test('Admin dashboard exports default component', () => {
  fileContains('admin/src/pages/ProfileAdmin.tsx', 'export default function ProfileAdmin');
});

test('Admin dashboard has statistics tab', () => {
  fileContains('admin/src/pages/ProfileAdmin.tsx', 'StatisticsTab');
  fileContains('admin/src/pages/ProfileAdmin.tsx', 'getProfileStatistics');
});

test('Admin dashboard has badge management tab', () => {
  fileContains('admin/src/pages/ProfileAdmin.tsx', 'BadgeManagementTab');
  fileContains('admin/src/pages/ProfileAdmin.tsx', 'getBadgeStatistics');
});

test('Admin dashboard has moderation tab', () => {
  fileContains('admin/src/pages/ProfileAdmin.tsx', 'ModerationTab');
  fileContains('admin/src/pages/ProfileAdmin.tsx', 'moderateMedia');
});

test('Admin dashboard has assign badge modal', () => {
  fileContains('admin/src/pages/ProfileAdmin.tsx', 'AssignBadgeModal');
  fileContains('admin/src/pages/ProfileAdmin.tsx', 'assignBadge');
});

// =====================================================
// RESULTS
// =====================================================

console.log('\n========================================');
console.log(`Results: ${passedTests}/${totalTests} tests passed`);
console.log('========================================\n');

process.exit(passedTests === totalTests ? 0 : 1);
