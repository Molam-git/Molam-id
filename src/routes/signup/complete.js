import { pool } from "../../db.js";
import { hashPasswordWithPepper } from "../../utils/security.js";
import { hashRefreshToken, generateRefreshToken } from "../../utils/crypto.js";
import { generateAccessToken, verifyAccessToken } from "../../utils/jwt.js";

/**
 * POST /api/id/signup/complete
 * Finalise l'inscription avec mot de passe
 */
export async function signupComplete(req, res) {
  const { temp_token, password, ussd_pin, email } = req.body;

  try {
    // Validation
    if (!temp_token) {
      return res.status(400).json({ error: "Token temporaire requis" });
    }

    if (!password && !ussd_pin) {
      return res.status(400).json({
        error: "Mot de passe ou PIN USSD requis"
      });
    }

    // Vérifier le token temporaire
    const decoded = verifyAccessToken(temp_token);
    if (!decoded || decoded.step !== "verified") {
      return res.status(401).json({ error: "Token invalide ou expiré" });
    }

    const userId = decoded.user_id;
    const molamId = decoded.molam_id;

    // Validation du mot de passe
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ 
          error: "Le mot de passe doit contenir au moins 8 caractères" 
        });
      }

      // Vérifier la complexité (au moins 1 lettre, 1 chiffre)
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({ 
          error: "Le mot de passe doit contenir des lettres et des chiffres" 
        });
      }
    }

    // Hacher le mot de passe et/ou PIN
    const passwordHash = password ? await hashPasswordWithPepper(password) : null;
    const ussdPinHash = ussd_pin ? await hashPasswordWithPepper(ussd_pin) : null;

    // Mettre à jour le compte (inclure l'email si fourni)
    if (email) {
      await pool.query(
        `UPDATE molam_users
         SET password_hash = COALESCE($1, password_hash),
             ussd_pin_hash = COALESCE($2, ussd_pin_hash),
             email = $3,
             status = 'active',
             updated_at = NOW()
         WHERE id = $4`,
        [passwordHash, ussdPinHash, email, userId]
      );
    } else {
      await pool.query(
        `UPDATE molam_users
         SET password_hash = COALESCE($1, password_hash),
             ussd_pin_hash = COALESCE($2, ussd_pin_hash),
             status = 'active',
             updated_at = NOW()
         WHERE id = $3`,
        [passwordHash, ussdPinHash, userId]
      );
    }

    // Générer les tokens finaux
    const accessToken = generateAccessToken({ 
      user_id: userId, 
      molam_id: molamId 
    });
    
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = await hashRefreshToken(refreshToken);

    // Créer la session
    await pool.query(
      `INSERT INTO molam_sessions (user_id, refresh_token_hash)
       VALUES ($1, $2)`,
      [userId, refreshTokenHash]
    );

    // Log d'audit
    await pool.query(
      `INSERT INTO molam_audit_logs (actor, action, target_id, meta)
       VALUES ($1, $2, $3, $4)`,
      [
        userId,
        "signup_complete",
        userId,
        JSON.stringify({ has_password: !!password, has_ussd_pin: !!ussd_pin })
      ]
    );

    res.status(201).json({
      message: "Inscription terminée avec succès",
      molam_id: molamId,
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: userId,
        molam_id: molamId,
        kyc_level: "P0"
      }
    });

  } catch (err) {
    console.error("Erreur signup complete:", err);
    res.status(500).json({ error: "Erreur lors de la finalisation" });
  }
}