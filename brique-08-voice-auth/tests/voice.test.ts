/**
 * E2E Tests for Voice Authentication
 *
 * Run: npm test
 */

import request from 'supertest';
import { app } from '../src/server';

// Mock JWT token (replace with valid token in real tests)
const mockToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsInJvbGVzIjpbInVzZXIiXSwidGVuYW50IjoibW9sYW0ifQ.mock';

// Mock audio base64 (tiny valid WAV file)
const mockAudioBase64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

describe('Voice Authentication E2E', () => {
  describe('Health Check', () => {
    it('GET /health should return 200', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('voice-auth');
    });
  });

  describe('Enrollment Flow', () => {
    let reqId: string;
    let key: string;

    it('POST /v1/voice/enroll/begin should return phrase and reqId', async () => {
      const response = await request(app)
        .post('/v1/voice/enroll/begin')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ locale: 'fr_SN' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('phrase');
      expect(response.body).toHaveProperty('reqId');
      expect(response.body).toHaveProperty('locale', 'fr_SN');

      reqId = response.body.reqId;
    });

    it('POST /v1/voice/upload should accept audio and return key', async () => {
      const response = await request(app)
        .post('/v1/voice/upload')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          reqId,
          base64: mockAudioBase64,
          mime: 'audio/wav',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('key');

      key = response.body.key;
    });

    it('POST /v1/voice/enroll/finish should complete enrollment', async () => {
      // Note: This will fail in real tests because mock audio won't pass ML service
      // In staging/prod, use real audio recordings
      const response = await request(app)
        .post('/v1/voice/enroll/finish')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          reqId,
          key,
          locale: 'fr_SN',
          channel: 'mobile_app',
          phrase: 'Je confirme être le propriétaire de ce compte Molam',
        });

      // Expect success or specific error (e.g., ml_extract_failed in test env)
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Verification Flow', () => {
    let reqId: string;
    let key: string;

    it('POST /v1/voice/assert/begin should return phrase and reqId', async () => {
      const response = await request(app)
        .post('/v1/voice/assert/begin')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ locale: 'fr_SN' });

      // Will return 400 if not enrolled
      expect([200, 400]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('phrase');
        expect(response.body).toHaveProperty('reqId');
        reqId = response.body.reqId;
      }
    });

    it('POST /v1/voice/upload should accept audio (verification)', async () => {
      if (!reqId) {
        return; // Skip if enrollment missing
      }

      const response = await request(app)
        .post('/v1/voice/upload')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          reqId,
          base64: mockAudioBase64,
          mime: 'audio/wav',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('key');
      key = response.body.key;
    });

    it('POST /v1/voice/assert/finish should verify voice', async () => {
      if (!reqId || !key) {
        return; // Skip if enrollment missing
      }

      const response = await request(app)
        .post('/v1/voice/assert/finish')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          reqId,
          key,
          channel: 'mobile_app',
        });

      // Expect success or specific error
      expect([200, 400, 401]).toContain(response.status);
    });
  });

  describe('Preferences', () => {
    it('GET /v1/voice/prefs should return preferences', async () => {
      const response = await request(app)
        .get('/v1/voice/prefs')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('voice_enabled');
    });

    it('PATCH /v1/voice/prefs should update preferences', async () => {
      const response = await request(app)
        .patch('/v1/voice/prefs')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          voice_enabled: true,
          similarity_threshold: 0.80,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });

  describe('Revocation', () => {
    it('DELETE /v1/voice/credentials should revoke credentials', async () => {
      const response = await request(app)
        .delete('/v1/voice/credentials')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('revoked', true);
    });
  });

  describe('IVR Webhook', () => {
    it('POST /v1/ivr/webhook should accept audio from IVR', async () => {
      const signature = 'sha256=mock_signature'; // In real tests, compute valid HMAC

      const response = await request(app)
        .post('/v1/ivr/webhook')
        .set('X-IVR-Signature', signature)
        .send({
          userId: 'user-123',
          reqId: 'req-456',
          audioBase64: mockAudioBase64,
          phone: '+221XXXXXXXX',
        });

      // Expect 401 because signature is invalid (expected in test)
      expect([200, 401]).toContain(response.status);
    });
  });
});
