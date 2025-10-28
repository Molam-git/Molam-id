import { Router } from "express";
import { FxService } from "./fx.service";
import { pool } from "../repo";
import { requireServiceJWT, rateLimit } from "../security";

const r = Router();
const svc = new FxService(pool);

r.get("/convert", rateLimit("fx_convert"), requireServiceJWT, async (req, res) => {
    const q = req.query;
    const resp = await svc.convert({
        from: String(q.from), to: String(q.to), amount: String(q.amount),
        countryCode: q.country ? String(q.country) : undefined,
        moduleSlug: String(q.module || "id"),
        userId: (req as any).user?.id || null,
        requestId: (req as any).trace_id || null,
        mode: (q.mode === 'cash' ? 'cash' : 'pricing')
    });
    if (q.mode !== 'cash') res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.json(resp);
});

r.post("/ingest", requireServiceJWT, async (_req, res) => {
    res.json({ enqueued: true });
});

export default r;