// Audit logging utilities
import { pool } from "./pg";
import { v4 as uuid } from "uuid";
import { Request } from "express";

/**
 * Log authentication event to molam_auth_events
 */
export async function audit(
  userId: string | null,
  eventType: string,
  req: Request,
  detail: Record<string, any> = {}
): Promise<void> {
  const ip = (req.headers["x-forwarded-for"] || req.ip) as string;
  const userAgent = req.headers["user-agent"] || null;
  const geoCountry = req.headers["x-geo-country"] || null;
  const deviceId = (req as any).deviceId || null;

  try {
    await pool.query(
      `INSERT INTO molam_auth_events(id, user_id, device_id, event_type, ip, user_agent, geo_country, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [uuid(), userId, deviceId, eventType, ip, userAgent, geoCountry, JSON.stringify(detail)]
    );
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
