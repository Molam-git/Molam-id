import { pool } from "../../db.js";
import { verifyOTP } from "../../utils/security.js";
import { generateMolamId } from "../../utils/crypto.js";
import { generateAccessToken } from "../../utils/jwt.js";
import { checkRateLimit, blockKey } from "../../services/rateLimiter.js";

/**
 * POST /api/id/signup/verify
 * Vérifie le code OTP
 */
export async function signupVerify(req, res) {
  const { verification_id, code, phone, email } = req.body;

  try {
    // Validation
    if (!verification_id || !code) {
      return res.status(400).json({ 
        error: "ID de vérification et code requis" 
      });
    }

    if (!phone && !email) {
      return res.status(400).json({ 
        error: "Téléphone ou email requis" 
      });
    }

    // Rate limiting sur les tentatives de vérification
    const rateLimitKey = `verify_${verification_id}`;
    try {
      await checkRateLimit(rateLimitKey, "otp_verify", 5, 15); // 5 tentatives/15min
    } catch (err) {
      return res.status(429).json({ error: err.message });
    }

    // Récupérer le code de vérification
    const result = await pool.query(
      `SELECT id, code_hash, expires_at, attempts, max_attempts, channel, phone, email
       FROM molam_verification_codes
       WHERE id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [verification_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: "Code de vérification introuvable" 
      });
    }

    const verification = result.rows[0];

    // Vérifier l'expiration
    if (new Date() > new Date(verification.expires_at)) {
      return res.status(400).json({ 
        error: "Code expiré. Demandez un nouveau code." 
      });
    }

    // Vérifier le nombre de tentatives
    if (verification.attempts >= verification.max_attempts) {
      await blockKey(rateLimitKey, "otp_verify", 60); // Bloquer 1h
      return res.status(429).json({ 
        error: "Trop de tentatives. Veuillez réessayer dans 1 heure." 
      });
    }

    // Incrémenter les tentatives
    await pool.query(
      `UPDATE molam_verification_codes 
       SET attempts = attempts + 1 
       WHERE id = $1`,
      [verification_id]
    );

    // Vérifier le code
    const isValid = await verifyOTP(code, verification.code_hash);

    if (!isValid) {
      const remainingAttempts = verification.max_attempts - verification.attempts - 1;
      return res.status(400).json({ 
        error: "Code incorrect",
        remaining_attempts: remainingAttempts
      });
    }

    // Code valide - créer ou activer le compte
    const molamId = generateMolamId();

    // Utiliser le phone/email du code de vérification OU du body (prioriser verification)
    const verifiedPhone = verification.phone || phone;
    const verifiedEmail = verification.email || email; // Accepter email du body même si pas dans verification
    
    // Vérifier si un compte pending existe
    let userId;
    const existingUser = await pool.query(
      `SELECT id FROM molam_users 
       WHERE phone_e164 = $1 OR email = $2`,
      [verifiedPhone, verifiedEmail]
    );

    if (existingUser.rows.length > 0) {
      // Activer le compte existant
      userId = existingUser.rows[0].id;
      await pool.query(
        `UPDATE molam_users 
         SET status = 'pending_password', molam_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [molamId, userId]
      );
    } else {
      // Créer un nouveau compte
      // Si email fourni dans le body mais pas dans verification, l'utiliser
      let finalEmail = verifiedEmail && verifiedEmail.includes('@')
        ? verifiedEmail
        : null;

      // Si pas d'email, chercher si un code de vérification avec email existe pour ce phone
      if (!finalEmail && verifiedPhone) {
        const emailCheck = await pool.query(
          `SELECT email FROM molam_verification_codes
           WHERE phone = $1 AND email IS NOT NULL AND email != ''
           ORDER BY created_at DESC LIMIT 1`,
          [verifiedPhone]
        );
        if (emailCheck.rows.length > 0) {
          finalEmail = emailCheck.rows[0].email;
        }
      }

      // Si toujours pas d'email, utiliser un email temporaire
      if (!finalEmail) {
        finalEmail = `temp_${molamId}@pending.molam.sn`;
      }

      const userResult = await pool.query(
        `INSERT INTO molam_users
         (molam_id, phone_e164, email, password_hash, status, user_type, kyc_level, created_via)
         VALUES ($1, $2, $3, $4, 'pending_password', 'customer', 'P0', 'app')
         RETURNING id, molam_id`,
        [
          molamId,
          verifiedPhone,
          finalEmail,
          'pending' // password_hash temporaire
        ]
      );

      userId = userResult.rows[0].id;

      // Créer le rôle par défaut
      await pool.query(
        `INSERT INTO molam_roles (user_id, module, role)
         VALUES ($1, 'id', 'client')`,
        [userId]
      );
    }

    // Générer un token temporaire pour la prochaine étape
    const tempToken = generateAccessToken({ 
      user_id: userId, 
      molam_id: molamId,
      step: "verified" 
    });

    // Marquer le code comme utilisé (soft delete)
    await pool.query(
      `DELETE FROM molam_verification_codes WHERE id = $1`,
      [verification_id]
    );

    // Log d'audit
    await pool.query(
      `INSERT INTO molam_audit_logs (actor, action, target_id, meta)
       VALUES ($1, $2, $3, $4)`,
      [
        userId,
        "signup_verify_success",
        userId,
        JSON.stringify({ verification_id, channel: verification.channel })
      ]
    );

    res.status(200).json({
      message: "Vérification réussie",
      temp_token: tempToken,
      molam_id: molamId,
      next_step: "complete_profile"
    });

  } catch (err) {
    console.error("Erreur signup verify:", err);
    res.status(500).json({ error: "Erreur lors de la vérification" });
  }
}