// src/util/audit.ts
import { pool } from "./pg.js";
import { Request } from "express";
import { v4 as uuid } from "uuid";

export interface AuditEventDetail {
  [key: string]: any;
}

/**
 * Log authentication event to immutable audit table
 */
export async function audit(
  userId: string | null,
  deviceId: string | null,
  eventType: string,
  req: Request,
  detail: AuditEventDetail = {}
): Promise<void> {
  try {
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip || null;
    const userAgent = req.headers["user-agent"] || null;
    const geoCountry = req.headers["x-geo-country"] as string || null;
    const correlationId = req.headers["x-correlation-id"] as string || uuid();

    await pool.query(
      `INSERT INTO molam_auth_events
       (id, user_id, device_id, event_type, ip, user_agent, geo_country, detail, correlation_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        uuid(),
        userId,
        deviceId,
        eventType,
        ip,
        userAgent,
        geoCountry,
        JSON.stringify(detail),
        correlationId,
      ]
    );
  } catch (err) {
    console.error("Audit logging error:", err);
    // Non-fatal: don't block the request
  }
}
