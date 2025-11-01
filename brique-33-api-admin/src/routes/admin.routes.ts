import { Router } from "express";
import { requireAuth } from "../middleware/jwt";
import { authzEnforce } from "../middleware/authz.ts"; // Brique 31
import { CreateActionRequestSchema, ApproveRequestSchema, CloseBreakGlassSchema } from "../validators/admin.schemas";
import {
  listSuperAdmins, createActionRequest, approveRequest, executeRequest,
  closeBreakGlass, listWormAudit
} from "../services/admin.service";

const r = Router();

// all routes require superadmin in ID domain
const guard = [requireAuth, authzEnforce("id:superadmin")];

r.get("/api/id/admin/superadmins", guard, async (_req:any, res) => {
  res.json({ superadmins: await listSuperAdmins() });
});

r.post("/api/id/admin/requests", guard, async (req:any, res, next) => {
  try{
    const body = CreateActionRequestSchema.parse(req.body);
    const meta = { idempotencyKey: req.headers["idempotency-key"] as string | undefined, ip: req.ip, ua: req.headers["user-agent"] };
    const out = await createActionRequest(req.user.id, body, meta);
    res.status(201).json(out);
  }catch(e){ next(e); }
});

r.post("/api/id/admin/requests/:id/approve", guard, async (req:any, res, next) => {
  try{
    const body = ApproveRequestSchema.parse(req.body);
    const out = await approveRequest(req.user.id, req.params.id, body.decision, body.reason, { ip:req.ip, ua:req.headers["user-agent"] });
    res.json(out);
  }catch(e){ next(e); }
});

r.post("/api/id/admin/requests/:id/execute", guard, async (req:any, res, next) => {
  try{
    const meta = { hsm_assertion: req.headers["x-hsm-assertion"], ip:req.ip, ua:req.headers["user-agent"], idempotencyKey:req.headers["idempotency-key"] };
    const out = await executeRequest(req.user.id, req.params.id, meta);
    res.json(out);
  }catch(e){ next(e); }
});

r.post("/api/id/admin/break-glass/:id/close", guard, async (req:any, res, next) => {
  try{
    const body = CloseBreakGlassSchema.parse(req.body);
    const out = await closeBreakGlass(req.user.id, req.params.id, body.postmortem_url, { ip:req.ip, ua:req.headers["user-agent"] });
    res.json(out);
  }catch(e){ next(e); }
});

r.get("/api/id/admin/audit", guard, async (req:any, res) => {
  const page = parseInt(req.query.page || "1", 10);
  const pageSize = Math.min(parseInt(req.query.pageSize || "50", 10), 200);
  res.json({ entries: await listWormAudit(page, pageSize) });
});

export default r;
