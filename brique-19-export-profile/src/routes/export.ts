/**
 * Export Profile Routes
 * POST /v1/profile/export - Create export job
 * GET /v1/profile/export/:id - Get export status and signed URLs
 */

import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { authMiddleware, requireScope, hasScope, logRequest } from "../util/auth";
import { query } from "../util/pg";
import { getUserLocale } from "../util/i18n";
import { publishDomainEvent } from "../util/events";

const router = Router();

/**
 * Validation schema
 */
const createExportSchema = z.object({
  user_id: z.string().uuid().optional(),
  locale: z
    .string()
    .min(2)
    .max(10)
    .optional()
    .describe("Language code (fr, en, ar, wo, pt, es)"),
});

/**
 * POST /v1/profile/export
 * Create export job (async)
 */
router.post("/v1/profile/export", authMiddleware, async (req, res, next) => {
  try {
    const actorId = req.user!.sub;
    logRequest(req, { action: "create_export" });

    // Validate input
    const parsed = createExportSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: "invalid_payload",
        detail: parsed.error.errors,
      });
    }

    const { user_id, locale } = parsed.data;
    let targetUserId = actorId;

    // Check permissions
    if (user_id && user_id !== actorId) {
      // Admin requesting export for another user
      try {
        requireScope(req, "id:export:any");
        targetUserId = user_id;
      } catch (error) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Missing required scope: id:export:any",
        });
      }
    } else {
      // Self export
      try {
        requireScope(req, "id:export:self");
      } catch (error) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Missing required scope: id:export:self",
        });
      }
    }

    // Check rate limit (24h cooldown)
    const rateLimitResult = await query(
      `SELECT can_request_export($1) as can_request`,
      [targetUserId]
    );

    if (!rateLimitResult.rows[0]?.can_request) {
      return res.status(429).json({
        error: "rate_limit_exceeded",
        message: "You can only request one export every 24 hours",
      });
    }

    // Get locale
    const effectiveLocale = locale || (await getUserLocale(targetUserId));

    // Create export job
    const exportId = uuid();

    await query(
      `INSERT INTO molam_exports (id, user_id, requested_by, status, locale)
       VALUES ($1, $2, $3, 'queued', $4)`,
      [exportId, targetUserId, actorId, effectiveLocale]
    );

    // Audit log
    await query(
      `INSERT INTO molam_audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        actorId,
        "id.export.request",
        "export",
        exportId,
        JSON.stringify({
          export_id: exportId,
          target_user_id: targetUserId,
          locale: effectiveLocale,
        }),
        req.ip,
      ]
    );

    // Emit event for worker
    await publishDomainEvent(
      "id.export.queued",
      {
        export_id: exportId,
        user_id: targetUserId,
        locale: effectiveLocale,
      },
      { userId: actorId, requestId: req.requestId }
    );

    res.status(202).json({
      export_id: exportId,
      status: "queued",
      message: "Export job created. You will be notified when ready.",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/profile/export/:id
 * Get export job status and signed URLs
 */
router.get("/v1/profile/export/:id", authMiddleware, async (req, res, next) => {
  try {
    const actorId = req.user!.sub;
    const exportId = req.params.id;
    logRequest(req, { action: "get_export", export_id: exportId });

    // Validate UUID
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        exportId
      )
    ) {
      return res.status(400).json({
        error: "invalid_export_id",
        message: "Export ID must be a valid UUID",
      });
    }

    // Get export job
    const result = await query(
      `SELECT e.*, u.id as owner_id
       FROM molam_exports e
       JOIN molam_users u ON u.id = e.user_id
       WHERE e.id = $1`,
      [exportId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "export_not_found",
        message: "Export job not found",
      });
    }

    const job = result.rows[0];

    // Check permissions
    if (job.user_id !== actorId && !hasScope(req, "id:export:any")) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You do not have permission to view this export",
      });
    }

    // Check if URLs are expired and refresh if needed
    let jsonUrl = job.signed_json_url;
    let pdfUrl = job.signed_pdf_url;
    let expiresAt = job.expires_at;

    if (job.status === "ready" && job.expires_at) {
      const isExpired = new Date(job.expires_at) < new Date();

      if (isExpired) {
        // Regenerate signed URLs
        const { signDownloadUrl } = await import("../util/storage");
        const { nowPlusMinutes } = await import("../util/time");

        const newExpiresAt = nowPlusMinutes(15);
        jsonUrl = await signDownloadUrl(job.json_object_key, newExpiresAt);
        pdfUrl = await signDownloadUrl(job.pdf_object_key, newExpiresAt);
        expiresAt = newExpiresAt;

        // Update database
        await query(
          `UPDATE molam_exports
           SET signed_json_url = $2, signed_pdf_url = $3, expires_at = $4, updated_at = NOW()
           WHERE id = $1`,
          [exportId, jsonUrl, pdfUrl, newExpiresAt]
        );
      }
    }

    res.json({
      export_id: job.id,
      user_id: job.user_id,
      status: job.status,
      locale: job.locale,
      json_url: jsonUrl,
      pdf_url: pdfUrl,
      expires_at: expiresAt,
      created_at: job.created_at,
      updated_at: job.updated_at,
      error: job.error,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
