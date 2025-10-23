import { pool } from "../db.js";
import { generateRefreshToken, hashRefreshToken } from "../utils/crypto.js";
import { verifyPasswordWithPepper } from "../utils/security.js"; 
import { generateAccessToken } from "../utils/jwt.js";

export async function login(req, res) {
  const { email, phone, molam_id, password } = req.body;

  if ((!email && !phone && !molam_id) || !password) {
    return res.status(400).json({ error: "Identifiant (email, téléphone ou MOLAM ID) et mot de passe requis" });
  }

  try {
    // Chercher l'utilisateur par email, phone ou molam_id
    const result = await pool.query(
      `SELECT id, molam_id, password_hash FROM molam_users
       WHERE (email = $1 OR phone_e164 = $2 OR molam_id = $3) AND status = 'active'`,
      [email || null, phone || null, molam_id || null]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const user = result.rows[0];
    const isValid = await verifyPasswordWithPepper(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    // Génération des tokens
    const accessToken = generateAccessToken({ user_id: user.id, molam_id: user.molam_id });
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = await hashRefreshToken(refreshToken);

    // Enregistrement de la session
    await pool.query(
      `INSERT INTO molam_sessions (user_id, refresh_token_hash) VALUES ($1, $2)`,
      [user.id, refreshTokenHash]
    );

    // Log d'audit
    await pool.query(
      `INSERT INTO molam_audit_logs (actor, action, target_id, meta)
       VALUES ($1, 'login', $1, $2)`,
      [user.id, JSON.stringify({ source: "api" })]
    );

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (err) {
    console.error("Erreur login:", err);
    res.status(500).json({ error: "Erreur lors de la connexion" });
  }
}