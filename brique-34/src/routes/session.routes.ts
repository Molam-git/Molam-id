import { Router } from "express";
import { requireAuth } from "../middleware/jwt";
import { authzEnforce } from "../middleware/authz";

import {
    listMySessions,
    heartbeat,
    revokeOne,
    revokeAllButCurrent,
    adminListByUser,
    adminRevokeByFilter
} from "../services/session.service";

const r = Router();

// User self-service
r.get("/api/id/sessions/me", requireAuth, async (req: any, res: any) => {
    const rows = await listMySessions(req.user.id);
    res.json({ sessions: rows });
});

r.post("/api/id/sessions/:id/revoke", requireAuth, async (req: any, res: any) => {
    const out = await revokeOne(req.user.id, req.params.id, req.ip, req.headers["user-agent"]);
    if (!out.ok) return res.status(404).json({ error: out.reason });
    res.json(out);
});

r.post("/api/id/sessions/revoke_all", requireAuth, async (req: any, res: any) => {
    const out = await revokeAllButCurrent(req.user.id, req.user.id, req.session?.id, req.ip, req.headers["user-agent"]);
    res.json(out);
});

// Heartbeat
r.post("/api/id/sessions/heartbeat", requireAuth, async (req: any, res: any) => {
    const sId = req.session?.id || req.body.session_id;
    const out = await heartbeat(sId, req.ip, req.headers["user-agent"]);
    if (!out.ok) return res.status(404).json({ error: out.reason });
    res.json({ ok: true });
});

// Admin (ID domain only)
r.get("/api/id/admin/sessions/user/:userId", [requireAuth, authzEnforce("id:admin")], async (req: any, res: any) => {
    res.json({ sessions: await adminListByUser(req.params.userId) });
});

r.post("/api/id/admin/sessions/revoke", [requireAuth, authzEnforce("id:admin")], async (req: any, res: any) => {
    const out = await adminRevokeByFilter(req.user.id, req.body || {}, req.ip, req.headers["user-agent"]);
    res.json(out);
});

export default r;