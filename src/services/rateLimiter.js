import { pool } from "../db.js";

/**
 * Vérifie et incrémente le rate limit
 * @param {string} key - Clé unique (IP, phone, email)
 * @param {string} type - Type de limite (signup, otp_send)
 * @param {number} maxAttempts - Nombre max d'essais
 * @param {number} windowMinutes - Fenêtre en minutes
 */
export async function checkRateLimit(key, type, maxAttempts, windowMinutes) {
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

  // Nettoyer les anciennes entrées expirées
  await pool.query(
    `DELETE FROM molam_rate_limits WHERE expires_at < NOW()`
  );

  // Compter les tentatives dans la fenêtre
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM molam_rate_limits 
     WHERE key = $1 AND type = $2 AND window_start > $3`,
    [key, type, windowStart]
  );

  const currentCount = parseInt(result.rows[0].count);

  if (currentCount >= maxAttempts) {
    const retryAfter = windowMinutes * 60; // en secondes
    throw new Error(
      `Rate limit exceeded. Retry after ${retryAfter} seconds.`
    );
  }

  // Insérer une nouvelle tentative
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + windowMinutes);

  await pool.query(
    `INSERT INTO molam_rate_limits (key, type, window_start, expires_at)
     VALUES ($1, $2, NOW(), $3)`,
    [key, type, expiresAt]
  );

  return {
    allowed: true,
    remaining: maxAttempts - currentCount - 1,
  };
}

/**
 * Bloque temporairement une clé
 */
export async function blockKey(key, type, durationMinutes) {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

  await pool.query(
    `INSERT INTO molam_rate_limits (key, type, count, window_start, expires_at)
     VALUES ($1, $2, 999999, NOW(), $3)`,
    [key, `blocked_${type}`, expiresAt]
  );
}