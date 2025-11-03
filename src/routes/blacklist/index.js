/**
 * Brique 13: Blacklist Routes
 * Protection anti-fraude et gestion des blocages
 */

import { pool } from '../../db.js';

// Configuration
const MAX_FAILED_ATTEMPTS = 5; // Max tentatives avant auto-blacklist
const FAILED_ATTEMPTS_WINDOW_MINUTES = 15; // Fenêtre de temps
const AUTO_BLACKLIST_DURATION_HOURS = 24; // Durée du blacklist auto

/**
 * Middleware: checkBlacklist
 * Vérifie si l'utilisateur/IP est blacklisté
 */
export async function checkBlacklist(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const { email, phone } = req.body;

  try {
    const checks = [
      { type: 'ip', value: ip }
    ];

    if (email) checks.push({ type: 'email', value: email.toLowerCase() });
    if (phone) checks.push({ type: 'phone', value: phone });

    for (const check of checks) {
      const result = await pool.query(
        `SELECT id, reason, severity, expires_at
         FROM molam_blacklist
         WHERE type = $1 AND value = $2
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [check.type, check.value]
      );

      if (result.rows.length > 0) {
        const blacklist = result.rows[0];

        // Log le blocage
        await pool.query(
          `INSERT INTO molam_blacklist_logs
           (blacklist_id, action, blocked_type, blocked_value, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [blacklist.id, 'blocked', check.type, check.value, ip, req.headers['user-agent']]
        );

        console.log(`🚫 Blacklist blocked: ${check.type}=${check.value}, reason: ${blacklist.reason}`);

        return res.status(403).json({
          error: 'Access denied',
          code: 'BLACKLISTED',
          message: blacklist.reason || 'Votre accès a été bloqué',
          severity: blacklist.severity
        });
      }
    }

    // Pas blacklisté, continuer
    next();

  } catch (error) {
    console.error('Blacklist check error:', error);
    // En cas d'erreur, laisser passer (fail-open pour ne pas bloquer le service)
    next();
  }
}

/**
 * POST /api/id/blacklist/add
 * Ajoute une entrée à la blacklist (Admin only)
 * Body: { type: 'ip|email|phone|device|user', value: 'xxx', reason: 'xxx', duration: hours }
 */
export async function addToBlacklist(req, res) {
  const adminId = req.user?.user_id;
  const { type, value, reason, severity = 'medium', duration } = req.body;

  try {
    if (!['ip', 'email', 'phone', 'device', 'user'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    if (!value) {
      return res.status(400).json({ error: 'Value required' });
    }

    console.log(`🚫 Adding to blacklist: ${type}=${value}, by admin:`, adminId);

    // Calculer expiration si durée fournie
    let expiresAt = null;
    if (duration) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + duration);
    }

    // Ajouter à la blacklist
    const result = await pool.query(
      `INSERT INTO molam_blacklist
       (type, value, reason, severity, expires_at, created_by, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (type, value)
       DO UPDATE SET reason = $3, severity = $4, expires_at = $5, updated_at = NOW()
       RETURNING id, created_at`,
      [type, value, reason, severity, expiresAt, adminId, JSON.stringify({ added_by: 'admin' })]
    );

    const blacklist = result.rows[0];

    // Log
    await pool.query(
      `INSERT INTO molam_blacklist_logs
       (blacklist_id, action, blocked_type, blocked_value, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [blacklist.id, 'added', type, value, JSON.stringify({ admin_id: adminId, reason })]
    );

    console.log('✅ Blacklist entry added:', blacklist.id);

    return res.status(201).json({
      message: 'Ajouté à la blacklist',
      id: blacklist.id,
      type,
      value,
      expiresAt
    });

  } catch (error) {
    console.error('Add blacklist error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/id/blacklist/:id
 * Retire une entrée de la blacklist (Admin only)
 */
export async function removeFromBlacklist(req, res) {
  const adminId = req.user?.user_id;
  const { id } = req.params;

  try {
    console.log(`🚫 Removing from blacklist: ${id}, by admin:`, adminId);

    // Supprimer
    const result = await pool.query(
      'DELETE FROM molam_blacklist WHERE id = $1 RETURNING type, value',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Blacklist entry not found' });
    }

    const removed = result.rows[0];

    console.log('✅ Blacklist entry removed:', id);

    return res.status(200).json({
      message: 'Retiré de la blacklist',
      type: removed.type,
      value: removed.value
    });

  } catch (error) {
    console.error('Remove blacklist error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/id/blacklist
 * Liste toutes les entrées blacklist (Admin only)
 */
export async function listBlacklist(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, type, value, reason, severity, expires_at, created_at
       FROM molam_blacklist
       WHERE expires_at IS NULL OR expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 100`
    );

    return res.status(200).json({
      total: result.rows.length,
      blacklist: result.rows
    });

  } catch (error) {
    console.error('List blacklist error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Enregistre une tentative de login échouée
 * Appelé par le login handler
 */
export async function recordFailedLogin(identifier, identifierType, ip, userAgent, reason) {
  try {
    // Enregistrer la tentative
    await pool.query(
      `INSERT INTO molam_failed_login_attempts
       (identifier, identifier_type, ip_address, user_agent, failure_reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [identifier, identifierType, ip, userAgent, reason]
    );

    // Compter les tentatives récentes
    const countResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM molam_failed_login_attempts
       WHERE identifier = $1
       AND created_at > NOW() - INTERVAL '${FAILED_ATTEMPTS_WINDOW_MINUTES} minutes'`,
      [identifier]
    );

    const failedCount = parseInt(countResult.rows[0].count);

    console.log(`⚠️ Failed login attempts for ${identifier}: ${failedCount}/${MAX_FAILED_ATTEMPTS}`);

    // Auto-blacklist si trop de tentatives
    if (failedCount >= MAX_FAILED_ATTEMPTS) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + AUTO_BLACKLIST_DURATION_HOURS);

      await pool.query(
        `INSERT INTO molam_blacklist
         (type, value, reason, severity, expires_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (type, value) DO NOTHING`,
        [
          identifierType,
          identifier,
          `Auto-bloqué après ${MAX_FAILED_ATTEMPTS} tentatives échouées`,
          'high',
          expiresAt,
          JSON.stringify({ auto_blacklist: true, failed_attempts: failedCount })
        ]
      );

      console.log(`🚫 AUTO-BLACKLISTED: ${identifierType}=${identifier} for ${AUTO_BLACKLIST_DURATION_HOURS}h`);
    }

  } catch (error) {
    console.error('Record failed login error:', error);
  }
}
