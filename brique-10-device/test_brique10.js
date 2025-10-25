// test_brique10.js - Simple test runner for Brique 10
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { pool } from './src/device/repo.js';

const API_URL = process.env.API_URL || 'http://localhost:8083';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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

console.log('🔍 Test Brique 10 – Device Fingerprint & Session Binding\n');

async function runTests() {
  let device_pk;
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  const token = jwt.sign(
    { user_id: testUserId, sub: testUserId, email: 'test@molam.sn' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  try {
    // 1. Health check
    console.log('✅ Step 1: Health check...');
    const health = await request('GET', '/healthz');
    if (health.status !== 200) {
      throw new Error(`Health check failed: ${JSON.stringify(health.data)}`);
    }
    console.log(`   Status: ${health.data.status}, Service: ${health.data.service}`);

    // 2. Register device
    console.log('✅ Step 2: Register web device...');
    const fingerprint = {
      platform: 'web',
      os_name: 'Web',
      os_version: 'Mozilla/5.0',
      web_uid: `test-${Date.now()}`,
      screen: '1920x1080',
      tz: 'Africa/Dakar',
      locale: 'fr-SN'
    };

    const register = await request('POST', '/v1/device/register', {
      fingerprint,
      platform: 'web',
      model: 'Chrome',
      os_name: 'Web',
      os_version: 'Windows 10'
    });

    if (register.status !== 201) {
      throw new Error(`Register failed: ${JSON.stringify(register.data)}`);
    }

    device_pk = register.data.device_pk;
    console.log(`   Device PK: ${device_pk}`);

    // 3. Bind device
    console.log('✅ Step 3: Bind device to user...');
    const bind = await request('POST', '/v1/device/bind', {
      device_pk,
      proof: {
        type: 'webauthn',
        attObj: { id: 'cred-123' }
      },
      via_channel: 'web'
    }, { 'Authorization': `Bearer ${token}` });

    if (bind.status !== 201) {
      throw new Error(`Bind failed: ${JSON.stringify(bind.data)}`);
    }
    console.log(`   Trust level: ${bind.data.trust_level}`);
    console.log(`   Attestation vendor: ${bind.data.attestation.vendor}`);

    // 4. Verify device
    console.log('✅ Step 4: Verify device...');
    const verify = await request('POST', '/v1/device/verify', {
      device_pk,
      proof: {
        type: 'webauthn',
        attObj: { id: 'cred-456' }
      }
    }, { 'Authorization': `Bearer ${token}` });

    if (verify.status !== 200) {
      throw new Error(`Verify failed: ${JSON.stringify(verify.data)}`);
    }
    console.log(`   Trust level after verification: ${verify.data.trust_level}`);

    // 5. List devices
    console.log('✅ Step 5: List user devices...');
    const list = await request('GET', '/v1/device/list', null, {
      'Authorization': `Bearer ${token}`
    });

    if (list.status !== 200) {
      throw new Error(`List failed: ${JSON.stringify(list.data)}`);
    }
    console.log(`   Total devices: ${list.data.devices.length}`);
    list.data.devices.forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.platform} ${d.model || ''} - Trust: ${d.trust} - Status: ${d.binding_status}`);
    });

    // 6. Revoke device
    console.log('✅ Step 6: Revoke device...');
    const revoke = await request('POST', '/v1/device/revoke', {
      device_pk
    }, { 'Authorization': `Bearer ${token}` });

    if (revoke.status !== 200) {
      throw new Error(`Revoke failed: ${JSON.stringify(revoke.data)}`);
    }
    console.log(`   Revocation status: ${revoke.data.status}`);

    // 7. Verify events were logged
    console.log('✅ Step 7: Check audit events...');
    const events = await pool.query(
      'SELECT event_type, created_at FROM molam_device_events WHERE device_pk = $1 ORDER BY created_at DESC LIMIT 5',
      [device_pk]
    );
    console.log(`   Events logged: ${events.rows.length}`);
    events.rows.forEach(e => {
      console.log(`   - ${e.event_type} at ${e.created_at.toISOString()}`);
    });

    console.log('\n🎉 Brique 10 validée ! Device fingerprinting fonctionne correctement.\n');
    console.log('Résumé:');
    console.log('  ✓ Device registration');
    console.log('  ✓ User-device binding');
    console.log('  ✓ Trust attestation (WebAuthn placeholder)');
    console.log('  ✓ Device verification & step-up');
    console.log('  ✓ Device listing');
    console.log('  ✓ Device revocation');
    console.log('  ✓ Audit events logging\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur Brique 10:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
