// routes.js - Device API endpoints
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from './repo.js';
import { canonicalizeFingerprint, fingerprintHash } from './hash.js';
import { v4 as uuid } from 'uuid';
import { verifyPlayIntegrity, verifyDeviceCheck, verifyWebAuthn } from './attest.js';
import { deviceCfg } from './config.js';

const router = Router();

/**
 * JWT authentication middleware
 */
function requireJWT(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'unauthorized', message: 'Token required' });
    }

    const decoded = jwt.verify(token, deviceCfg.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid token' });
  }
}

/**
 * 1) Register device (no binding yet)
 * POST /v1/device/register
 * Body: { fingerprint: {...}, platform, model, os_name, os_version }
 */
router.post('/register', async (req, res) => {
  try {
    const { fingerprint, platform, model, os_name, os_version } = req.body || {};

    if (!fingerprint || !platform) {
      return res.status(400).json({ error: 'invalid_request', message: 'fingerprint and platform required' });
    }

    const canonical = canonicalizeFingerprint({
      ...fingerprint,
      platform,
      model,
      os_name,
      os_version
    });

    const h = fingerprintHash(canonical);
    const devicePk = uuid();

    const { rows } = await pool.query(
      `INSERT INTO molam_devices(device_pk, device_fingerprint_sha256, platform, model, os_name, os_version, integrity_vendor)
       VALUES ($1, $2, $3, $4, $5, $6, 'none')
       ON CONFLICT (device_fingerprint_sha256, platform) DO UPDATE
       SET updated_at = NOW()
       RETURNING device_pk`,
      [devicePk, h, platform, model || null, os_name || null, os_version || null]
    );

    const returnedDevicePk = rows[0].device_pk;

    // Log event
    await pool.query(
      `INSERT INTO molam_device_events(id, device_pk, event_type, detail)
       VALUES ($1, $2, 'register', $3)`,
      [uuid(), returnedDevicePk, JSON.stringify({ platform, model })]
    );

    return res.status(201).json({ device_pk: returnedDevicePk });
  } catch (error) {
    console.error('Device register error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * 2) Bind device to user (requires JWT)
 * POST /v1/device/bind
 * Body: { device_pk, proof?: { type, token, nonce, attObj } }
 */
router.post('/bind', requireJWT, async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.sub;
    const { device_pk, proof } = req.body || {};

    if (!device_pk) {
      return res.status(400).json({ error: 'device_missing', message: 'device_pk required' });
    }

    // Check if device exists
    const deviceCheck = await pool.query(
      'SELECT device_pk FROM molam_devices WHERE device_pk = $1',
      [device_pk]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'device_not_found', message: 'Device must be registered first' });
    }

    // Optional attestation
    let attRes = { verdict: 'failed', score: 0, vendor: 'none' };

    if (proof?.type === 'play') {
      attRes = await verifyPlayIntegrity(proof.token, proof.nonce);
    } else if (proof?.type === 'apple') {
      attRes = await verifyDeviceCheck(proof.token, proof.nonce);
    } else if (proof?.type === 'webauthn') {
      attRes = await verifyWebAuthn(proof.attObj);
    }

    const trust = attRes.verdict === 'passed' ? 'medium' : 'low';

    // Check if binding already exists
    const existingBinding = await pool.query(
      `SELECT id FROM molam_device_bindings
       WHERE user_id = $1 AND device_pk = $2 AND binding_status = 'active'`,
      [userId, device_pk]
    );

    if (existingBinding.rows.length > 0) {
      // Update existing binding
      await pool.query(
        `UPDATE molam_device_bindings
         SET trust = $1, last_seen_at = NOW(), via_channel = $2
         WHERE user_id = $3 AND device_pk = $4`,
        [trust, req.body?.via_channel || 'mobile', userId, device_pk]
      );
    } else {
      // Create new binding
      await pool.query(
        `INSERT INTO molam_device_bindings(id, user_id, device_pk, trust, via_channel)
         VALUES ($1, $2, $3, $4, $5)`,
        [uuid(), userId, device_pk, trust, req.body?.via_channel || 'mobile']
      );
    }

    // Store attestation if provided
    if (attRes.vendor !== 'none') {
      await pool.query(
        `INSERT INTO molam_device_attestations(id, device_pk, user_id, vendor, verdict, score, payload_jws)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          uuid(),
          device_pk,
          userId,
          attRes.vendor,
          attRes.verdict,
          attRes.score,
          proof?.token || JSON.stringify(proof?.attObj || {})
        ]
      );
    }

    // Log event
    await pool.query(
      `INSERT INTO molam_device_events(id, user_id, device_pk, event_type, detail)
       VALUES ($1, $2, $3, 'bind', $4)`,
      [uuid(), userId, device_pk, JSON.stringify({ trust, vendor: attRes.vendor })]
    );

    return res.status(201).json({
      status: 'bound',
      trust_level: trust,
      attestation: attRes
    });
  } catch (error) {
    console.error('Device bind error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * 3) Step-up verification for sensitive operations
 * POST /v1/device/verify
 * Body: { device_pk, proof?: { type, token, nonce, attObj } }
 */
router.post('/verify', requireJWT, async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.sub;
    const { device_pk, proof } = req.body || {};

    if (!device_pk) {
      return res.status(400).json({ error: 'device_missing', message: 'device_pk required' });
    }

    const { rows } = await pool.query(
      `SELECT trust, binding_status
       FROM molam_device_bindings
       WHERE user_id = $1 AND device_pk = $2 AND binding_status = 'active'`,
      [userId, device_pk]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'not_bound', message: 'Device not bound to user' });
    }

    let trust = rows[0].trust;

    // Optional fresh attestation to raise trust
    if (proof?.type) {
      let att;

      if (proof.type === 'play') {
        att = await verifyPlayIntegrity(proof.token, proof.nonce);
      } else if (proof.type === 'apple') {
        att = await verifyDeviceCheck(proof.token, proof.nonce);
      } else if (proof.type === 'webauthn') {
        att = await verifyWebAuthn(proof.attObj);
      } else {
        att = { verdict: 'failed', score: 0, vendor: 'none' };
      }

      // Store attestation
      await pool.query(
        `INSERT INTO molam_device_attestations(id, device_pk, user_id, vendor, verdict, score, payload_jws)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          uuid(),
          device_pk,
          userId,
          att.vendor,
          att.verdict,
          att.score,
          proof?.token || JSON.stringify(proof?.attObj || {})
        ]
      );

      if (att.verdict === 'passed' && att.score >= 80) {
        trust = 'high';
        await pool.query(
          `UPDATE molam_device_bindings
           SET trust = 'high', last_seen_at = NOW()
           WHERE user_id = $1 AND device_pk = $2`,
          [userId, device_pk]
        );

        await pool.query(
          `INSERT INTO molam_device_events(id, user_id, device_pk, event_type, detail)
           VALUES ($1, $2, $3, 'attest_pass', $4)`,
          [uuid(), userId, device_pk, JSON.stringify({ vendor: att.vendor, score: att.score })]
        );
      } else {
        await pool.query(
          `INSERT INTO molam_device_events(id, user_id, device_pk, event_type, detail)
           VALUES ($1, $2, $3, 'attest_fail', $4)`,
          [uuid(), userId, device_pk, JSON.stringify({ vendor: att.vendor })]
        );
      }
    } else {
      // Just update last seen
      await pool.query(
        `UPDATE molam_device_bindings
         SET last_seen_at = NOW()
         WHERE user_id = $1 AND device_pk = $2`,
        [userId, device_pk]
      );
    }

    return res.json({ status: 'ok', trust_level: trust });
  } catch (error) {
    console.error('Device verify error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * 4) List user's devices
 * GET /v1/device/list
 */
router.get('/list', requireJWT, async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.sub;

    const { rows } = await pool.query(
      `SELECT b.id, b.device_pk, b.trust, b.binding_status,
              d.platform, d.model, d.os_name, d.os_version,
              b.last_seen_at, b.first_bound_at
       FROM molam_device_bindings b
       JOIN molam_devices d ON d.device_pk = b.device_pk
       WHERE b.user_id = $1
       ORDER BY b.last_seen_at DESC`,
      [userId]
    );

    return res.json({ devices: rows });
  } catch (error) {
    console.error('Device list error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * 5) Revoke device binding
 * POST /v1/device/revoke
 * Body: { device_pk }
 */
router.post('/revoke', requireJWT, async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.sub;
    const { device_pk } = req.body || {};

    if (!device_pk) {
      return res.status(400).json({ error: 'device_missing', message: 'device_pk required' });
    }

    await pool.query(
      `UPDATE molam_device_bindings
       SET binding_status = 'revoked'
       WHERE user_id = $1 AND device_pk = $2`,
      [userId, device_pk]
    );

    await pool.query(
      `INSERT INTO molam_device_events(id, user_id, device_pk, event_type)
       VALUES ($1, $2, $3, 'revoke')`,
      [uuid(), userId, device_pk]
    );

    return res.json({ status: 'revoked' });
  } catch (error) {
    console.error('Device revoke error:', error);
    return res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

export default router;
