// brique-30-export-profile/test_structure.cjs
// Structure validation tests for Brique 30

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
console.log('Brique 30: Export Profile Structure Tests');
console.log('========================================\n');

// =====================================================
// SQL MIGRATION TESTS
// =====================================================

console.log('SQL Migration Tests:');

test('SQL migration file exists', () => {
  fileExists('sql/030_profile_export.sql');
});

test('SQL creates molam_profile_exports table', () => {
  fileContains('sql/030_profile_export.sql', 'CREATE TABLE IF NOT EXISTS molam_profile_exports');
});

test('SQL creates molam_export_sections table', () => {
  fileContains('sql/030_profile_export.sql', 'CREATE TABLE IF NOT EXISTS molam_export_sections');
});

test('SQL creates molam_export_audit table', () => {
  fileContains('sql/030_profile_export.sql', 'CREATE TABLE IF NOT EXISTS molam_export_audit');
});

test('SQL has export status check constraint', () => {
  fileContains('sql/030_profile_export.sql', "CHECK (format IN ('json', 'pdf'))");
  fileContains('sql/030_profile_export.sql', "CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'expired'))");
});

test('SQL creates request_profile_export function', () => {
  fileContains('sql/030_profile_export.sql', 'CREATE OR REPLACE FUNCTION request_profile_export');
});

test('SQL creates get_export_status function', () => {
  fileContains('sql/030_profile_export.sql', 'CREATE OR REPLACE FUNCTION get_export_status');
});

test('SQL creates mark_export_downloaded function', () => {
  fileContains('sql/030_profile_export.sql', 'CREATE OR REPLACE FUNCTION mark_export_downloaded');
});

test('SQL creates cleanup_expired_exports function', () => {
  fileContains('sql/030_profile_export.sql', 'CREATE OR REPLACE FUNCTION cleanup_expired_exports');
});

test('SQL creates get_pending_exports function', () => {
  fileContains('sql/030_profile_export.sql', 'CREATE OR REPLACE FUNCTION get_pending_exports');
});

test('SQL creates update_export_status function', () => {
  fileContains('sql/030_profile_export.sql', 'CREATE OR REPLACE FUNCTION update_export_status');
});

test('SQL creates get_export_statistics function', () => {
  fileContains('sql/030_profile_export.sql', 'CREATE OR REPLACE FUNCTION get_export_statistics');
});

test('SQL creates audit trigger', () => {
  fileContains('sql/030_profile_export.sql', 'CREATE TRIGGER trg_export_audit');
  fileContains('sql/030_profile_export.sql', 'CREATE OR REPLACE FUNCTION log_export_event');
});

test('SQL creates expiration trigger', () => {
  fileContains('sql/030_profile_export.sql', 'CREATE TRIGGER trg_export_expiration');
  fileContains('sql/030_profile_export.sql', 'CREATE OR REPLACE FUNCTION set_export_expiration');
});

test('SQL creates views', () => {
  fileContains('sql/030_profile_export.sql', 'CREATE OR REPLACE VIEW v_active_exports');
  fileContains('sql/030_profile_export.sql', 'CREATE OR REPLACE VIEW v_export_stats_by_user');
});

test('SQL enables RLS', () => {
  fileContains('sql/030_profile_export.sql', 'ALTER TABLE molam_profile_exports ENABLE ROW LEVEL SECURITY');
  fileContains('sql/030_profile_export.sql', 'CREATE POLICY exports_select_own');
});

test('SQL preloads export sections', () => {
  fileContains('sql/030_profile_export.sql', "INSERT INTO molam_export_sections");
  fileContains('sql/030_profile_export.sql', "'profile'");
  fileContains('sql/030_profile_export.sql', "'badges'");
  fileContains('sql/030_profile_export.sql', "'activity'");
});

// =====================================================
// SERVICE TESTS
// =====================================================

console.log('\nService Tests:');

test('Export service file exists', () => {
  fileExists('api/src/services/export/export.service.ts');
});

test('Service exports ExportService class', () => {
  fileContains('api/src/services/export/export.service.ts', 'export class ExportService');
});

test('Service has requestExport method', () => {
  fileContains('api/src/services/export/export.service.ts', 'async requestExport(');
});

test('Service has processExport method', () => {
  fileContains('api/src/services/export/export.service.ts', 'async processExport(');
});

test('Service has getDownloadUrl method', () => {
  fileContains('api/src/services/export/export.service.ts', 'async getDownloadUrl(');
});

