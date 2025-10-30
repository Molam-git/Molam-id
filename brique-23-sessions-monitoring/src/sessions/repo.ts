import { Pool } from 'pg';
import { SessionRecord, SessionCreateDTO, TerminateBulkDTO } from '../types';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'molam_id',
  user: process.env.PGUSER || 'molam',
  password: process.env.PGPASSWORD || '',
});

export async function createSession(dto: SessionCreateDTO): Promise<SessionRecord> {
  const { rows } = await pool.query(
    `INSERT INTO molam_sessions_active (user_id, tenant_id, module_scope, device_id, device_type,
      os_version, app_version, ip_address, geo_country, geo_city, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [dto.user_id, dto.tenant_id, dto.module_scope, dto.device_id, dto.device_type,
     dto.os_version, dto.app_version, dto.ip_address, dto.geo_country, dto.geo_city, dto.user_agent]
  );
  return rows[0];
}

export async function listUserSessions(userId: string): Promise<SessionRecord[]> {
  const { rows } = await pool.query(
    `SELECT * FROM molam_sessions_active WHERE user_id = $1 AND is_active = TRUE ORDER BY last_seen DESC`,
    [userId]
  );
  return rows;
}

export async function updateSessionActivity(sessionId: string): Promise<void> {
  await pool.query(
    `UPDATE molam_sessions_active SET last_seen = NOW() WHERE id = $1`,
    [sessionId]
  );
}

export async function terminateSession(sessionId: string, userId?: string, reason = 'manual'): Promise<SessionRecord | null> {
  const query = userId
    ? `UPDATE molam_sessions_active SET is_active = FALSE, terminated_reason = $1 WHERE id = $2 AND user_id = $3 RETURNING *`
    : `UPDATE molam_sessions_active SET is_active = FALSE, terminated_reason = $1 WHERE id = $2 RETURNING *`;
  const params = userId ? [reason, sessionId, userId] : [reason, sessionId];
  const { rows } = await pool.query(query, params);
  return rows[0] || null;
}

export async function terminateBulk(dto: TerminateBulkDTO, actorId: string): Promise<number> {
  let query = `UPDATE molam_sessions_active SET is_active = FALSE, terminated_reason = 'bulk_admin' WHERE is_active = TRUE`;
  const params: any[] = [];

  if (dto.user_id) {
    params.push(dto.user_id);
    query += ` AND user_id = $${params.length}`;
  }
  if (dto.tenant_id) {
    params.push(dto.tenant_id);
    query += ` AND tenant_id = $${params.length}`;
  }
  if (dto.module_scope) {
    params.push(dto.module_scope);
    query += ` AND module_scope = $${params.length}`;
  }

  const { rowCount } = await pool.query(query, params);
  await pool.query(
    `INSERT INTO molam_admin_audit (actor_id, action, target) VALUES ($1, 'sessions.bulk.terminate', $2)`,
    [actorId, { count: rowCount, filters: dto }]
  );
  return rowCount || 0;
}

export async function detectAnomalies(userId: string, ip: string, country: string | null): Promise<any[]> {
  const { rows } = await pool.query(
    `SELECT * FROM detect_session_anomalies($1, $2, $3)`,
    [userId, ip, country]
  );
  return rows;
}

export async function logAnomaly(sessionId: string, userId: string, anomalyType: string, details: any, severity: string): Promise<void> {
  await pool.query(
    `INSERT INTO molam_session_anomalies (session_id, user_id, anomaly_type, details, severity) VALUES ($1, $2, $3, $4, $5)`,
    [sessionId, userId, anomalyType, details, severity]
  );
}
