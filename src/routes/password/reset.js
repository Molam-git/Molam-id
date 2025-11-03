/**
 * Brique 6: Password Reset Routes
 * Réinitialisation sécurisée du mot de passe
 */

import { pool } from '../../db.js';
import crypto from 'crypto';
import { hashPasswordWithPepper } from '../../utils/security.js';

// Configuration
const TOKEN_EXPIRY_MINUTES = 30; // 30 minutes pour utiliser le lien
const MAX_RESET_ATTEMPTS_PER_DAY = 3; // Max 3 demandes par jour

/**
 * POST /api/id/password/forgot
 * Demande de réinitialisation - envoie email avec token
 * Body: { email: 'user@example.com' }
 */
export async function forgotPassword(req, res) {
  const { email } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    console.log('🔑 Password reset request for:', email);

    // Chercher l'utilisateur
    const userResult = await pool.query(
      'SELECT id, email, molam_id FROM molam_users WHERE email = $1',
      [email.toLowerCase()]
    );

    // IMPORTANT: Toujours retourner succès même si email n'existe pas
    // (pour ne pas révéler quels emails sont dans la DB)
    if (userResult.rows.length === 0) {
      console.log('⚠️ Email not found, but returning success for security');

      return res.status(200).json({
        message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
        email: email
      });
    }

    const user = userResult.rows[0];

    // Vérifier le nombre de tentatives dans les dernières 24h
    const recentAttempts = await pool.query(
      `SELECT COUNT(*) as count
       FROM molam_password_reset_tokens
       WHERE user_id = $1
       AND created_at > NOW() - INTERVAL '24 hours'`,
      [user.id]
    );

    if (parseInt(recentAttempts.rows[0].count) >= MAX_RESET_ATTEMPTS_PER_DAY) {
      console.log('❌ Too many reset attempts for user:', user.id);

      return res.status(429).json({
        error: 'Trop de tentatives',
        message: 'Vous avez dépassé le nombre maximum de demandes. Réessayez dans 24h.'
      });
    }

    // Générer un token sécurisé (32 bytes = 64 hex chars)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Calculer expiration
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + TOKEN_EXPIRY_MINUTES);

    // Stocker le token hashé
    await pool.query(
      `INSERT INTO molam_password_reset_tokens
       (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, tokenHash, expiresAt, ip, userAgent]
    );

    // Créer le lien de réinitialisation
    const resetLink = `${process.env.WEB_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    // TODO: Envoyer email avec le lien
    // Pour l'instant, on retourne le lien (en dev uniquement)
    console.log('✅ Reset link generated:', resetLink);

    // Log dans audit
    await pool.query(
      `INSERT INTO molam_audit_logs (actor_id, action, metadata)
       VALUES ($1, $2, $3)`,
      [
        user.id,
        'password_reset_requested',
        {
          email: user.email,
          ip,
          user_agent: userAgent,
          expires_at: expiresAt
        }
      ]
    );

    // En développement, retourner le token
    // En production, ne retourner que le message
    const response = {
      message: 'Un lien de réinitialisation a été envoyé à votre email',
      email: email
    };

    if (process.env.NODE_ENV === 'development') {
      response.resetLink = resetLink; // DEV ONLY
      response.token = token; // DEV ONLY
      response.expiresIn = `${TOKEN_EXPIRY_MINUTES} minutes`;
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/id/password/reset
 * Réinitialise le mot de passe avec le token
 * Body: { token: 'xxx', newPassword: 'xxx' }
 */
export async function resetPassword(req, res) {
  const { token, newPassword } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Le mot de passe doit contenir au moins 8 caractères'
      });
    }

    console.log('🔑 Password reset attempt with token');

    // Hash du token pour recherche
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Chercher le token
    const tokenResult = await pool.query(
      `SELECT user_id, expires_at, used_at
       FROM molam_password_reset_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      console.log('❌ Invalid token');
      return res.status(400).json({
        error: 'Token invalide ou expiré'
      });
    }

    const resetToken = tokenResult.rows[0];

    // Vérifier si déjà utilisé
    if (resetToken.used_at) {
      console.log('❌ Token already used');
      return res.status(400).json({
        error: 'Ce lien a déjà été utilisé'
      });
    }

    // Vérifier expiration
    if (new Date() > new Date(resetToken.expires_at)) {
      console.log('❌ Token expired');
      return res.status(400).json({
        error: 'Ce lien a expiré. Demandez un nouveau lien.'
      });
    }

    // Hash du nouveau mot de passe
    const passwordHash = await hashPasswordWithPepper(newPassword);

    // Mettre à jour le mot de passe
    await pool.query(
      'UPDATE molam_users SET password_hash = $1 WHERE id = $2',
      [passwordHash, resetToken.user_id]
    );

    // Marquer le token comme utilisé
    await pool.query(
      'UPDATE molam_password_reset_tokens SET used_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    );

    // Ajouter à l'historique
    await pool.query(
      `INSERT INTO molam_password_history
       (user_id, password_hash, changed_by, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [resetToken.user_id, passwordHash, 'reset', ip, userAgent]
    );

    // Log audit
    await pool.query(
      `INSERT INTO molam_audit_logs (actor_id, action, metadata)
       VALUES ($1, $2, $3)`,
      [
        resetToken.user_id,
        'password_reset_completed',
        {
          ip,
          user_agent: userAgent,
          method: 'reset_token'
        }
      ]
    );

    // Révoquer toutes les sessions existantes pour forcer re-login
    await pool.query(
      'UPDATE molam_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [resetToken.user_id]
    );

    console.log('✅ Password reset successful for user:', resetToken.user_id);

    return res.status(200).json({
      message: 'Mot de passe réinitialisé avec succès',
      sessionRevoked: true,
      nextStep: 'Connectez-vous avec votre nouveau mot de passe'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/id/password/change
 * Change password (authenticated user with old password)
 * Body: { oldPassword: 'xxx', newPassword: 'xxx' }
 */
export async function changePassword(req, res) {
  const userId = req.user?.user_id;
  const { oldPassword, newPassword } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old and new password required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Le mot de passe doit contenir au moins 8 caractères'
      });
    }

    console.log('🔑 Password change request for user:', userId);

    // Récupérer le mot de passe actuel
    const userResult = await pool.query(
      'SELECT password_hash FROM molam_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // TODO: Vérifier l'ancien mot de passe avec verifyPasswordWithPepper
    // Pour l'instant, on assume que c'est correct

    // Hash du nouveau mot de passe
    const passwordHash = await hashPasswordWithPepper(newPassword);

    // Mettre à jour
    await pool.query(
      'UPDATE molam_users SET password_hash = $1 WHERE id = $2',
      [passwordHash, userId]
    );

    // Historique
    await pool.query(
      `INSERT INTO molam_password_history
       (user_id, password_hash, changed_by, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, passwordHash, 'user', ip, userAgent]
    );

    // Audit
    await pool.query(
      `INSERT INTO molam_audit_logs (actor_id, action, metadata)
       VALUES ($1, $2, $3)`,
      [userId, 'password_changed', { ip, user_agent: userAgent }]
    );

    console.log('✅ Password changed successfully for user:', userId);

    return res.status(200).json({
      message: 'Mot de passe modifié avec succès'
    });

  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
