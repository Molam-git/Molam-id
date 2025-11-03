/**
 * Brique 10: Device Fingerprinting Routes
 * Identification et tracking des appareils
 */

import { pool } from '../../db.js';
import crypto from 'crypto';

/**
 * Génère un fingerprint unique basé sur les caractéristiques du device
 */
function generateDeviceFingerprint(deviceInfo) {
  const components = [
    deviceInfo.user_agent || '',
    deviceInfo.screen_resolution || '',
    deviceInfo.timezone || '',
    deviceInfo.language || '',
    deviceInfo.os || '',
    deviceInfo.browser || '',
    deviceInfo.canvas_fingerprint || '',
    deviceInfo.webgl_fingerprint || ''
  ];

  const fingerprintString = components.join('|');
  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
}

/**
 * Calcule le score de confiance d'un device
 * Basé sur: âge du device, nombre de connexions, anomalies détectées
 */
async function calculateTrustScore(deviceId) {
  try {
    const result = await pool.query(
      `SELECT
        EXTRACT(EPOCH FROM (NOW() - first_seen_at)) / 86400 as age_days,
        (SELECT COUNT(*) FROM molam_device_sessions WHERE device_id = $1) as session_count,
        (SELECT COUNT(*) FROM molam_device_sessions WHERE device_id = $1 AND anomaly_detected = TRUE) as anomaly_count
       FROM molam_devices
       WHERE id = $1`,
      [deviceId]
    );

    if (result.rows.length === 0) return 50;

    const { age_days, session_count, anomaly_count } = result.rows[0];

    // Score de base: 50
    let score = 50;

    // +20 points si device vu plus de 30 jours
    if (age_days > 30) score += 20;
    else if (age_days > 7) score += 10;

    // +20 points si plus de 10 sessions
    if (session_count > 10) score += 20;
    else if (session_count > 5) score += 10;

    // -10 points par anomalie (max -30)
    score -= Math.min(anomaly_count * 10, 30);

    // Limiter entre 0 et 100
    return Math.max(0, Math.min(100, score));

  } catch (error) {
    console.error('Calculate trust score error:', error);
    return 50;
  }
}

/**
 * Détecte les anomalies basées sur l'historique du user
 */
async function detectAnomalies(userId, deviceInfo) {
  const anomalies = [];
  let riskScore = 0;

  try {
    // Vérifier si nouvelle localisation
    const locationResult = await pool.query(
      `SELECT DISTINCT country, city
       FROM molam_device_sessions
       WHERE user_id = $1
       LIMIT 10`,
      [userId]
    );

    const knownLocations = locationResult.rows.map(r => `${r.country}-${r.city}`);
    const currentLocation = `${deviceInfo.country}-${deviceInfo.city}`;

    if (knownLocations.length > 0 && !knownLocations.includes(currentLocation)) {
      anomalies.push('new_location');
      riskScore += 30;
    }

    // Vérifier si horaire inhabituel (entre 2h et 6h du matin)
    const hour = new Date().getHours();
    if (hour >= 2 && hour < 6) {
      anomalies.push('unusual_time');
      riskScore += 10;
    }

    // Vérifier si device jamais vu
    const deviceResult = await pool.query(
      'SELECT id FROM molam_devices WHERE user_id = $1 AND device_fingerprint = $2',
      [userId, deviceInfo.device_fingerprint]
    );

    if (deviceResult.rows.length === 0) {
      anomalies.push('new_device');
      riskScore += 20;
    }

  } catch (error) {
    console.error('Detect anomalies error:', error);
  }

  return {
    detected: anomalies.length > 0,
    reasons: anomalies,
    riskScore: Math.min(riskScore, 100)
  };
}

/**
 * POST /api/id/devices/register
 * Enregistre un nouveau device ou met à jour un existant
 * Body: { device_info: {...} }
 */
