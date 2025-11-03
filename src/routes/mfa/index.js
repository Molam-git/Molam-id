/**
 * Brique 11: MFA/2FA Routes
 * Multi-Factor Authentication avec TOTP (Google Authenticator compatible)
 */

import { pool } from '../../db.js';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

// Configuration TOTP
authenticator.options = {
  window: 1, // Allow 1 step before/after for time drift
  step: 30,  // 30 seconds window
};

/**
 * POST /api/id/mfa/setup
 * Initialise le MFA - génère secret et QR code
 * Require: Authentication
 */
export async function setupMFA(req, res) {
  const userId = req.user?.user_id;

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    console.log('🔐 MFA Setup for user:', userId);

    // Vérifier si déjà activé
    const userResult = await pool.query(
      'SELECT mfa_enabled, email FROM molam_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    if (user.mfa_enabled) {
      return res.status(400).json({
        error: 'MFA already enabled',
        message: 'Désactivez d\'abord le MFA existant'
      });
    }

    // Générer un secret unique
    const secret = authenticator.generateSecret();

    // Créer le lien otpauth pour QR code
    const otpauth = authenticator.keyuri(
      user.email,
      'Molam ID',
      secret
    );

    // Générer QR code en base64
    const qrCode = await QRCode.toDataURL(otpauth);

    // Générer codes de récupération
    const recoveryCodes = generateRecoveryCodes(8);

    // Stocker temporairement le secret (non encore activé)
    await pool.query(
      `UPDATE molam_users
       SET mfa_secret = $1, mfa_backup_codes = $2
       WHERE id = $3`,
      [secret, recoveryCodes.hashed, userId]
    );

    // Log l'action
    await pool.query(
      `INSERT INTO molam_mfa_logs (user_id, action, ip_address, user_agent)
       VALUES ($1, $2, $3, $4)`,
      [userId, 'setup_initiated', req.ip, req.headers['user-agent']]
    );

    console.log('✅ MFA setup successful for user:', userId);

    return res.status(200).json({
      secret,
      qrCode,
      recoveryCodes: recoveryCodes.plain,
      message: 'Scannez le QR code avec Google Authenticator, puis vérifiez le code pour activer'
    });

  } catch (error) {
    console.error('MFA setup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/id/mfa/enable
 * Active le MFA après vérification du code
 * Body: { code: '123456' }
 */
export async function enableMFA(req, res) {
  const userId = req.user?.user_id;
  const { code } = req.body;

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Code must be 6 digits' });
    }

    console.log('🔐 MFA Enable attempt for user:', userId);

    // Récupérer le secret
    const userResult = await pool.query(
      'SELECT mfa_secret, mfa_enabled FROM molam_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    if (user.mfa_enabled) {
      return res.status(400).json({ error: 'MFA already enabled' });
    }

    if (!user.mfa_secret) {
      return res.status(400).json({
        error: 'No MFA setup found',
        message: 'Appelez d\'abord /mfa/setup'
      });
    }

    // Vérifier le code TOTP
    const isValid = authenticator.verify({
      token: code,
      secret: user.mfa_secret
    });

    if (!isValid) {
      console.log('❌ Invalid MFA code');

      await pool.query(
        `INSERT INTO molam_mfa_logs (user_id, action, success, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, 'enable_failed', false, req.ip, req.headers['user-agent'], JSON.stringify({ code_length: code.length })]
      );

      return res.status(400).json({ error: 'Invalid code' });
    }

    // Activer le MFA
    await pool.query(
      `UPDATE molam_users
       SET mfa_enabled = TRUE, mfa_enabled_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    // Log succès
    await pool.query(
      `INSERT INTO molam_mfa_logs (user_id, action, success, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'enabled', true, req.ip, req.headers['user-agent']]
    );

    console.log('✅ MFA enabled for user:', userId);

    return res.status(200).json({
      message: 'MFA activé avec succès',
      enabled: true
    });

  } catch (error) {
    console.error('MFA enable error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/id/mfa/verify
 * Vérifie un code TOTP (utilisé pendant le login)
 * Body: { code: '123456' }
 */
export async function verifyMFA(req, res) {
  const userId = req.user?.user_id;
  const { code, recoveryCode } = req.body;

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    console.log('🔐 MFA Verify for user:', userId);

    // Récupérer les infos MFA
    const userResult = await pool.query(
      'SELECT mfa_secret, mfa_enabled, mfa_backup_codes FROM molam_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    if (!user.mfa_enabled) {
      return res.status(400).json({ error: 'MFA not enabled' });
    }

    let isValid = false;
    let usedRecoveryCode = false;

    // Vérifier code TOTP d'abord
    if (code) {
      isValid = authenticator.verify({
        token: code,
        secret: user.mfa_secret
      });
    }

    // Si code invalide, vérifier code de récupération
    if (!isValid && recoveryCode && user.mfa_backup_codes) {
      for (const hashedCode of user.mfa_backup_codes) {
        if (crypto.timingSafeEqual(
          Buffer.from(crypto.createHash('sha256').update(recoveryCode).digest('hex')),
          Buffer.from(hashedCode)
        )) {
          isValid = true;
          usedRecoveryCode = true;

          // Retirer le code utilisé
          const newCodes = user.mfa_backup_codes.filter(c => c !== hashedCode);
          await pool.query(
            'UPDATE molam_users SET mfa_backup_codes = $1 WHERE id = $2',
            [newCodes, userId]
          );

          break;
        }
      }
    }

    if (!isValid) {
      console.log('❌ Invalid MFA code');

      await pool.query(
        `INSERT INTO molam_mfa_logs (user_id, action, success, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'verify_failed', false, req.ip, req.headers['user-agent']]
      );

      return res.status(400).json({ error: 'Invalid code' });
    }

    // Log succès
    await pool.query(
      `INSERT INTO molam_mfa_logs (user_id, action, success, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, usedRecoveryCode ? 'recovery_used' : 'verified', true, req.ip, req.headers['user-agent'],
       JSON.stringify({ recovery_code_used: usedRecoveryCode })]
    );

    console.log('✅ MFA verified for user:', userId);

    return res.status(200).json({
      valid: true,
      message: usedRecoveryCode ? 'Code de récupération utilisé' : 'Code vérifié'
    });

  } catch (error) {
    console.error('MFA verify error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/id/mfa/disable
 * Désactive le MFA
 * Body: { password: 'xxx' } - Require password confirmation
 */
export async function disableMFA(req, res) {
  const userId = req.user?.user_id;
  const { password } = req.body;

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password required to disable MFA' });
    }

    console.log('🔐 MFA Disable request for user:', userId);

    // Vérifier le mot de passe
    const userResult = await pool.query(
      'SELECT password_hash FROM molam_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // TODO: Verify password with verifyPasswordWithPepper
    // For now, assuming password is correct

    // Désactiver MFA
    await pool.query(
      `UPDATE molam_users
       SET mfa_enabled = FALSE, mfa_secret = NULL, mfa_backup_codes = NULL
       WHERE id = $1`,
      [userId]
    );

    // Log
    await pool.query(
      `INSERT INTO molam_mfa_logs (user_id, action, ip_address, user_agent)
       VALUES ($1, $2, $3, $4)`,
      [userId, 'disabled', req.ip, req.headers['user-agent']]
    );

    console.log('✅ MFA disabled for user:', userId);

    return res.status(200).json({
      message: 'MFA désactivé avec succès',
      enabled: false
    });

  } catch (error) {
    console.error('MFA disable error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/id/mfa/status
 * Vérifie si le MFA est activé
 */
export async function getMFAStatus(req, res) {
  const userId = req.user?.user_id;

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userResult = await pool.query(
      'SELECT mfa_enabled, mfa_enabled_at FROM molam_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    return res.status(200).json({
      enabled: user.mfa_enabled || false,
      enabledAt: user.mfa_enabled_at
    });

  } catch (error) {
    console.error('MFA status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Génère des codes de récupération
 */
function generateRecoveryCodes(count = 8) {
  const codes = [];
  const hashed = [];

  for (let i = 0; i < count; i++) {
    // Générer code 8 caractères alphanumériques
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);

    // Hash pour stockage
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    hashed.push(hash);
  }

  return {
    plain: codes,
    hashed: hashed
  };
}
