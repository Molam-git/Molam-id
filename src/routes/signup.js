import { pool } from "../db.js";
import { hashPassword, generateMolamId, generateRefreshToken, hashRefreshToken } from "../utils/crypto.js";
import { generateAccessToken } from "../utils/jwt.js";

export async function signup(req, res) {
  const { email, phone, password } = req.body;

  if (!email || !phone || !password) {
    return res.status(400).json({ error: "Email, téléphone et mot de passe requis" });
  }

  try {
    // Hash du mot de passe
    const passwordHash = await hashPassword(password);
    const molamId = generateMolamId();

    // Insertion de l'utilisateur
    const userResult = await pool.query(
      `INSERT INTO molam_users (molam_id, phone_e164, email, password_hash, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING id, molam_id`,
      [molamId, phone, email, passwordHash]
    );

    const userId = userResult.rows[0].id;
    const finalMolamId = userResult.rows[0].molam_id;

    // Création du rôle
    await pool.query(
      `INSERT INTO molam_roles (user_id, module, role) VALUES ($1, 'id', 'client')`,
      [userId]
    );

    // Génération des tokens
    const accessToken = generateAccessToken({ user_id: userId, molam_id: finalMolamId });
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = await hashRefreshToken(refreshToken);

    // Enregistrement de la session
    await pool.query(
      `INSERT INTO molam_sessions (user_id, refresh_token_hash) VALUES ($1, $2)`,
      [userId, refreshTokenHash]
    );

    // Log d'audit
    await pool.query(
      `INSERT INTO molam_audit_logs (actor, action, target_id, meta)
       VALUES ($1, 'signup', $1, $2)`,
      [userId, JSON.stringify({ source: "api" })]
    );

    res.status(201).json({
      molam_id: finalMolamId,
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (err) {
    console.error("Erreur signup:", err);
    
    if (err.code === "23505") { // Contrainte unique violée
      return res.status(409).json({ error: "Email ou téléphone déjà utilisé" });
    }
    
    res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
}