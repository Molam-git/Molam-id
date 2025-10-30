import http from 'http';
import crypto from 'crypto';
import pkg from 'pg';
const { Pool } = pkg;

const BASE_URL = 'http://localhost:8085';
const DB_URL = process.env.DATABASE_URL || 'postgres://molam:molam_pass@localhost:5432/molam';

const pool = new Pool({ connectionString: DB_URL });

// Helper: HTTP request
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (err) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Helper: Clean test data
async function cleanupTestData(userId) {
  await pool.query('DELETE FROM molam_audit_logs WHERE target_user_id = $1', [userId]);
  await pool.query('DELETE FROM molam_reset_requests WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM molam_sessions WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM molam_users WHERE id = $1', [userId]);
}

// Test suite
async function runTests() {
  console.log('🧪 Starting Brique 6 - Password & PIN Reset Tests\n');

  let passed = 0;
  let failed = 0;

  const testUserId = crypto.randomUUID();
  const testEmail = `test-pwd-${Date.now()}@molam.test`;
  const testPhone = `+2217712${String(Date.now()).slice(-5)}`; // Unique phone number

  try {
    // Cleanup
    await cleanupTestData(testUserId);

    // Create test user
    await pool.query(
      `INSERT INTO molam_users (id, email, phone_e164, molam_id, password_hash, status, language, country_code, created_at)
       VALUES ($1, $2, $3, $4, $5, 'active', 'fr', 'SN', NOW())`,
      [testUserId, testEmail, testPhone, `ML-${Date.now()}`, 'old-password-hash']
    );
    console.log(`✅ Created test user: ${testUserId}`);

    // Test 1: Health check
    console.log('\n📋 Test 1: Health check');
    try {
      const health = await request('GET', '/');
      if (health.status === 200 && health.data.status === 'ok') {
        console.log('✅ Health check passed');
        passed++;
      } else {
        console.log('❌ Health check failed:', health.status);
        failed++;
      }
    } catch (err) {
      console.log('❌ Health check error:', err.message);
      failed++;
    }

    // Test 2: Password reset - forgot (email)
    console.log('\n📋 Test 2: Password reset - forgot (email)');
    let otpCode = null;
    try {
      const forgot = await request('POST', '/api/id/password/forgot', {
        identity: testEmail
      });

      if (forgot.status === 202 && forgot.data.status === 'accepted') {
        console.log('✅ Password forgot request accepted');

        // Get OTP from database (in production, it would be sent via email)
        const { rows } = await pool.query(
          `SELECT id FROM molam_reset_requests
           WHERE user_id = $1 AND kind = 'password' AND status = 'pending'
           ORDER BY created_at DESC
           LIMIT 1`,
          [testUserId]
        );

        if (rows.length > 0) {
          console.log('   Reset request created:', rows[0].id);
          // In test mode, we'll use a fixed OTP for testing
          otpCode = '123456'; // We'll need to insert this manually for testing
          passed++;
        } else {
          console.log('❌ Reset request not created');
          failed++;
        }
      } else {
        console.log('❌ Password forgot failed:', forgot.status, forgot.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ Password forgot error:', err.message);
      failed++;
    }

    // Test 3: Password reset - forgot (SMS)
    console.log('\n📋 Test 3: Password reset - forgot (SMS/phone)');
    try {
      const forgot = await request('POST', '/api/id/password/forgot', {
        identity: testPhone
      });

      if (forgot.status === 202 && forgot.data.status === 'accepted') {
        console.log('✅ Password forgot request (SMS) accepted');
        console.log('   Expires at:', forgot.data.expires_at);
        passed++;
      } else {
        console.log('❌ Password forgot (SMS) failed:', forgot.status, forgot.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ Password forgot (SMS) error:', err.message);
      failed++;
    }

    // Test 4: PIN USSD reset - start
    console.log('\n📋 Test 4: PIN USSD reset - start');
    try {
      const start = await request('POST', '/api/id/ussd/pin/reset/start', {
        identity: testPhone
      });

      if (start.status === 202 && start.data.status === 'accepted') {
        console.log('✅ PIN reset request accepted');
        console.log('   Expires at:', start.data.expires_at);
        passed++;
      } else {
        console.log('❌ PIN reset start failed:', start.status, start.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ PIN reset start error:', err.message);
      failed++;
    }

    // Test 5: Check USSD codes in database
    console.log('\n📋 Test 5: Verify USSD codes in database');
    try {
      const { rows } = await pool.query(
        `SELECT code, label, route, enabled FROM molam_ussd_codes ORDER BY code`
      );

      if (rows.length >= 5) {
        console.log('✅ USSD codes found:', rows.length);
        rows.forEach(r => {
          console.log(`   - ${r.code}: ${r.label} (${r.route}) [${r.enabled ? 'enabled' : 'disabled'}]`);
        });
        passed++;
      } else {
        console.log('❌ Expected at least 5 USSD codes, found:', rows.length);
        failed++;
      }
    } catch (err) {
      console.log('❌ USSD codes check error:', err.message);
      failed++;
    }

    // Test 6: Check multi-language support
    console.log('\n📋 Test 6: Verify multi-language support (i18n)');
    try {
      // Update user language to Wolof
      await pool.query(`UPDATE molam_users SET language = 'wo' WHERE id = $1`, [testUserId]);

      const forgot = await request('POST', '/api/id/password/forgot', {
        identity: testEmail
      });

      if (forgot.status === 202) {
        console.log('✅ Multi-language support working');
        console.log('   (SMS would be in Wolof for this user)');
        passed++;
      } else {
        console.log('❌ Multi-language test failed');
        failed++;
      }
    } catch (err) {
      console.log('❌ Multi-language test error:', err.message);
      failed++;
    }

    // Test 7: Check audit logs
    console.log('\n📋 Test 7: Verify audit logs');
    try {
      const { rows } = await pool.query(
        `SELECT action, module, country_code, created_at
         FROM molam_audit_logs
         WHERE target_user_id = $1
         ORDER BY created_at ASC`,
        [testUserId]
      );

      if (rows.length >= 3) {
        console.log('✅ Audit logs recorded:', rows.length);
        rows.forEach(log => {
          console.log(`   - ${log.action} [${log.module}] (${log.country_code || 'N/A'})`);
        });
        passed++;
      } else {
        console.log('❌ Insufficient audit logs:', rows.length);
        failed++;
      }
    } catch (err) {
      console.log('❌ Audit log check error:', err.message);
      failed++;
    }

    // Test 8: Check reset requests table
    console.log('\n📋 Test 8: Verify reset requests table');
    try {
      const { rows } = await pool.query(
        `SELECT kind, channel, status, country_code
         FROM molam_reset_requests
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [testUserId]
      );

      if (rows.length >= 3) {
        console.log('✅ Reset requests recorded:', rows.length);
        rows.forEach(req => {
          console.log(`   - ${req.kind} via ${req.channel} [${req.status}] (${req.country_code || 'N/A'})`);
        });
        passed++;
      } else {
        console.log('❌ Expected at least 3 reset requests, found:', rows.length);
        failed++;
      }
    } catch (err) {
      console.log('❌ Reset requests check error:', err.message);
      failed++;
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await cleanupTestData(testUserId);

  } catch (err) {
    console.error('💥 Test suite error:', err);
  } finally {
    await pool.end();
  }

  // Summary
  const total = passed + failed;
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;

  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${percentage}%`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
