// src/routes/biometrics.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import {
  startRegistration,
  finishRegistration,
  startAuthentication,
  finishAuthentication,
} from "../util/webauthn.js";
import { pool } from "../util/pg.js";
import { redis } from "../util/redis.js";
import { audit } from "../util/audit.js";
import { siraSignal, updateDeviceTrust } from "../util/sira.js";
import { createRateLimiter } from "../util/rate.js";

const router = Router();

// Stricter rate limits for enrollment/assertion
const enrollLimiter = createRateLimiter(5, 300); // 5 enrollments per 5 minutes
const assertLimiter = createRateLimiter(10, 60);  // 10 assertions per minute

/**
 * POST /v1/biometrics/enroll/begin
 * Begin WebAuthn enrollment (registration)
 *
 * Request body:
 * - platform: 'web' | 'ios' | 'android' | 'harmony' | 'desktop'
 * - deviceLabel?: string (optional device name)
 */
router.post("/enroll/begin", enrollLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.sub;

    const schema = z.object({
      platform: z.enum(["web", "ios", "android", "harmony", "desktop"]),
      deviceLabel: z.string().optional(),
    });

    const { platform, deviceLabel } = schema.parse(req.body);

    // Get existing credentials to exclude
    const { rows: existingCreds } = await pool.query(
      "SELECT credential_id FROM molam_webauthn_credentials WHERE user_id = $1",
      [userId]
    );

    const excludeIds = existingCreds.map((c: any) => Buffer.from(c.credential_id));

    // Generate WebAuthn options
    const options = startRegistration(
      req.user!.sub, // username (user_id)
      userId,
      excludeIds
    );

    // Store challenge in Redis with 5-minute TTL
    const challengeKey = `webauthn:register:${userId}`;
    await redis.setEx(challengeKey, 300, options.challenge);

    // Create device record
    const deviceId = uuid();
    await pool.query(
      `INSERT INTO molam_devices
       (id, user_id, device_label, platform, attested)
       VALUES ($1, $2, $3, $4, false)`,
      [deviceId, userId, deviceLabel || platform, platform]
    );

    // Audit
    await audit(userId, deviceId, "enroll_begin", req, { platform });

    res.json({ options, deviceId });
  } catch (err: any) {
    console.error("Enroll begin error:", err);

    if (err.name === "ZodError") {
      return res.status(400).json({ error: "validation_error", details: err.errors });
    }

    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /v1/biometrics/enroll/finish
 * Finish WebAuthn enrollment
 *
 * Request body:
 * - deviceId: string (UUID from begin step)
 * - clientResponse: WebAuthn credential creation response
 */
router.post("/enroll/finish", enrollLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.sub;

    const schema = z.object({
      deviceId: z.string().uuid(),
      clientResponse: z.any(),
    });

    const { deviceId, clientResponse } = schema.parse(req.body);

    // Retrieve challenge from Redis
    const challengeKey = `webauthn:register:${userId}`;
    const challenge = await redis.get(challengeKey);

    if (!challenge) {
      return res.status(400).json({ error: "challenge_expired" });
    }

    // Verify registration response
    const verification = await finishRegistration(challenge, clientResponse);

    if (!verification.verified) {
      await audit(userId, deviceId, "enroll_fail", req, { reason: "attestation_failed" });
      return res.status(400).json({ error: "attestation_failed" });
    }

    const regInfo = verification.registrationInfo!;

    // Store credential
    const credentialId = Buffer.from(regInfo.credentialID);
    const publicKey = Buffer.from(regInfo.credentialPublicKey);

    await pool.query(
      `INSERT INTO molam_webauthn_credentials
       (id, user_id, device_id, credential_id, public_key, sign_count, aaguid,
        attestation_format, backup_eligible, backup_state, attestation_trust_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (credential_id) DO NOTHING`,
      [
        uuid(),
        userId,
        deviceId,
        credentialId,
        publicKey,
        regInfo.counter || 0,
        regInfo.aaguid || null,
        verification.registrationInfo?.fmt || "none",
        regInfo.credentialBackedUp || false,
        regInfo.credentialDeviceType === "multiDevice",
        JSON.stringify(regInfo),
      ]
    );

    // Mark device as attested
    await pool.query(
      "UPDATE molam_devices SET attested = true, last_seen_at = NOW() WHERE id = $1",
      [deviceId]
    );

    // Enable biometrics for user
    await pool.query(
      `INSERT INTO molam_biometric_prefs (user_id, biometrics_enabled, country_code, currency)
       VALUES ($1, true, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET biometrics_enabled = true, updated_at = NOW()`,
      [userId, req.user!.country || null, req.user!.currency || "XOF"]
    );

    // Delete challenge
    await redis.del(challengeKey);

    // Audit & SIRA
    await audit(userId, deviceId, "enroll_finish", req);
    await siraSignal(userId, { biometric_enrolled: true });
    await updateDeviceTrust(userId, deviceId, 0.9); // High trust for new enrolled device

    res.json({ status: "ok" });
  } catch (err: any) {
    console.error("Enroll finish error:", err);

    if (err.name === "ZodError") {
      return res.status(400).json({ error: "validation_error", details: err.errors });
    }

    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /v1/biometrics/assert/begin
 * Begin WebAuthn assertion (authentication/step-up)
 */
router.post("/assert/begin", assertLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.sub;

    // Get user's credentials
    const { rows } = await pool.query(
      "SELECT credential_id FROM molam_webauthn_credentials WHERE user_id = $1",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: "no_credentials" });
    }

    const allowIds = rows.map((c: any) => Buffer.from(c.credential_id));

    // Generate authentication options
    const options = startAuthentication(allowIds);

    // Store challenge in Redis
    const challengeKey = `webauthn:assert:${userId}`;
    await redis.setEx(challengeKey, 300, options.challenge);

    await audit(userId, null, "assert_begin", req);

    res.json({ options });
  } catch (err: any) {
    console.error("Assert begin error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /v1/biometrics/assert/finish
 * Finish WebAuthn assertion
 *
 * Request body:
 * - clientResponse: WebAuthn assertion response
 */
router.post("/assert/finish", assertLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.sub;

    const schema = z.object({
      clientResponse: z.any(),
    });

    const { clientResponse } = schema.parse(req.body);

    // Retrieve challenge
    const challengeKey = `webauthn:assert:${userId}`;
    const challenge = await redis.get(challengeKey);

    if (!challenge) {
      return res.status(400).json({ error: "challenge_expired" });
    }

    // Get credential data
    const credId = Buffer.from(clientResponse.rawId, "base64url");
    const { rows } = await pool.query(
      "SELECT credential_id, public_key, sign_count, device_id FROM molam_webauthn_credentials WHERE credential_id = $1 AND user_id = $2",
      [credId, userId]
    );

    if (rows.length === 0) {
      await audit(userId, null, "assert_fail", req, { reason: "credential_not_found" });
      return res.status(401).json({ error: "auth_failed" });
    }

    const cred = rows[0];

    // Verify assertion
    const verification = await finishAuthentication(
      challenge,
      clientResponse,
      Buffer.from(cred.public_key),
      parseInt(cred.sign_count, 10)
    );

    if (!verification.verified) {
      await audit(userId, cred.device_id, "assert_fail", req, { reason: "verification_failed" });
      return res.status(401).json({ error: "auth_failed" });
    }

    // Update sign count (clone detection)
    const newCounter = verification.authenticationInfo.newCounter;
    await pool.query(
      "UPDATE molam_webauthn_credentials SET sign_count = $1, last_used_at = NOW() WHERE credential_id = $2",
      [newCounter, credId]
    );

    // Update device last seen
    if (cred.device_id) {
      await pool.query(
        "UPDATE molam_devices SET last_seen_at = NOW() WHERE id = $1",
        [cred.device_id]
      );
    }

    // Delete challenge
    await redis.del(challengeKey);

    // Store step-up timestamp in user record
    await pool.query(
      "UPDATE molam_users SET step_up_at = NOW() WHERE id = $1",
      [userId]
    );

    // Audit & SIRA
    await audit(userId, cred.device_id, "assert_success", req);
    await siraSignal(userId, { biometric_assert_ok: true, signal_biometric_ok: true });

    res.json({ status: "ok" });
  } catch (err: any) {
    console.error("Assert finish error:", err);

    if (err.name === "ZodError") {
      return res.status(400).json({ error: "validation_error", details: err.errors });
    }

    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * GET /v1/biometrics/prefs
 * Get user's biometric preferences
 */
router.get("/prefs", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.sub;

    const { rows } = await pool.query(
      "SELECT * FROM molam_biometric_prefs WHERE user_id = $1",
      [userId]
    );

    const prefs = rows[0] || {
      biometrics_enabled: false,
      require_biometric_for_sensitive: true,
      step_up_threshold: 50000,
      country_code: req.user!.country,
      currency: req.user!.currency || "XOF",
    };

    res.json(prefs);
  } catch (err: any) {
    console.error("Get prefs error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * PATCH /v1/biometrics/prefs
 * Update user's biometric preferences
 */
router.patch("/prefs", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.sub;

    const schema = z.object({
      biometrics_enabled: z.boolean().optional(),
      require_biometric_for_sensitive: z.boolean().optional(),
      step_up_threshold: z.number().min(0).optional(),
    });

    const data = schema.parse(req.body);

    await pool.query(
      `INSERT INTO molam_biometric_prefs
       (user_id, biometrics_enabled, require_biometric_for_sensitive, step_up_threshold)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         biometrics_enabled = COALESCE($2, molam_biometric_prefs.biometrics_enabled),
         require_biometric_for_sensitive = COALESCE($3, molam_biometric_prefs.require_biometric_for_sensitive),
         step_up_threshold = COALESCE($4, molam_biometric_prefs.step_up_threshold),
         updated_at = NOW()`,
      [
        userId,
        data.biometrics_enabled,
        data.require_biometric_for_sensitive,
        data.step_up_threshold,
      ]
    );

    await audit(userId, null, "prefs_update", req, data);

    res.json({ status: "ok" });
  } catch (err: any) {
    console.error("Update prefs error:", err);

    if (err.name === "ZodError") {
      return res.status(400).json({ error: "validation_error", details: err.errors });
    }

    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * GET /v1/biometrics/devices
 * List user's registered devices
 */
router.get("/devices", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.sub;

    const { rows } = await pool.query(
      `SELECT d.id, d.device_label, d.platform, d.os_version, d.app_version,
              d.attested, d.created_at, d.last_seen_at,
              COUNT(c.id) as credential_count
       FROM molam_devices d
       LEFT JOIN molam_webauthn_credentials c ON c.device_id = d.id
       WHERE d.user_id = $1
       GROUP BY d.id
       ORDER BY d.last_seen_at DESC`,
      [userId]
    );

    res.json({ devices: rows });
  } catch (err: any) {
    console.error("List devices error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * DELETE /v1/biometrics/credentials/:credentialId
 * Revoke a specific credential
 */
router.delete("/credentials/:credentialId", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.sub;
    const credentialIdB64 = req.params.credentialId;

    const credentialId = Buffer.from(credentialIdB64, "base64url");

    const result = await pool.query(
      "DELETE FROM molam_webauthn_credentials WHERE user_id = $1 AND credential_id = $2",
      [userId, credentialId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "credential_not_found" });
    }

    await audit(userId, null, "credential_revoked", req, { credentialId: credentialIdB64 });

    res.json({ status: "ok" });
  } catch (err: any) {
    console.error("Revoke credential error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * DELETE /v1/biometrics/devices/:deviceId
 * Remove a device and all its credentials
 */
router.delete("/devices/:deviceId", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.sub;
    const deviceId = req.params.deviceId;

    // Verify device belongs to user
    const { rows } = await pool.query(
      "SELECT id FROM molam_devices WHERE id = $1 AND user_id = $2",
      [deviceId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "device_not_found" });
    }

    // Delete credentials for this device
    await pool.query(
      "DELETE FROM molam_webauthn_credentials WHERE device_id = $1",
      [deviceId]
    );

    // Delete device
    await pool.query("DELETE FROM molam_devices WHERE id = $1", [deviceId]);

    await audit(userId, deviceId, "device_removed", req);

    res.json({ status: "ok" });
  } catch (err: any) {
    console.error("Remove device error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
