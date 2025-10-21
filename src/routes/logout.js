import { pool } from "../db.js";
import { verifyRefreshToken } from "../utils/crypto.js";

export async function logout(req, res) {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token requis" });
  }

  try {
    const sessions = await pool.query(
      `SELECT id, user_id, refresh_token_hash FROM molam_sessions WHERE revoked_at IS NULL`
    );

    for (const session of sessions.rows) {
      if (await verifyRefreshToken(token, session.refresh_token_hash)) {
        await pool.query(
          `UPDATE molam_sessions SET revoked_at = NOW() WHERE id = $1`,
          [session.id]
        );

        // Log d'audit
        await pool.query(
          `INSERT INTO molam_audit_logs (actor, action, target_id, meta)
           VALUES ($1, 'logout', $1, $2)`,
          [session.user_id, JSON.stringify({ source: "api" })]
        );

        return res.json({ message: "Déconnexion réussie" });
      }
    }

    res.status(404).json({ error: "Session non trouvée" });
  } catch (err) {
    console.error("Erreur logout:", err);
    res.status(500).json({ error: "Erreur lors de la déconnexion" });
  }
}