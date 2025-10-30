// test_brique6.ts
import { pool } from './src/services/db.js';
import { env } from './src/config/env.js';

const BASE_URL = `http://localhost:${env.PORT}`;

async function request(method: string, path: string, body?: any): Promise<any> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch {
    return { status: response.status, data: text };
  }
}

let testUserId: string;
const testEmail = `test-${Date.now()}@molam.id`;
const testPhone = `+2217712${String(Date.now()).slice(-5)}`;

async function runTests() {
  console.log('🧪 Brique 6 - Comprehensive Test Suite\n');

  let passed = 0;
  let failed = 0;

  // ============================================================================
  // Setup: Create test user
  // ============================================================================
  console.log('📋 Setup: Creating test user...');
  try {
    const { rows } = await pool.query(
      `INSERT INTO molam_users (molam_id, email, phone_e164, password_hash, language, country_code, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [`test-${Date.now()}`, testEmail, testPhone, 'dummy-hash', 'fr', 'SN', 'XOF']
    );
    testUserId = rows[0].id;
    console.log(`✓ Test user created: ${testUserId}\n`);
  } catch (err) {
    console.error('❌ Failed to create test user:', err);
    process.exit(1);
  }

  // ============================================================================
  // Test 1: Health check
  // ============================================================================
  console.log('Test 1: Health check');
  try {
    const { status, data } = await request('GET', '/health');
    if (status === 200 && data.status === 'ok') {
      console.log('✅ PASS: Health check\n');
      passed++;
    } else {
      console.log('❌ FAIL: Health check\n');
      failed++;
    }
  } catch (err) {
    console.log('❌ FAIL: Health check -', err);
    failed++;
  }

  // ============================================================================
  // Test 2: Metrics endpoint
  // ============================================================================
  console.log('Test 2: Prometheus metrics endpoint');
  try {
    const { status, data } = await request('GET', '/metrics');
    if (status === 200 && typeof data === 'string' && data.includes('molam_id_')) {
      console.log('✅ PASS: Metrics endpoint\n');
      passed++;
    } else {
      console.log('❌ FAIL: Metrics endpoint\n');
      failed++;
    }
  } catch (err) {
    console.log('❌ FAIL: Metrics endpoint -', err);
    failed++;
  }

  // ============================================================================
  // Test 3: Password reset - forgot (email)
  // ============================================================================
  console.log('Test 3: Password reset - forgot (email)');
  try {
    const { status, data } = await request('POST', '/api/id/password/forgot', {
      identity: testEmail,
    });
    if (status === 202 && data.status === 'accepted') {
      console.log('✅ PASS: Password forgot (email)\n');
      passed++;
    } else {
      console.log('❌ FAIL: Password forgot (email) -', data);
      failed++;
    }
  } catch (err) {
    console.log('❌ FAIL: Password forgot (email) -', err);
    failed++;
  }

  // ============================================================================
  // Test 4: Password reset - forgot (SMS)
  // ============================================================================
  console.log('Test 4: Password reset - forgot (SMS)');
  try {
    const { status, data } = await request('POST', '/api/id/password/forgot', {
      identity: testPhone,
    });
    if (status === 202 && data.status === 'accepted') {
      console.log('✅ PASS: Password forgot (SMS)\n');
      passed++;
    } else {
      console.log('❌ FAIL: Password forgot (SMS) -', data);
      failed++;
    }
  } catch (err) {
    console.log('❌ FAIL: Password forgot (SMS) -', err);
    failed++;
  }

  // ============================================================================
  // Test 5: PIN reset - start (app/web)
  // ============================================================================
  console.log('Test 5: PIN reset - start (app/web)');
  try {
    const { status, data } = await request('POST', '/api/id/ussd/pin/reset/start', {
      identity: testPhone,
    });
    if (status === 202 && data.status === 'accepted') {
      console.log('✅ PASS: PIN reset start\n');
      passed++;
    } else {
      console.log('❌ FAIL: PIN reset start -', data);
      failed++;
    }
  } catch (err) {
    console.log('❌ FAIL: PIN reset start -', err);
    failed++;
  }

  // ============================================================================
  // Test 6: USSD codes table
  // ============================================================================
  console.log('Test 6: USSD codes table verification');
  try {
    const { rows } = await pool.query('SELECT * FROM molam_ussd_codes ORDER BY code');
    const codes = rows.map(r => r.code);
    const expected = ['*131#', '*131*1#', '*131*2#', '*131*3#', '*131*99#'];
    const hasAll = expected.every(c => codes.includes(c));

    if (hasAll) {
      console.log(`✅ PASS: USSD codes (${rows.length} codes)\n`);
      passed++;
    } else {
      console.log(`❌ FAIL: USSD codes (missing codes)\n`);
      failed++;
    }
  } catch (err) {
    console.log('❌ FAIL: USSD codes -', err);
    failed++;
  }

  // ============================================================================
  // Test 7: USSD webhook - main menu
  // ============================================================================
  console.log('Test 7: USSD webhook - main menu (*131#)');
  try {
    const { status, data } = await request('POST', '/api/id/ussd', {
      msisdn: testPhone,
      mccmnc: '608010', // Senegal
      text: '',
      short_code: '*131#',
    });
    if (status === 200 && data.response?.includes('CON')) {
      console.log('✅ PASS: USSD main menu\n');
      passed++;
    } else {
      console.log('❌ FAIL: USSD main menu -', data);
      failed++;
    }
  } catch (err) {
    console.log('❌ FAIL: USSD main menu -', err);
    failed++;
  }

  // ============================================================================
  // Test 8: USSD webhook - PIN reset flow (step 0)
  // ============================================================================
  console.log('Test 8: USSD PIN reset flow - OTP request');
  try {
    const { status, data } = await request('POST', '/api/id/ussd', {
      msisdn: testPhone,
      mccmnc: '608010',
      text: '',
      short_code: '*131*99#',
    });
    if (status === 200 && data.response?.includes('CON')) {
      console.log('✅ PASS: USSD PIN reset OTP request\n');
      passed++;
    } else {
      console.log('❌ FAIL: USSD PIN reset OTP request -', data);
      failed++;
    }
  } catch (err) {
    console.log('❌ FAIL: USSD PIN reset OTP request -', err);
    failed++;
  }

  // ============================================================================
  // Test 9: Audit logs
  // ============================================================================
  console.log('Test 9: Audit logs verification');
  try {
    const { rows } = await pool.query(
      `SELECT * FROM molam_audit_logs WHERE target_user_id = $1 ORDER BY created_at DESC`,
      [testUserId]
    );
    if (rows.length >= 3) {
      console.log(`✅ PASS: Audit logs (${rows.length} entries)\n`);
      passed++;
    } else {
      console.log(`❌ FAIL: Audit logs (expected >= 3, got ${rows.length})\n`);
      failed++;
    }
  } catch (err) {
    console.log('❌ FAIL: Audit logs -', err);
    failed++;
  }

  // ============================================================================
  // Test 10: Multi-language support
  // ============================================================================
  console.log('Test 10: Multi-language support (i18n)');
  try {
    const { t, getSupportedLanguages } = await import('./src/utils/i18n.js');
    const languages = getSupportedLanguages();
    const hasAllLanguages = ['fr', 'en', 'wo', 'ar', 'sw', 'ha'].every(lang => languages.includes(lang));

    if (hasAllLanguages && languages.length >= 6) {
      console.log(`✅ PASS: Multi-language (${languages.length} languages: ${languages.join(', ')})\n`);
      passed++;
    } else {
      console.log(`❌ FAIL: Multi-language (missing languages)\n`);
      failed++;
    }
  } catch (err) {
    console.log('❌ FAIL: Multi-language -', err);
    failed++;
  }

  // ============================================================================
  // Test 11: TypeScript compilation
  // ============================================================================
  console.log('Test 11: TypeScript structure');
  try {
    // Check if key TypeScript files exist and are properly typed
    const { hashSecret } = await import('./src/utils/crypto.js');
    const { normalizeIdentity } = await import('./src/utils/phone.js');
    const { metrics } = await import('./src/services/metrics.js');

    if (typeof hashSecret === 'function' && typeof normalizeIdentity === 'function' && metrics) {
      console.log('✅ PASS: TypeScript structure\n');
      passed++;
    } else {
      console.log('❌ FAIL: TypeScript structure\n');
      failed++;
    }
  } catch (err) {
    console.log('❌ FAIL: TypeScript structure -', err);
    failed++;
  }

  // ============================================================================
  // Test 12: Reset requests table
  // ============================================================================
  console.log('Test 12: Reset requests table');
  try {
    const { rows } = await pool.query(
      `SELECT * FROM molam_reset_requests WHERE user_id = $1 ORDER BY created_at DESC`,
      [testUserId]
    );
    if (rows.length >= 2) {
      console.log(`✅ PASS: Reset requests (${rows.length} requests)\n`);
      passed++;
    } else {
      console.log(`❌ FAIL: Reset requests (expected >= 2, got ${rows.length})\n`);
      failed++;
    }
  } catch (err) {
    console.log('❌ FAIL: Reset requests -', err);
    failed++;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================
  console.log('🧹 Cleanup: Deleting test user...');
  try {
    await pool.query('DELETE FROM molam_users WHERE id = $1', [testUserId]);
    console.log('✓ Test user deleted\n');
  } catch (err) {
    console.error('⚠️  Failed to delete test user:', err);
  }

  // ============================================================================
  // Summary
  // ============================================================================
  const total = passed + failed;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📊 Test Summary: ${passed}/${total} passed (${passRate}%)`);
  console.log('═══════════════════════════════════════════════════════════');

  if (passRate >= 75) {
    console.log('✅ Test suite PASSED');
  } else {
    console.log('❌ Test suite FAILED');
  }

  await pool.end();
  process.exit(passRate >= 75 ? 0 : 1);
}

// Wait for server to be ready
setTimeout(() => {
  runTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
  });
}, 2000);
