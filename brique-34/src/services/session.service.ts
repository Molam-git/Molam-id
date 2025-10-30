import db from "../db";
import { createHmac } from "crypto";
import { differenceInMinutes } from "date-fns";
import { publishEvent } from "../events/bus"; // Redis/Kafka producer

export type SessionFilter = {
    userId?: string;
    channel?: "mobile" | "web" | "ussd" | "api";
    deviceId?: string;
    olderThanMinutes?: number;
};

async function getPolicies() {
    const rows = await db.any("SELECT key, value FROM id_session_policies");
    const obj: any = {};
    rows.forEach(r => obj[r.key] = r.value);
    return obj;
}

export async function listMySessions(userId: string) {
    return db.any(
        `SELECT id, channel, device_id, ip, user_agent, geo_country, created_at, last_seen_at, expires_at, is_active
     FROM molam_sessions WHERE user_id=$1 AND is_active=TRUE ORDER BY last_seen_at DESC`,
        [userId]
    );
}

export async function heartbeat(sessionId: string, ip?: string, ua?: string) {
    const policies = await getPolicies();
    const idle = policies.idle_timeout?.minutes ?? 30;
    const sess = await db.oneOrNone("SELECT * FROM molam_sessions WHERE id=$1 AND is_active=TRUE", [sessionId]);
    if (!sess) return { ok: false, reason: "not_found_or_inactive" };

    const newExpires = `NOW() + INTERVAL '${idle} minutes'`;
    await db.none(
        `UPDATE molam_sessions SET last_seen_at=NOW(), ip=COALESCE($2, ip), user_agent=COALESCE($3, user_agent),
      expires_at=${newExpires}
     WHERE id=$1`, [sessionId, ip || null, ua || null]
    );
    await db.none(
        `INSERT INTO molam_session_activity(session_id, event, meta) VALUES ($1,'HEARTBEAT', $2::jsonb)`,
        [sessionId, JSON.stringify({ ip, ua })]
    );
    return { ok: true };
}

export async function revokeOne(actorUserId: string, sessionId: string, ip?: string, ua?: string) {
    const row = await db.oneOrNone(
        `UPDATE molam_sessions SET is_active=FALSE, revoked_at=NOW(), revocation_reason='manual_revoke'
     WHERE id=$1 AND is_active=TRUE RETURNING id, user_id`, [sessionId]
    );
    if (!row) return { ok: false, reason: "not_found_or_inactive" };

    await db.none(`INSERT INTO molam_session_activity(session_id, event, meta)
                 VALUES ($1,'REVOKE', $2::jsonb)`, [sessionId, JSON.stringify({ by: actorUserId })]);

    await wormAudit(actorUserId, "SESSION_REVOKE", sessionId, { reason: "manual_revoke" }, ip, ua);
    await publishEvent("id.session.revoked", { session_id: sessionId, user_id: row.user_id });

    return { ok: true };
}

export async function revokeAllButCurrent(actorUserId: string, userId: string, currentSessionId: string, ip?: string, ua?: string) {
    const sessions = await db.any(
        `SELECT id FROM molam_sessions WHERE user_id=$1 AND is_active=TRUE AND id<>$2`, [userId, currentSessionId]
    );
    for (const s of sessions) {
        await db.none(
            `UPDATE molam_sessions SET is_active=FALSE, revoked_at=NOW(), revocation_reason='bulk_user_revoke' WHERE id=$1`, [s.id]
        );
        await db.none(`INSERT INTO molam_session_activity(session_id, event, meta)
                   VALUES ($1,'REVOKE', '{"bulk": true}')`, [s.id]);
        await publishEvent("id.session.revoked", { session_id: s.id, user_id: userId });
    }
    await wormAudit(actorUserId, "SESSIONS_REVOKE_ALL", null, { count: sessions.length }, ip, ua);
    return { ok: true, count: sessions.length };
}

export async function adminListByUser(userId: string) {
    return db.any(
        `SELECT id, channel, device_id, ip, geo_country, created_at, last_seen_at, expires_at, is_active
     FROM molam_sessions WHERE user_id=$1 ORDER BY last_seen_at DESC`,
        [userId]
    );
}

