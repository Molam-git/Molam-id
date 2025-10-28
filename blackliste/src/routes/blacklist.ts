import { Router } from "express";
import { pool } from "../repo.js";
import { requireJWT } from "../auth.js";
import { v4 as uuid } from "uuid";

const r = Router();

// Ajouter cette fonction emitEvent manquante
const emitEvent = async (event: string, data: any) => {
    // En production, implémentez avec RabbitMQ/Kafka/SIRA
    console.log(`Event: ${event}`, data);
};

/**
 * Add user to blacklist
 * POST /v1/blacklist
 */
r.post("/", requireJWT("id:blacklist:add"), async (req, res) => {
    const adminId = res.locals.user.sub; // Changé: req.user → res.locals.user
    const { user_id, scope, module, reason, end_at, metadata } = req.body || {};
    if (!user_id || !reason) return res.status(400).json({ error: "missing_fields" });

    const id = uuid();
    await pool.query(
        `INSERT INTO molam_blacklist(id,user_id,scope,module,reason,issued_by,end_at,metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, user_id, scope || 'global', module || null, reason, adminId, end_at || null, metadata || {}]
    );

    await pool.query(
        `INSERT INTO molam_blacklist_audit(id,blacklist_id,action,actor_id,detail)
     VALUES ($1,$2,'add',$3,$4)`,
        [uuid(), id, adminId, JSON.stringify({ reason, scope, module })]
    );

    // Emit event for modules + SIRA
    await emitEvent("blacklist.added", { user_id, scope, module, reason });

    res.status(201).json({ blacklist_id: id, status: "active" });
});

/**
 * Revoke blacklist
 * POST /v1/blacklist/:id/revoke
 */
r.post("/:id/revoke", requireJWT("id:blacklist:revoke"), async (req, res) => {
    const id = req.params.id;
    const actorId = res.locals.user.sub; // Changé: req.user → res.locals.user
    await pool.query("UPDATE molam_blacklist SET status='revoked',updated_at=NOW() WHERE id=$1", [id]);
    await pool.query(
        `INSERT INTO molam_blacklist_audit(id,blacklist_id,action,actor_id)
     VALUES ($1,$2,'revoke',$3)`,
        [uuid(), id, actorId]
    );
    await emitEvent("blacklist.revoked", { blacklist_id: id });
    res.json({ status: "revoked" });
});

/**
 * Check if user is blacklisted
 * GET /v1/blacklist/check/:user_id?module=pay
 */
r.get("/check/:user_id", requireJWT("id:blacklist:check"), async (req, res) => {
    const { user_id } = req.params;
    const { module } = req.query;
    const { rows } = await pool.query(
        "SELECT * FROM molam_blacklist WHERE user_id=$1 AND status='active' AND (scope='global' OR module=$2) AND (end_at IS NULL OR end_at > NOW())",
        [user_id, module || null]
    );
    if (rows.length > 0) res.json({ blacklisted: true, details: rows });
    else res.json({ blacklisted: false });
});

export default r;