import db from "../db";
import { randomUUID, createHmac } from "crypto";

// Verify role
async function assertIsSuperAdmin(userId: string) {
  const row = await db.oneOrNone(
    "SELECT 1 FROM molam_roles WHERE user_id=$1 AND module='id' AND role='superadmin' LIMIT 1",
    [userId]
  );
  if (!row) throw Object.assign(new Error("forbidden"), { status: 403 });
}

async function loadPolicy(actionKey: string) {
  const p = await db.oneOrNone("SELECT * FROM id_admin_action_policies WHERE action_key=$1", [actionKey]);
  if (!p) throw Object.assign(new Error("unknown_action"), { status: 400 });
  return p;
}

export async function listSuperAdmins() {
  return db.any(`
    SELECT u.id, u.email
    FROM molam_roles r
    JOIN molam_users u ON u.id = r.user_id
    WHERE r.module='id' AND r.role='superadmin'
  `);
}

export async function createActionRequest(caller: string, body: any, meta: any) {
  await assertIsSuperAdmin(caller);
  const policy = await loadPolicy(body.action_key);
  const key = meta.idempotencyKey || randomUUID();

  const row = await db.one(`
    INSERT INTO id_admin_action_requests (action_key, requested_by, target_user, payload, justification, approvals_required, expires_at, idempotency_key)
    VALUES ($1,$2,$3,$4,$5,$6,NOW() + ($7::text || ' minutes')::interval,$8)
    ON CONFLICT (idempotency_key) DO UPDATE SET updated_at=NOW()
    RETURNING *;
  `, [body.action_key, caller, body.target_user || null, body.payload || {}, body.justification, policy.min_approvals, policy.expires_in_minutes, key]);

  await appendWormAudit(caller, body.action_key, row.id, body, meta);
  return row;
}

export async function approveRequest(caller: string, requestId: string, decision: "APPROVE"|"REJECT", reason?: string, meta?: any) {
  await assertIsSuperAdmin(caller);
  const req = await db.oneOrNone("SELECT * FROM id_admin_action_requests WHERE id=$1", [requestId]);
  if (!req) throw Object.assign(new Error("not_found"), { status: 404 });
  if (req.requested_by === caller) throw Object.assign(new Error("self_approve_forbidden"), { status: 403 });

  await db.tx(async t => {
    await t.none(
      "INSERT INTO id_admin_action_approvals(request_id, approver, decision, reason) VALUES ($1,$2,$3,$4)",
      [requestId, caller, decision, reason || null]
    );

    const { approvals } = await t.one(
      "SELECT COUNT(*)::int AS approvals FROM id_admin_action_approvals WHERE request_id=$1 AND decision='APPROVE'",
      [requestId]
    );

    const newStatus =
      decision === "REJECT" ? "REJECTED" :
      (approvals >= req.approvals_required ? "APPROVED" : "PENDING");

    await t.none("UPDATE id_admin_action_requests SET approvals_count=$1, status=$2, updated_at=NOW() WHERE id=$3",
      [approvals, newStatus, requestId]);
  });

  await appendWormAudit(caller, `${req.action_key}_APPROVAL`, requestId, { decision, reason }, meta);
  return { ok: true };
}

export async function executeRequest(caller: string, requestId: string, meta: any) {
  await assertIsSuperAdmin(caller);
  const req = await db.oneOrNone("SELECT * FROM id_admin_action_requests WHERE id=$1", [requestId]);
  if (!req) throw Object.assign(new Error("not_found"), { status: 404 });
  if (req.status !== "APPROVED") throw Object.assign(new Error("not_approved"), { status: 409 });

  const policy = await loadPolicy(req.action_key);
  if (policy.requires_hsm && !meta.hsm_assertion)
    throw Object.assign(new Error("hsm_required"), { status: 400 });

  await db.tx(async t => {
    switch (req.action_key) {
      case "ADD_SUPERADMIN":
        await t.none(
          `INSERT INTO molam_roles(user_id,module,role,access_scope)
           VALUES ($1,'id','superadmin','admin')
           ON CONFLICT (user_id,module,role) DO NOTHING`,
          [req.target_user]
        );
        break;

      case "REMOVE_SUPERADMIN":
        await t.none(
          "DELETE FROM molam_roles WHERE user_id=$1 AND module='id' AND role='superadmin'",
          [req.target_user]
        );
        break;

      case "ELEVATE_TEMP_ROLE":
        const p = req.payload || {};
        if (!p.role || !p.expires_at)
          throw Object.assign(new Error("invalid_payload"), { status: 400 });
        const [mod, role] = String(p.role).split(":");
        await t.none(
          `INSERT INTO molam_roles(user_id,module,role,access_scope,expires_at)
           VALUES ($1,$2,$3,'admin',$4)
           ON CONFLICT (user_id,module,role) DO UPDATE SET expires_at=$4`,
          [req.target_user, mod || 'id', role || p.role, p.expires_at]
        );
        break;

      case "BREAK_GLASS":
        await t.none(
          `INSERT INTO id_break_glass_events(request_id, activated_by, hsm_assertion, otp_reference)
           VALUES ($1,$2,$3,$4)`,
          [req.id, caller, meta.hsm_assertion || "HSM_OK", req.payload?.otp_reference || null]
        );
        break;
    }

    await t.none("UPDATE id_admin_action_requests SET status='EXECUTED', updated_at=NOW() WHERE id=$1", [requestId]);
  });

  await appendWormAudit(caller, `${req.action_key}_EXECUTE`, requestId, req.payload || {}, meta);
  return { ok: true };
}

export async function closeBreakGlass(caller: string, id: string, postmortem_url: string, meta: any) {
  await assertIsSuperAdmin(caller);
  await db.none(
    "UPDATE id_break_glass_events SET status='CLOSED', ended_at=NOW(), postmortem_url=$2 WHERE id=$1 AND status='ACTIVE'",
    [id, postmortem_url]
  );
  await appendWormAudit(caller, "BREAK_GLASS_CLOSE", id, { postmortem_url }, meta);
}

export async function listWormAudit(page = 1, size = 50) {
  const offset = (page - 1) * size;
  return db.any("SELECT * FROM id_admin_worm_audit ORDER BY at DESC LIMIT $1 OFFSET $2", [size, offset]);
}

async function appendWormAudit(actor: string, actionKey: string, objectId: any, payload: any, meta: any) {
  const canonical = JSON.stringify({ actionKey, objectId, payload, at: Date.now(), actor });
  const sig = createHmac("sha256", process.env.WORM_SIGNING_SECRET || "dev").update(canonical).digest();
  await db.none(
    "INSERT INTO id_admin_worm_audit(actor, action_key, object_id, payload, signature, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [actor, actionKey, objectId, payload || {}, sig, meta?.ip || null, meta?.ua || null]
  );
}
