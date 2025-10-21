import { pool } from "../db.js";
import { verifyRefreshToken, generateRefreshToken, hashRefreshToken } from "../utils/crypto.js";
import { generateAccessToken } from "../utils/jwt.js";

export async function refresh(req, res) {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token requis" });
  }

  try {
    const sessions = await pool.query(
      `SELECT id, user_id, refresh_token_hash FROM molam_sessions WHERE revoked_at IS NULL`
    );

    let matchedSession = null;
    for (const session of sessions.rows) {
      if (await verifyRefreshToken(token, session.refresh_token_hash)) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      return res.status(401).json({ error: "Token invalide ou expiré" });
    }

    const userResult = await pool.query(
      `SELECT molam_id FROM molam_users WHERE id = $1`,
      [matchedSession.user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "Utilisateur introuvable" });
    }

    // Génération de nouveaux tokens
    const accessToken = generateAccessToken({
      user_id: matchedSession.user_id,
      molam_id: userResult.rows[0].molam_id,
    });

    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = await hashRefreshToken(newRefreshToken);

    // Mise à jour de la session
    await pool.query(
      `UPDATE molam_sessions SET refresh_token_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newRefreshTokenHash, matchedSession.id]
    );

    res.json({
      access_token: accessToken,
      refresh_token: newRefreshToken,
    });
  } catch (err) {
    console.error("Erreur refresh:", err);
    res.status(500).json({ error: "Erreur lors du refresh" });
  }
}