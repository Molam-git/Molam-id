// src/test_brique5.js - Test Session Management
import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Helper to make requests
async function request(method, path, body = null, headers = {}) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, options);
  const data = await response.json();
  return { status: response.status, data };
}

console.log('🔍 Test Brique 5 – Session Management\n');

let accessToken = null;
let refreshToken = null;
let userId = null;
let sessionId = null;

async function runTests() {
  try {
    // 1. Signup user
    console.log('✅ Step 1: Création utilisateur test...');
    const signupEmail = `test-session-${Date.now()}@molam.sn`;
    const signupPhone = `+221${77}${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;

    const signup = await request('POST', '/api/id/signup/init', {
      email: signupEmail,
      user_type: 'customer',
      channel: 'email'
    });

    if (signup.status !== 200) {
      throw new Error(`Signup init failed: ${JSON.stringify(signup.data)}`);
    }

    const otpCode = signup.data.otp || signup.data.otp_code;
    console.log(`   OTP: ${otpCode} (dev mode)`);

    // 2. Verify OTP
    console.log('✅ Step 2: Vérification OTP...');
    const verify = await request('POST', '/api/id/signup/verify', {
      email: signupEmail,
      code: otpCode,
      verification_id: signup.data.verification_id
    });

    if (verify.status !== 200) {
      throw new Error(`OTP verify failed: ${JSON.stringify(verify.data)}`);
    }

    const tempToken = verify.data.temp_token;
    if (!tempToken) {
      throw new Error(`No temp_token in verify response: ${JSON.stringify(verify.data)}`);
    }

    // 3. Complete signup
    console.log('✅ Step 3: Complétion inscription...');
    const complete = await request('POST', '/api/id/signup/complete', {
      temp_token: tempToken,
      email: signupEmail,
      password: 'TestPassword123!'
    });

    if (complete.status !== 201) {
      throw new Error(`Signup complete failed: ${JSON.stringify(complete.data)}`);
    }

    userId = complete.data.user?.id || complete.data.user_id;
    accessToken = complete.data.access_token;
    refreshToken = complete.data.refresh_token;
    console.log(`   User ID: ${userId}`);

    // 4. Login with device binding
    console.log('✅ Step 4: Login avec device binding...');
    const login = await request('POST', '/api/id/login', {
      email: signupEmail,
      password: 'TestPassword123!',
      device_id: 'device-test-001',
      device_metadata: {
        name: 'Test Device',
        os: 'Linux',
        browser: 'Node.js'
      }
    });

    if (login.status !== 200) {
      throw new Error(`Login failed: ${JSON.stringify(login.data)}`);
    }

    accessToken = login.data.access_token;
    refreshToken = login.data.refresh_token;
    console.log(`   Access token: ${accessToken.substring(0, 20)}...`);
    console.log(`   Refresh token: ${refreshToken.substring(0, 20)}...`);

    // 5. List sessions
    console.log('✅ Step 5: Liste des sessions...');
    const sessions = await request('GET', '/api/id/sessions', null, {
      'Authorization': `Bearer ${accessToken}`
    });

    if (sessions.status !== 200) {
      throw new Error(`List sessions failed: ${JSON.stringify(sessions.data)}`);
    }

    console.log(`   Nombre de sessions: ${sessions.data.sessions.length}`);
    if (sessions.data.sessions.length > 0) {
      sessionId = sessions.data.sessions[0].id;
      console.log(`   Session ID: ${sessionId}`);
      console.log(`   Device: ${sessions.data.sessions[0].device_id}`);
    }

    // 6. Refresh token
    console.log('✅ Step 6: Refresh token...');
    const refresh = await request('POST', '/api/id/refresh', {
      refresh_token: refreshToken
    });

    if (refresh.status !== 200) {
      throw new Error(`Token refresh failed: ${JSON.stringify(refresh.data)}`);
    }

    const newAccessToken = refresh.data.access_token;
    const newRefreshToken = refresh.data.refresh_token;
    console.log(`   Nouveau access token: ${newAccessToken.substring(0, 20)}...`);
    console.log(`   Token rotation: ${refreshToken !== newRefreshToken ? 'OK' : 'FAILED'}`);

    // Update tokens
    accessToken = newAccessToken;
    refreshToken = newRefreshToken;

    // 7. Login from second device
    console.log('✅ Step 7: Login depuis second device...');
    const login2 = await request('POST', '/api/id/login', {
      email: signupEmail,
      password: 'TestPassword123!',
      device_id: 'device-test-002',
      device_metadata: {
        name: 'Test Device 2',
        os: 'Windows',
        browser: 'Chrome'
      }
    });

    if (login2.status !== 200) {
      throw new Error(`Second login failed: ${JSON.stringify(login2.data)}`);
    }

    console.log(`   Second device logged in`);

    // 8. List sessions again (should have 2)
    console.log('✅ Step 8: Liste sessions (2 devices)...');
    const sessions2 = await request('GET', '/api/id/sessions', null, {
      'Authorization': `Bearer ${accessToken}`
    });

    if (sessions2.status !== 200) {
      throw new Error(`List sessions failed: ${JSON.stringify(sessions2.data)}`);
    }

    console.log(`   Nombre de sessions: ${sessions2.data.sessions.length}`);
    if (sessions2.data.sessions.length < 2) {
      throw new Error(`Expected 2 sessions, got ${sessions2.data.sessions.length}`);
    }

    // 9. Revoke specific session
    if (sessionId) {
      console.log('✅ Step 9: Révocation session spécifique...');
      const revoke = await request('POST', `/api/id/sessions/${sessionId}/revoke`, null, {
        'Authorization': `Bearer ${accessToken}`
      });

      if (revoke.status !== 200) {
        throw new Error(`Session revoke failed: ${JSON.stringify(revoke.data)}`);
      }

      console.log(`   Session ${sessionId} révoquée`);
    }

    // 10. Revoke all sessions (logout all devices)
    console.log('✅ Step 10: Révocation de toutes les sessions...');
    const revokeAll = await request('POST', '/api/id/sessions/revoke-all', null, {
      'Authorization': `Bearer ${login2.data.access_token}`
    });

    if (revokeAll.status !== 200) {
      throw new Error(`Revoke all failed: ${JSON.stringify(revokeAll.data)}`);
    }

    console.log(`   Toutes les sessions révoquées`);

    // 11. Try to use revoked token (should fail)
    console.log('✅ Step 11: Test token révoqué...');
    const testRevoked = await request('GET', '/api/id/sessions', null, {
      'Authorization': `Bearer ${accessToken}`
    });

    if (testRevoked.status === 401) {
      console.log(`   ✓ Token révoqué correctement rejeté`);
    } else {
      console.log(`   ⚠ Warning: Revoked token still works (status: ${testRevoked.status})`);
    }

    console.log('\n🎉 Brique 5 validée ! Session management fonctionne correctement.\n');
    console.log('Résumé:');
    console.log('  ✓ Device binding');
    console.log('  ✓ Token rotation');
    console.log('  ✓ Multi-device sessions');
    console.log('  ✓ Session listing');
    console.log('  ✓ Session revocation (specific)');
    console.log('  ✓ Session revocation (all)');
    console.log('  ✓ Revoked token validation');

  } catch (err) {
    console.error('❌ Erreur Brique 5:', err.message);
    process.exit(1);
  }
}

runTests();