export async function adminRevokeByFilter(actorUserId: string, filter: SessionFilter, ip?: string, ua?: string) {
    const where: string[] = [];
    const args: any[] = [];
    if (filter.userId) { args.push(filter.userId); where.push(`user_id=$${args.length}`); }
    if (filter.channel) { args.push(filter.channel); where.push(`channel=$${args.length}`); }
    if (filter.deviceId) { args.push(filter.deviceId); where.push(`device_id=$${args.length}`); }
    if (filter.olderThanMinutes) { args.push(filter.olderThanMinutes); where.push(`last_seen_at < NOW() - ($${args.length}::text||' minutes')::interval`); }
    where.push("is_active=TRUE");

    const sqlSelect = `SELECT id, user_id FROM molam_sessions WHERE ${where.join(" AND ")}`;
    const victims = await db.any(sqlSelect, args);

    for (const v of victims) {
        await db.none(`UPDATE molam_sessions SET is_active=FALSE, revoked_at=NOW(), revocation_reason='admin_filter' WHERE id=$1`, [v.id]);
        await db.none(`INSERT INTO molam_session_activity(session_id, event, meta) VALUES ($1,'REVOKE','{"admin_filter":true}')`, [v.id]);
        await publishEvent("id.session.revoked", { session_id: v.id, user_id: v.user_id });
    }

    await wormAudit(actorUserId, "SESSION_REVOKE", null, { filter, count: victims.length }, ip, ua);
    return { ok: true, count: victims.length };
}

export async function detectAnomaliesOnLogin(sessionId: string, prevGeo: any, newGeo: any, fpScore: number) {
    const policies = await getPolicies();
    const tol = policies.fp_mismatch_tolerance?.score_min ?? 0.85;

    // FP mismatch
    if (fpScore < tol) {
        await markAnomaly(sessionId, "FP_MISMATCH", "medium", { fpScore });
    }

    // Impossible travel
    if (prevGeo && newGeo) {
        const speed = estimateSpeedKmH(prevGeo, newGeo); // see helper
        const th = policies.impossible_travel?.kmh_threshold ?? 900;
        if (speed > th) {
            await markAnomaly(sessionId, "IMPOSSIBLE_TRAVEL", "high", { speed, th, prevGeo, newGeo });
        }
    }
}

async function markAnomaly(sessionId: string, kind: string, severity: string, details: any) {
    await db.tx(async t => {
        const a = await t.one(
            `INSERT INTO molam_session_anomalies(session_id, kind, severity, details)
       VALUES ($1,$2,$3,$4) RETURNING id`, [sessionId, kind, severity, details]
        );
        await t.none(`INSERT INTO molam_session_activity(session_id, event, meta) VALUES ($1,'ANOMALY',$2::jsonb)`,
            [sessionId, JSON.stringify({ kind, severity, anomaly_id: a.id })]);
    });
    await publishEvent("id.session.anomaly", { session_id: sessionId, kind, severity, details });
}

export function estimateSpeedKmH(a: { lat: number, lng: number, at: number }, b: { lat: number, lng: number, at: number }) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lng - a.lng) * Math.PI / 180;
    const la = a.lat * Math.PI / 180, lb = b.lat * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
    const d = 2 * R * Math.asin(Math.sqrt(x)); // km
    const dtHours = Math.max((b.at - a.at) / 3600000, 0.0003); // avoid div0
    return d / dtHours;
}

async function wormAudit(actor: string | null, action: string, sessionId: any, payload: any, ip?: string, ua?: string) {
    const msg = JSON.stringify({ action, sessionId, payload, at: Date.now(), actor });
    const sig = createHmac("sha256", process.env.WORM_SIGNING_SECRET || "dev").update(msg).digest();
    await db.none(
        `INSERT INTO id_session_worm_audit(actor_user, action, session_id, payload, signature, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [actor, action, sessionId, payload || {}, sig, ip || null, ua || null]
    );
}