test('Service has S3 integration', () => {
  fileContains('api/src/services/export/export.service.ts', '@aws-sdk/client-s3');
  fileContains('api/src/services/export/export.service.ts', 'S3Client');
  fileContains('api/src/services/export/export.service.ts', 'PutObjectCommand');
});

test('Service has PDF generation', () => {
  fileContains('api/src/services/export/export.service.ts', 'pdfkit');
  fileContains('api/src/services/export/export.service.ts', 'PDFDocument');
  fileContains('api/src/services/export/export.service.ts', 'generatePDF');
});

test('Service has JSON generation with HMAC', () => {
  fileContains('api/src/services/export/export.service.ts', 'generateJSON');
  fileContains('api/src/services/export/export.service.ts', 'createHmac');
  fileContains('api/src/services/export/export.service.ts', 'signature');
});

test('Service has gatherProfileData method', () => {
  fileContains('api/src/services/export/export.service.ts', 'gatherProfileData');
});

test('Service has cleanupExpiredExports method', () => {
  fileContains('api/src/services/export/export.service.ts', 'async cleanupExpiredExports(');
});

test('Service has getExportStatistics method', () => {
  fileContains('api/src/services/export/export.service.ts', 'async getExportStatistics(');
});

// =====================================================
// API ROUTES TESTS
// =====================================================

console.log('\nAPI Routes Tests:');

test('Routes file exists', () => {
  fileExists('api/src/routes/export.routes.ts');
});

test('Routes export createExportRouter', () => {
  fileContains('api/src/routes/export.routes.ts', 'export function createExportRouter');
});

test('Routes have rate limiting', () => {
  fileContains('api/src/routes/export.routes.ts', 'express-rate-limit');
  fileContains('api/src/routes/export.routes.ts', 'exportRateLimit');
});

test('Routes have authentication middleware', () => {
  fileContains('api/src/routes/export.routes.ts', 'const authenticate');
});

test('Routes have RBAC middleware', () => {
  fileContains('api/src/routes/export.routes.ts', 'const requireRole');
});

test('Routes have Zod validation', () => {
  fileContains('api/src/routes/export.routes.ts', "import { z } from 'zod'");
  fileContains('api/src/routes/export.routes.ts', 'RequestExportSchema');
});

test('Routes have request export endpoint', () => {
  fileContains('api/src/routes/export.routes.ts', "router.post");
  fileContains('api/src/routes/export.routes.ts', "'/api/profile/export'");
});

test('Routes have get status endpoint', () => {
  fileContains('api/src/routes/export.routes.ts', "router.get");
  fileContains('api/src/routes/export.routes.ts', "'/api/profile/export/:exportId'");
});

test('Routes have download endpoint', () => {
  fileContains('api/src/routes/export.routes.ts', "'/api/profile/export/:exportId/download'");
});

test('Routes have list exports endpoint', () => {
  fileContains('api/src/routes/export.routes.ts', "'/api/profile/exports'");
});

test('Routes have admin endpoints', () => {
  fileContains('api/src/routes/export.routes.ts', "'/api/admin/profile/export/:userId'");
  fileContains('api/src/routes/export.routes.ts', "'/api/admin/profile/export/cleanup'");
});

// =====================================================
// WORKER TESTS
// =====================================================

console.log('\nWorker Tests:');

test('Worker file exists', () => {
  fileExists('api/src/workers/export.worker.ts');
});

test('Worker exports ExportWorker class', () => {
  fileContains('api/src/workers/export.worker.ts', 'export class ExportWorker');
});

test('Worker has start method', () => {
  fileContains('api/src/workers/export.worker.ts', 'start():');
});

test('Worker has stop method', () => {
  fileContains('api/src/workers/export.worker.ts', 'stop():');
});

test('Worker has poll method', () => {
  fileContains('api/src/workers/export.worker.ts', 'poll():');
});

test('Worker has processBatch method', () => {
  fileContains('api/src/workers/export.worker.ts', 'processBatch():');
});

test('Worker has cleanup job', () => {
  fileContains('api/src/workers/export.worker.ts', 'startCleanupJob');
  fileContains('api/src/workers/export.worker.ts', 'cleanupExpiredExports');
});

test('Worker has graceful shutdown', () => {
  fileContains('api/src/workers/export.worker.ts', 'SIGINT');
  fileContains('api/src/workers/export.worker.ts', 'SIGTERM');
});

// =====================================================
// RESULTS
// =====================================================

console.log('\n========================================');
console.log(`Results: ${passedTests}/${totalTests} tests passed`);
console.log('========================================\n');

process.exit(passedTests === totalTests ? 0 : 1);
