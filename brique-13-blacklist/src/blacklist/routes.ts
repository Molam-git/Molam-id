// Brique 13: Blacklist & Suspensions - Routes

import { Router, Request, Response, NextFunction } from "express";
import { v4 as uuid } from "uuid";
import { query, queryOne } from "../util/pg";
import { getCached, setCached, delCached } from "../util/redis";
import { authRequired, requireScope } from "../util/auth";
import { AppError } from "../util/errors";
import { audit } from "../util/audit";
import { emitEvent } from "../util/events";
import { config } from "./config";

const router = Router();

// POST /v1/blacklist - Add user to blacklist
router.post(
  "/",
  authRequired,
  requireScope(config.scopes.add),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        user_id,
        scope = "global",
        module,
        reason,
        end_at,
        metadata,
      } = req.body;
      const issuedBy = req.user!.userId;

      // Validation
      if (!user_id || !reason) {
        throw new AppError(400, "bad_request", "user_id and reason required");
      }

      if (scope === "module" && !module) {
        throw new AppError(
          400,
          "bad_request",
          "module required for module-scoped blacklist"
        );
      }

      if (scope === "module" && !config.modules.includes(module)) {
        throw new AppError(400, "bad_request", `Invalid module: ${module}`);
      }

      // Check if already blacklisted
      const existing = await queryOne(
        `SELECT id FROM molam_blacklist
         WHERE user_id = $1 AND status = 'active'
         AND scope = $2 AND (module = $3 OR module IS NULL)
         LIMIT 1`,
        [user_id, scope, module || null]
      );

      if (existing) {
        throw new AppError(
          409,
          "already_blacklisted",
          "User already blacklisted in this scope"
        );
      }

      // Create blacklist entry
      const blacklist = await queryOne(
        `INSERT INTO molam_blacklist
         (id, user_id, scope, module, reason, issued_by, end_at, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
         RETURNING *`,
        [
          uuid(),
          user_id,
          scope,
          module || null,
          reason,
          issuedBy,
          end_at || null,
          metadata ? JSON.stringify(metadata) : null,
        ]
      );

      // Audit log
      await query(
        `INSERT INTO molam_blacklist_audit
         (id, blacklist_id, action, actor_id, detail, ip)
         VALUES ($1, $2, 'add', $3, $4, $5)`,
        [
          uuid(),
          blacklist.id,
          issuedBy,
          JSON.stringify({ scope, module, reason }),
          req.ip,
        ]
      );

      // Invalidate cache
      await delCached(`user:${user_id}:blacklist`);

      // Emit event to SIRA
      await emitEvent("blacklist.added", {
        blacklist_id: blacklist.id,
        user_id,
        scope,
        module,
        reason,
        issued_by: issuedBy,
      });

      // Audit via centralized service
      await audit({
        service: config.serviceName,
        action: "blacklist.add",
        actor_id: issuedBy,
        resource_id: user_id,
        detail: { blacklist_id: blacklist.id, scope, module },
        ip: req.ip,
      });

      res.status(201).json({
        blacklist_id: blacklist.id,
        status: "active",
        message: "User added to blacklist",
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /v1/blacklist/:id/revoke - Revoke blacklist entry
router.post(
  "/:id/revoke",
  authRequired,
  requireScope(config.scopes.revoke),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const actorId = req.user!.userId;

      // Get blacklist entry
      const blacklist = await queryOne(
        `SELECT * FROM molam_blacklist WHERE id = $1`,
        [id]
      );

      if (!blacklist) {
        throw new AppError(404, "not_found", "Blacklist entry not found");
      }

      if (blacklist.status !== "active") {
        throw new AppError(
          400,
          "invalid_status",
          "Can only revoke active blacklist entries"
        );
      }

      // Revoke
      await query(
        `UPDATE molam_blacklist
         SET status = 'revoked', updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      // Audit log
      await query(
        `INSERT INTO molam_blacklist_audit
         (id, blacklist_id, action, actor_id, detail, ip)
         VALUES ($1, $2, 'revoke', $3, $4, $5)`,
        [uuid(), id, actorId, JSON.stringify({ reason }), req.ip]
      );

      // Invalidate cache
      await delCached(`user:${blacklist.user_id}:blacklist`);

      // Emit event to SIRA
      await emitEvent("blacklist.revoked", {
        blacklist_id: id,
        user_id: blacklist.user_id,
        revoked_by: actorId,
        reason,
      });

      // Audit
      await audit({
        service: config.serviceName,
        action: "blacklist.revoke",
        actor_id: actorId,
        resource_id: blacklist.user_id,
        detail: { blacklist_id: id, reason },
        ip: req.ip,
      });

      res.json({
        message: "Blacklist entry revoked",
        blacklist_id: id,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /v1/blacklist/check/:user_id - Check if user is blacklisted
router.get(
  "/check/:user_id",
  authRequired,
  requireScope(config.scopes.check),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user_id } = req.params;
      const { module } = req.query;

      // Check cache first
      const cacheKey = `user:${user_id}:blacklist:${module || "global"}`;
      const cached = await getCached<any>(cacheKey);
      if (cached !== null) {
        res.json(cached);
        return;
      }

      // Query database using function
      const result = await query(
        `SELECT * FROM is_user_blacklisted($1, $2)`,
        [user_id, module || null]
      );

      const isBlacklisted = result.length > 0 && result[0].is_blacklisted;

      const response = {
        user_id,
        is_blacklisted: isBlacklisted,
        scope: isBlacklisted ? result[0].scope : null,
        reason: isBlacklisted ? result[0].reason : null,
        blacklist_id: isBlacklisted ? result[0].blacklist_id : null,
      };

      // Cache for 5 minutes
      await setCached(cacheKey, response, config.redis.ttl);

      // Audit check
      await query(
        `INSERT INTO molam_blacklist_audit
         (id, blacklist_id, action, actor_id, detail, ip)
         VALUES ($1, $2, 'check', $3, $4, $5)`,
        [
          uuid(),
          response.blacklist_id || null,
          req.user!.userId,
          JSON.stringify({ user_id, module, is_blacklisted: isBlacklisted }),
          req.ip,
        ]
      );

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /v1/blacklist - List blacklist entries (admin only)
router.get(
  "/",
  authRequired,
  requireScope(config.scopes.list),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, scope, module, limit = 50, offset = 0 } = req.query;

      let sql = `SELECT * FROM molam_blacklist WHERE 1=1`;
      const params: any[] = [];
      let paramCount = 1;

      if (status) {
        sql += ` AND status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      if (scope) {
        sql += ` AND scope = $${paramCount}`;
        params.push(scope);
        paramCount++;
      }

      if (module) {
        sql += ` AND module = $${paramCount}`;
        params.push(module);
        paramCount++;
      }

      sql += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${
        paramCount + 1
      }`;
      params.push(parseInt(limit as string, 10));
      params.push(parseInt(offset as string, 10));

      const blacklists = await query(sql, params);

      res.json({
        blacklists,
        count: blacklists.length,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /v1/blacklist/:id - Get blacklist details
router.get(
  "/:id",
  authRequired,
  requireScope(config.scopes.list),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const blacklist = await queryOne(
        `SELECT * FROM molam_blacklist WHERE id = $1`,
        [id]
      );

      if (!blacklist) {
        throw new AppError(404, "not_found", "Blacklist entry not found");
      }

      // Get audit trail
      const auditTrail = await query(
        `SELECT * FROM molam_blacklist_audit
         WHERE blacklist_id = $1
         ORDER BY created_at DESC`,
        [id]
      );

      res.json({
        blacklist,
        audit_trail: auditTrail,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
