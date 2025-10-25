// device.test.js - Device Fingerprint E2E Tests
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { pool } from '../src/device/repo.js';

const API_URL = process.env.API_URL || 'http://localhost:8083';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Helper to generate test JWT
function generateTestJWT(userId) {
  return jwt.sign(
    { user_id: userId, sub: userId, email: 'test@molam.sn' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Brique 10 - Device Fingerprint & Binding', () => {
  let device_pk;
  let token;
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';

  beforeAll(() => {
    token = generateTestJWT(testUserId);
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await pool.query('DELETE FROM molam_device_bindings WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM molam_devices WHERE device_pk = $1', [device_pk]);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
    await pool.end();
  });

  it('1. Health check', async () => {
    const response = await request(API_URL)
      .get('/healthz')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('id-device');
  });

  it('2. Register a web device', async () => {
    const fingerprint = {
      platform: 'web',
      os_name: 'Web',
      os_version: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      web_uid: 'test-web-uid-12345',
      screen: '1920x1080',
      tz: 'Africa/Dakar',
      locale: 'fr-SN'
    };

    const response = await request(API_URL)
      .post('/v1/device/register')
      .send({
        fingerprint,
        platform: 'web',
        model: 'Chrome-120',
        os_name: 'Web',
        os_version: 'Windows 10'
      })
      .expect(201);

    expect(response.body.device_pk).toBeDefined();
    device_pk = response.body.device_pk;
    console.log('  ✅ Device registered:', device_pk);
  });

  it('3. Bind device to user (with WebAuthn proof)', async () => {
    const response = await request(API_URL)
      .post('/v1/device/bind')
      .set('Authorization', `Bearer ${token}`)
      .send({
        device_pk,
        proof: {
          type: 'webauthn',
          attObj: { id: 'test-credential-id' }
        },
        via_channel: 'web'
      })
      .expect(201);

    expect(response.body.status).toBe('bound');
    expect(response.body.trust_level).toBeDefined();
    expect(['low', 'medium', 'high']).toContain(response.body.trust_level);
    console.log('  ✅ Device bound with trust:', response.body.trust_level);
  });

  it('4. Verify device and step-up trust', async () => {
    const response = await request(API_URL)
      .post('/v1/device/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        device_pk,
        proof: {
          type: 'webauthn',
          attObj: { id: 'test-credential-id-2' }
        }
      })
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.trust_level).toBeDefined();
    console.log('  ✅ Device verified with trust:', response.body.trust_level);
  });

  it('5. List user devices', async () => {
    const response = await request(API_URL)
      .get('/v1/device/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.devices).toBeDefined();
    expect(Array.isArray(response.body.devices)).toBe(true);
    expect(response.body.devices.length).toBeGreaterThan(0);

    const device = response.body.devices[0];
    expect(device.device_pk).toBe(device_pk);
    expect(device.platform).toBe('web');
    console.log(`  ✅ Found ${response.body.devices.length} device(s)`);
  });

  it('6. Revoke device binding', async () => {
    const response = await request(API_URL)
      .post('/v1/device/revoke')
      .set('Authorization', `Bearer ${token}`)
      .send({ device_pk })
      .expect(200);

    expect(response.body.status).toBe('revoked');
    console.log('  ✅ Device revoked');
  });

  it('7. Verify revoked device fails', async () => {
    const response = await request(API_URL)
      .post('/v1/device/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ device_pk })
      .expect(404);

    expect(response.body.error).toBe('not_bound');
    console.log('  ✅ Revoked device correctly rejected');
  });
});

console.log('\n🧪 Running Brique 10 - Device Fingerprint Tests...\n');
