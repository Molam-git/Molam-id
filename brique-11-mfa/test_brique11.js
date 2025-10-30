import http from 'http';
import crypto from 'crypto';
import pkg from 'pg';
const { Pool } = pkg;
import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:8084';
const MAIN_DB_URL = process.env.DATABASE_URL || 'postgres://molam:molam_pass@localhost:5432/molam';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const pool = new Pool({ connectionString: MAIN_DB_URL });

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

// Helper: Generate test JWT
function generateTestJWT(userId, email, phone = null) {
  return jwt.sign(
    {
      user_id: userId,
      email: email,
      phone: phone,
      roles: ['user']
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Helper: Clean test data
async function cleanupTestData(userId) {
  await pool.query('DELETE FROM molam_mfa_audit WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM molam_mfa_otps WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM molam_mfa_recovery_codes WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM molam_mfa_factors WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM molam_users WHERE id = $1', [userId]);
}

// Test suite
async function runTests() {
  console.log('🧪 Starting Brique 11 - MFA Tests\n');

  let passed = 0;
  let failed = 0;

  const testUserId = crypto.randomUUID();
  const testEmail = `test-mfa-${Date.now()}@molam.test`;
  const testPhone = '+22500000000';
  let testToken = '';

  try {
    // Cleanup any previous test data
    await cleanupTestData(testUserId);

    // Create test user
    await pool.query(
      `INSERT INTO molam_users (id, email, phone_e164, molam_id, status, created_at)
       VALUES ($1, $2, $3, $4, 'active', NOW())`,
      [testUserId, testEmail, testPhone, `ML-${Date.now()}`]
    );
    console.log(`✅ Created test user: ${testUserId}`);

    testToken = generateTestJWT(testUserId, testEmail, testPhone);

    // Test 1: Health check
    console.log('\n📋 Test 1: Health check');
    try {
      const health = await request('GET', '/api/mfa/health');
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

    // Test 2: Enroll SMS OTP factor
    console.log('\n📋 Test 2: Enroll SMS OTP factor');
    let smsFactorId = null;
    try {
      const enroll = await request('POST', '/api/mfa/enroll', {
        factor_type: 'sms_otp',
        channel: testPhone,
        label: 'Primary Phone',
        is_primary: true
      }, {
        'Authorization': `Bearer ${testToken}`
      });

      if (enroll.status === 201 && enroll.data.factor_type === 'sms_otp') {
        smsFactorId = enroll.data.factor_id;
        console.log('✅ SMS OTP enrolled:', smsFactorId);
        passed++;
      } else {
        console.log('❌ SMS OTP enrollment failed:', enroll.status, enroll.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ SMS OTP enrollment error:', err.message);
      failed++;
    }

    // Test 3: Enroll TOTP factor
    console.log('\n📋 Test 3: Enroll TOTP factor');
    let totpFactorId = null;
    let totpUri = null;
    try {
      const enroll = await request('POST', '/api/mfa/enroll', {
        factor_type: 'totp',
        label: 'Authenticator App'
      }, {
        'Authorization': `Bearer ${testToken}`
      });

      if (enroll.status === 201 && enroll.data.factor_type === 'totp') {
        totpFactorId = enroll.data.factor_id;
        totpUri = enroll.data.public_data?.uri;
        console.log('✅ TOTP enrolled:', totpFactorId);
        console.log('   URI:', totpUri?.substring(0, 50) + '...');
        passed++;
      } else {
        console.log('❌ TOTP enrollment failed:', enroll.status, enroll.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ TOTP enrollment error:', err.message);
      failed++;
    }

    // Test 4: List enrolled factors
    console.log('\n📋 Test 4: List enrolled factors');
    try {
      const list = await request('GET', '/api/mfa/factors', null, {
        'Authorization': `Bearer ${testToken}`
      });

      if (list.status === 200 && list.data.factors.length >= 2) {
        console.log('✅ Factors listed:', list.data.factors.length);
        list.data.factors.forEach(f => {
          console.log(`   - ${f.factor_type} (${f.label || 'unlabeled'}) [${f.is_active ? 'active' : 'inactive'}]`);
        });
        passed++;
      } else {
        console.log('❌ List factors failed:', list.status, list.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ List factors error:', err.message);
      failed++;
    }

    // Test 5: Start SMS OTP challenge
    console.log('\n📋 Test 5: Start SMS OTP challenge');
    let challengeId = null;
    let otpCode = null;
    try {
      const challenge = await request('POST', '/api/mfa/challenge', {
        scope: 'login'
      }, {
        'Authorization': `Bearer ${testToken}`
      });

      if (challenge.status === 200 && challenge.data.challenge_id) {
        challengeId = challenge.data.challenge_id;
        otpCode = challenge.data.code; // Available in test mode
        console.log('✅ Challenge created:', challengeId);
        console.log('   OTP code (test mode):', otpCode);
        passed++;
      } else {
        console.log('❌ Challenge failed:', challenge.status, challenge.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ Challenge error:', err.message);
      failed++;
    }

    // Test 6: Verify SMS OTP with invalid code
    console.log('\n📋 Test 6: Verify with invalid code (should fail)');
    try {
      const verify = await request('POST', '/api/mfa/verify', {
        challenge_id: challengeId,
        code: '000000' // Wrong code
      });

      if (verify.status === 401 && verify.data.code === 'INVALID_CODE') {
        console.log('✅ Invalid code rejected correctly');
        passed++;
      } else {
        console.log('❌ Should have rejected invalid code:', verify.status, verify.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ Verify error:', err.message);
      failed++;
    }

    // Test 7: Verify SMS OTP with correct code
    console.log('\n📋 Test 7: Verify with correct code');
    let mfaToken = null;
    try {
      const verify = await request('POST', '/api/mfa/verify', {
        challenge_id: challengeId,
        code: otpCode
      });

      if (verify.status === 200 && verify.data.success && verify.data.mfa_token) {
        mfaToken = verify.data.mfa_token;
        console.log('✅ OTP verified successfully');
        console.log('   MFA token:', mfaToken.substring(0, 30) + '...');
        passed++;
      } else {
        console.log('❌ Verification failed:', verify.status, verify.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ Verify error:', err.message);
      failed++;
    }

    // Test 8: Generate recovery codes
    console.log('\n📋 Test 8: Generate recovery codes');
    let recoveryCodes = [];
    try {
      const enroll = await request('POST', '/api/mfa/enroll', {
        factor_type: 'recovery_code'
      }, {
        'Authorization': `Bearer ${testToken}`
      });

      if (enroll.status === 201 && enroll.data.recovery_codes) {
        recoveryCodes = enroll.data.recovery_codes;
        console.log('✅ Recovery codes generated:', recoveryCodes.length);
        console.log('   Sample:', recoveryCodes[0]);
        passed++;
      } else {
        console.log('❌ Recovery code generation failed:', enroll.status, enroll.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ Recovery code error:', err.message);
      failed++;
    }

    // Test 9: Use recovery code
    console.log('\n📋 Test 9: Use recovery code');
    try {
      if (recoveryCodes.length > 0) {
        const recovery = await request('POST', '/api/mfa/recovery', {
          user_id: testUserId,
          recovery_code: recoveryCodes[0]
        });

        if (recovery.status === 200 && recovery.data.success) {
          console.log('✅ Recovery code accepted');
          passed++;
        } else {
          console.log('❌ Recovery code failed:', recovery.status, recovery.data);
          failed++;
        }
      } else {
        console.log('⚠️  Skipping recovery code test (no codes available)');
      }
    } catch (err) {
      console.log('❌ Recovery code error:', err.message);
      failed++;
    }

    // Test 10: Get MFA policy
    console.log('\n📋 Test 10: Get MFA policy');
    try {
      const policy = await request('GET', '/api/mfa/policy/login');

      if (policy.status === 200 && policy.data.scope === 'login') {
        console.log('✅ Policy retrieved:', JSON.stringify(policy.data.rule));
        passed++;
      } else {
        console.log('❌ Policy retrieval failed:', policy.status, policy.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ Policy error:', err.message);
      failed++;
    }

    // Test 11: Remove factor
    console.log('\n📋 Test 11: Remove MFA factor');
    try {
      if (totpFactorId) {
        const remove = await request('DELETE', `/api/mfa/factors/${totpFactorId}`, null, {
          'Authorization': `Bearer ${testToken}`
        });

        if (remove.status === 200 && remove.data.success) {
          console.log('✅ Factor removed successfully');
          passed++;
        } else {
          console.log('❌ Factor removal failed:', remove.status, remove.data);
          failed++;
        }
      } else {
        console.log('⚠️  Skipping factor removal test (no factor ID)');
      }
    } catch (err) {
      console.log('❌ Remove factor error:', err.message);
      failed++;
    }

    // Test 12: Check audit logs
    console.log('\n📋 Test 12: Verify audit logs');
    try {
      const logs = await pool.query(
        `SELECT event_type, success, created_at
         FROM molam_mfa_audit
         WHERE user_id = $1
         ORDER BY created_at ASC`,
        [testUserId]
      );

      if (logs.rows.length >= 5) {
        console.log('✅ Audit logs recorded:', logs.rows.length);
        logs.rows.forEach(log => {
          console.log(`   - ${log.event_type} [${log.success ? 'success' : 'failed'}]`);
        });
        passed++;
      } else {
        console.log('❌ Insufficient audit logs:', logs.rows.length);
        failed++;
      }
    } catch (err) {
      console.log('❌ Audit log check error:', err.message);
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
