// Brique 14: Audit logs - API Routes

import { Router, Request, Response, NextFunction } from "express";
import { AuditService } from "./audit.service";
import { pool } from "../util/pg";
import { requireServiceJWT, requireRole } from "../util/auth";
import { AppError } from "../util/errors";
import { config } from "./config";
import { getCached, setCached } from "../util/redis";

const router = Router();
const audit = new AuditService(pool);

/**
 * POST /v1/audit - Append audit log
 * Security: Service JWT with scope 'audit:append'
 * Used by all Molam services to push audit events
 */
router.post(
  "/",
  requireServiceJWT(config.scopes.append),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = await audit.append(req.body);
      res.status(201).json({ id });
    } catch (e: any) {
      next(
        new AppError(400, "append_failed", e.message || "Failed to append audit log")
      );
    }
  }
);

/**
 * POST /v1/audit/batch - Append multiple audit logs
 * Security: Service JWT with scope 'audit:append'
 * For batch ingestion
 */
router.post(
  "/batch",
  requireServiceJWT(config.scopes.append),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { logs } = req.body;

      if (!Array.isArray(logs)) {
        throw new AppError(400, "bad_request", "logs must be an array");
      }

      const ids = await audit.appendBatch(logs);
      res.status(201).json({ ids, count: ids.length });
    } catch (e: any) {
      next(
        new AppError(400, "batch_append_failed", e.message || "Failed to append batch")
      );
    }
  }
);

/**
 * GET /v1/audit/search - Search audit logs
 * Security: Requires role in allowedRoles (auditor, compliance_officer, etc.)
 * Query params: module, actor_id, resource_type, resource_id, action, result, from, to, q
 */
router.get(
  "/search",
  requireRole(config.allowedRoles),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        module,
        actor_id,
        resource_type,
        resource_id,
        action,
        result,
        from,
        to,
        q,
        limit,
      } = req.query;

      // Build cache key
      const cacheKey = `search:${JSON.stringify(req.query)}`;
      const cached = await getCached<any>(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      const items = await audit.search({
        module: module as string,
        actor_id: actor_id as string,
        resource_type: resource_type as string,
        resource_id: resource_id as string,
        action: action as string,
        result: result as string,
        from: from as string,
        to: to as string,
        q: q as string,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      const response = { items, count: items.length };

      // Cache for 1 minute
      await setCached(cacheKey, response, config.redis.ttl);

      res.json(response);
    } catch (e: any) {
      next(new AppError(500, "search_failed", e.message || "Search failed"));
    }
  }
);

/**
 * GET /v1/audit/verify-chain - Verify cryptographic chain integrity
 * Security: Requires role in allowedRoles
 * Query params: from, to (ISO timestamps)
 */
router.get(
  "/verify-chain",
  requireRole(config.allowedRoles),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { from, to } = req.query;

      const fromDate = from
        ? new Date(from as string)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();

      const result = await audit.verifyChain(fromDate, toDate);

      res.json({
        ...result,
        message: result.is_valid
          ? "Chain integrity verified"
          : `Chain broken at log ${result.broken_at}`,
      });
    } catch (e: any) {
      next(
        new AppError(500, "verify_failed", e.message || "Chain verification failed")
      );
    }
  }
);

/**
 * GET /v1/audit/stats - Get audit statistics
 * Security: Requires role in allowedRoles
 * Query params: days (default: 7)
 */
router.get(
  "/stats",
  requireRole(config.allowedRoles),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { days } = req.query;
      const daysNum = days ? parseInt(days as string, 10) : 7;

      const stats = await audit.getStats(daysNum);

      res.json({
        period_days: daysNum,
        ...stats,
      });
    } catch (e: any) {
      next(new AppError(500, "stats_failed", e.message || "Failed to get stats"));
    }
  }
);

/**
 * GET /v1/audit/export - Export audit logs for archival
 * Security: Requires role in allowedRoles + scope 'audit:export'
 * Query params: from, to (required)
 * Returns: JSONL (newline-delimited JSON)
 */
router.get(
  "/export",
  requireRole(config.allowedRoles),
  requireServiceJWT(config.scopes.export),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { from, to } = req.query;

      if (!from || !to) {
        throw new AppError(400, "bad_request", "from and to dates required");
      }

      const fromDate = new Date(from as string);
      const toDate = new Date(to as string);

      const logs = await audit.getLogsForExport(fromDate, toDate);

      // Set headers for download
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="audit_${from}_${to}.jsonl"`
      );

      // Stream JSONL
      for (const log of logs) {
        res.write(JSON.stringify(log) + "\n");
      }

      res.end();
    } catch (e: any) {
      next(new AppError(500, "export_failed", e.message || "Export failed"));
    }
  }
);

export default router;