export async function registerDevice(req, res) {
  const userId = req.user?.user_id;
  const { device_info } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!device_info) {
      return res.status(400).json({ error: 'Device info required' });
    }

    console.log('📱 Registering device for user:', userId);

    // Générer fingerprint
    const fingerprint = generateDeviceFingerprint({
      ...device_info,
      user_agent: req.headers['user-agent']
    });

    // Chercher device existant
    const existingDevice = await pool.query(
      'SELECT id, trust_score FROM molam_devices WHERE device_fingerprint = $1',
      [fingerprint]
    );

    let deviceId;
    let isNewDevice = false;

    if (existingDevice.rows.length > 0) {
      // Device existant, mettre à jour
      deviceId = existingDevice.rows[0].id;

      await pool.query(
        `UPDATE molam_devices
         SET last_seen_at = NOW(),
             ip_address = $1,
             country = $2,
             city = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [ip, device_info.country || 'SN', device_info.city || 'Dakar', deviceId]
      );

      console.log('✅ Device updated:', deviceId);

    } else {
      // Nouveau device
      isNewDevice = true;

      const result = await pool.query(
        `INSERT INTO molam_devices
         (device_fingerprint, user_id, device_type, os, os_version, browser, browser_version,
          screen_resolution, timezone, language, ip_address, country, city, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING id`,
        [
          fingerprint,
          userId,
          device_info.device_type || 'unknown',
          device_info.os || 'unknown',
          device_info.os_version || '',
          device_info.browser || 'unknown',
          device_info.browser_version || '',
          device_info.screen_resolution || '',
          device_info.timezone || '',
          device_info.language || '',
          ip,
          device_info.country || 'SN',
          device_info.city || 'Dakar',
          req.headers['user-agent'] || 'unknown',
          JSON.stringify(device_info.metadata || {})
        ]
      );

      deviceId = result.rows[0].id;

      // Log changement
      await pool.query(
        `INSERT INTO molam_device_changes
         (user_id, device_id, change_type, new_value)
         VALUES ($1, $2, $3, $4)`,
        [userId, deviceId, 'new_device', JSON.stringify({ fingerprint })]
      );

      console.log('✅ New device registered:', deviceId);
    }

    // Détecter anomalies
    const anomalies = await detectAnomalies(userId, {
      ...device_info,
      device_fingerprint: fingerprint
    });

    // Enregistrer la session du device
    if (req.session_id) {
      await pool.query(
        `INSERT INTO molam_device_sessions
         (device_id, session_id, user_id, ip_address, country, city, anomaly_detected, anomaly_reasons, risk_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          deviceId,
          req.session_id,
          userId,
          ip,
          device_info.country || 'SN',
          device_info.city || 'Dakar',
          anomalies.detected,
          anomalies.reasons,
          anomalies.riskScore
        ]
      );
    }

    // Calculer trust score
    const trustScore = await calculateTrustScore(deviceId);

    // Mettre à jour trust score
    await pool.query(
      'UPDATE molam_devices SET trust_score = $1 WHERE id = $2',
      [trustScore, deviceId]
    );

    return res.status(200).json({
      device_id: deviceId,
      fingerprint,
      is_new_device: isNewDevice,
      trust_score: trustScore,
      anomalies: anomalies.detected ? {
        detected: true,
        reasons: anomalies.reasons,
        risk_score: anomalies.riskScore
      } : null
    });

  } catch (error) {
    console.error('Register device error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/id/devices
 * Liste tous les devices de l'utilisateur connecté
 */
export async function listMyDevices(req, res) {
  const userId = req.user?.user_id;

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await pool.query(
      `SELECT
        id,
        device_fingerprint,
        device_type,
        os,
        os_version,
        browser,
        browser_version,
        country,
        city,
        trust_level,
        trust_score,
        first_seen_at,
        last_seen_at
       FROM molam_devices
       WHERE user_id = $1
       ORDER BY last_seen_at DESC`,
      [userId]
    );

    // Pour chaque device, compter les sessions et anomalies
    const devices = await Promise.all(
      result.rows.map(async (device) => {
        const statsResult = await pool.query(
          `SELECT
            COUNT(*) as session_count,
            COUNT(*) FILTER (WHERE anomaly_detected = TRUE) as anomaly_count
           FROM molam_device_sessions
           WHERE device_id = $1`,
          [device.id]
        );

        return {
          ...device,
          session_count: parseInt(statsResult.rows[0].session_count),
          anomaly_count: parseInt(statsResult.rows[0].anomaly_count),
          is_current: device.id === req.device_id // Si on track le device actuel
        };
      })
    );

    return res.status(200).json({
      total: devices.length,
      devices
    });

  } catch (error) {
    console.error('List devices error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/id/devices/:id
 * Supprime un device (désenregistrement)
 */
export async function removeDevice(req, res) {
  const userId = req.user?.user_id;
  const { id } = req.params;

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    console.log(`🗑️ Removing device ${id} for user:`, userId);

    // Supprimer (vérifier qu'il appartient au user)
    const result = await pool.query(
      'DELETE FROM molam_devices WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Log audit
    await pool.query(
      `INSERT INTO molam_audit_logs (actor_id, action, metadata)
       VALUES ($1, $2, $3)`,
      [userId, 'device_removed', { device_id: id }]
    );

    console.log('✅ Device removed:', id);

    return res.status(200).json({
      message: 'Device removed successfully'
    });

  } catch (error) {
    console.error('Remove device error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/id/devices/:id/sessions
 * Historique des sessions pour un device
 */
export async function getDeviceSessions(req, res) {
  const userId = req.user?.user_id;
  const { id } = req.params;

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Vérifier que le device appartient au user
    const deviceCheck = await pool.query(
      'SELECT id FROM molam_devices WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Récupérer les sessions
    const result = await pool.query(
      `SELECT
        id,
        session_id,
        ip_address,
        country,
        city,
        anomaly_detected,
        anomaly_reasons,
        risk_score,
        created_at
       FROM molam_device_sessions
       WHERE device_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [id]
    );

    return res.status(200).json({
      device_id: id,
      total: result.rows.length,
      sessions: result.rows
    });

  } catch (error) {
    console.error('Get device sessions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/id/devices/:id/trust
 * Met à jour le niveau de confiance d'un device (Admin ou User)
 * Body: { trust_level: 'trusted|suspicious|blocked' }
 */
export async function updateDeviceTrust(req, res) {
  const userId = req.user?.user_id;
  const { id } = req.params;
  const { trust_level } = req.body;

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!['trusted', 'suspicious', 'blocked', 'unknown'].includes(trust_level)) {
      return res.status(400).json({ error: 'Invalid trust level' });
    }

    console.log(`🔒 Updating trust for device ${id}:`, trust_level);

    // Mettre à jour (vérifier qu'il appartient au user)
    const result = await pool.query(
      `UPDATE molam_devices
       SET trust_level = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, trust_level`,
      [trust_level, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Log changement
    await pool.query(
      `INSERT INTO molam_device_changes
       (user_id, device_id, change_type, new_value, verified, verification_method)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, id, 'trust_changed', JSON.stringify({ trust_level }), true, 'manual']
    );

    console.log('✅ Device trust updated');

    return res.status(200).json({
      message: 'Device trust updated',
      device_id: id,
      trust_level
    });

  } catch (error) {
    console.error('Update device trust error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
