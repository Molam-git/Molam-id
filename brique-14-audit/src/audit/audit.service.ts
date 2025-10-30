// Brique 14: Audit logs - Service avec chaînage cryptographique

import { Pool, PoolClient } from "pg";
import { v4 as uuid } from "uuid";
import { ActorType, AuditResult } from "./config";

export interface AuditLog {
  module: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  actor_type: ActorType;
  actor_id?: string;
  actor_org?: string;
  result: AuditResult;
  reason?: string;
  ip?: string;
  user_agent?: string;
  device_id?: string;
  geo_country?: string;
  geo_city?: string;
  request_id?: string;
  session_id?: string;
  sira_score?: number;
  data_redacted?: Record<string, any>;
  data_ciphertext?: Buffer;
  created_at?: string;
}

export interface SearchCriteria {
  module?: string;
  actor_id?: string;
  resource_type?: string;
  resource_id?: string;
  action?: string;
  result?: string;
  from?: string;
  to?: string;
  q?: string; // Full-text search in data_redacted
  limit?: number;
}

export class AuditService {
  constructor(private pool: Pool) {}

  /**
   * Get the previous hash for cryptographic chaining
   */
  private async getPrevHash(client: PoolClient): Promise<Buffer | null> {
    const { rows } = await client.query(
      "SELECT hash FROM molam_audit_logs ORDER BY created_at DESC LIMIT 1"
    );
    return rows[0]?.hash || null;
  }

  /**
   * Append a log entry to the audit trail
   * Uses transaction to ensure atomicity and proper chaining
   */
  async append(log: AuditLog): Promise<string> {
    const id = uuid();
    const created_at = log.created_at || new Date().toISOString();
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // Get previous hash for chaining
      const prev_hash = await this.getPrevHash(client);

      // Insert log entry (trigger will compute hash)
      await client.query(
        `INSERT INTO molam_audit_logs
         (id, module, action, resource_type, resource_id, actor_type, actor_id, actor_org,
          result, reason, ip, user_agent, device_id, geo_country, geo_city, request_id,
          session_id, sira_score, data_redacted, data_ciphertext, prev_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
        [
          id,
          log.module,
          log.action,
          log.resource_type || null,
          log.resource_id || null,
          log.actor_type,
          log.actor_id || null,
          log.actor_org || null,
          log.result,
          log.reason || null,
          log.ip || null,
          log.user_agent || null,
          log.device_id || null,
          log.geo_country || null,
          log.geo_city || null,
          log.request_id || null,
          log.session_id || null,
          log.sira_score || null,
          log.data_redacted ? JSON.stringify(log.data_redacted) : null,
          log.data_ciphertext || null,
          prev_hash,
          created_at,
        ]
      );

      await client.query("COMMIT");
      return id;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Append multiple logs in a batch (for performance)
   */
  async appendBatch(logs: AuditLog[]): Promise<string[]> {
    if (logs.length === 0) return [];

    const client = await this.pool.connect();
    const ids: string[] = [];

    try {
      await client.query("BEGIN");

      let prev_hash = await this.getPrevHash(client);

      for (const log of logs) {
        const id = uuid();
        const created_at = log.created_at || new Date().toISOString();

        await client.query(
          `INSERT INTO molam_audit_logs
           (id, module, action, resource_type, resource_id, actor_type, actor_id, actor_org,
            result, reason, ip, user_agent, device_id, geo_country, geo_city, request_id,
            session_id, sira_score, data_redacted, data_ciphertext, prev_hash, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
           RETURNING hash`,
          [
            id,
            log.module,
            log.action,
            log.resource_type || null,
            log.resource_id || null,
            log.actor_type,
            log.actor_id || null,
            log.actor_org || null,
            log.result,
            log.reason || null,
            log.ip || null,
            log.user_agent || null,
            log.device_id || null,
            log.geo_country || null,
            log.geo_city || null,
            log.request_id || null,
            log.session_id || null,
            log.sira_score || null,
            log.data_redacted ? JSON.stringify(log.data_redacted) : null,
            log.data_ciphertext || null,
            prev_hash,
            created_at,
          ]
        );

        // Update prev_hash for next iteration
        const result = await client.query(
          "SELECT hash FROM molam_audit_logs WHERE id = $1",
          [id]
        );
        prev_hash = result.rows[0]?.hash || prev_hash;

        ids.push(id);
      }

      await client.query("COMMIT");
      return ids;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Search audit logs with filters
   */
  async search(criteria: SearchCriteria): Promise<any[]> {
    const params: any[] = [];
    const where: string[] = [];
    let paramCount = 1;

    if (criteria.module) {
      where.push(`module = $${paramCount}`);
      params.push(criteria.module);
      paramCount++;
    }

    if (criteria.actor_id) {
      where.push(`actor_id = $${paramCount}`);
      params.push(criteria.actor_id);
      paramCount++;
    }

    if (criteria.resource_type) {
      where.push(`resource_type = $${paramCount}`);
      params.push(criteria.resource_type);
      paramCount++;
    }

    if (criteria.resource_id) {
      where.push(`resource_id = $${paramCount}`);
      params.push(criteria.resource_id);
      paramCount++;
    }

    if (criteria.action) {
      where.push(`action = $${paramCount}`);
      params.push(criteria.action);
      paramCount++;
    }

    if (criteria.result) {
      where.push(`result = $${paramCount}`);
      params.push(criteria.result);
      paramCount++;
    }

    if (criteria.from) {
      where.push(`created_at >= $${paramCount}`);
      params.push(criteria.from);
      paramCount++;
    }

    if (criteria.to) {
      where.push(`created_at <= $${paramCount}`);
      params.push(criteria.to);
      paramCount++;
    }

    if (criteria.q) {
      where.push(`data_redacted::text ILIKE '%' || $${paramCount} || '%'`);
      params.push(criteria.q);
      paramCount++;
    }

    const limit = Math.min(criteria.limit || 500, 500);

    const sql = `
      SELECT * FROM molam_audit_logs
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  /**
   * Verify chain integrity for a date range
   */
  async verifyChain(
    from: Date = new Date(Date.now() - 24 * 60 * 60 * 1000),
    to: Date = new Date()
  ): Promise<{ is_valid: boolean; broken_at: string | null; total_checked: number }> {
    const { rows } = await this.pool.query(
      "SELECT * FROM verify_audit_chain($1, $2)",
      [from.toISOString(), to.toISOString()]
    );

    return {
      is_valid: rows[0]?.is_valid || false,
      broken_at: rows[0]?.broken_at || null,
      total_checked: parseInt(rows[0]?.total_checked || "0", 10),
    };
  }

  /**
   * Get logs for export (date range)
   */
  async getLogsForExport(from: Date, to: Date): Promise<any[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM molam_audit_logs
       WHERE created_at >= $1 AND created_at < $2
       ORDER BY created_at ASC`,
      [from.toISOString(), to.toISOString()]
    );
    return rows;
  }

  /**
   * Get statistics
   */
  async getStats(days: number = 7): Promise<any> {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { rows } = await this.pool.query(
      `SELECT
         COUNT(*) as total,
         COUNT(DISTINCT actor_id) as unique_actors,
         COUNT(DISTINCT module) as unique_modules,
         COUNT(CASE WHEN result IN ('success','allow') THEN 1 END) as success_count,
         COUNT(CASE WHEN result IN ('failure','deny') THEN 1 END) as failure_count
       FROM molam_audit_logs
       WHERE created_at >= $1`,
      [from.toISOString()]
    );

    return rows[0];
  }
}
