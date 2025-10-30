// Brique 15: i18n - API Routes

import { Router, Request, Response, NextFunction } from "express";
import { I18nService } from "./i18n.service";
import { pool } from "../util/pg";
import { S3Client } from "@aws-sdk/client-s3";
import { requireRole, authRequired } from "../util/auth";
import { AppError } from "../util/errors";
import { config } from "./config";
import { getCached, setCached } from "../util/redis";

const router = Router();
const i18n = new I18nService(
  pool,
  new S3Client({ region: config.s3.region })
);

/**
 * Locale negotiation helper
 * Priority: user.preference → module.default → Accept-Language → country.default → app.default (en)
 */
function negotiateLocales(
  req: Request,
  moduleDefault: string = "en"
): string[] {
  const userPref = (req as any).user?.locale;
  const accept = req.headers["accept-language"]?.toString() || "";
  const parsed = accept
    .split(",")
    .map((x: string) => x.trim().split(";")[0])
    .filter(Boolean);
  const country = req.headers["x-geo-country"] as string; // from edge/geo service

  const chain: string[] = [];

  // 1. User preference
  if (userPref) chain.push(userPref);

  // 2. User pref + country (fr + SN = fr-SN)
  if (country && userPref && !userPref.includes(country)) {
    const base = userPref.split("-")[0];
    chain.push(`${base}-${country}`);
  }

  // 3. Module default
  chain.push(moduleDefault);

  // 4. Accept-Language
  chain.push(...parsed);

  // 5. App default (en)
  chain.push("en");

  // Normalize, unique while preserving order
  return [...new Set(chain)];
}

/**
 * GET /v1/i18n/resolve - Resolve translations with fallback
 * Query params: module, namespace, key, default, channel
 */
router.get(
  "/resolve",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const moduleSlug = (req.query.module as string) || "shared";
      const namespace = req.query.namespace as string;
      const key = req.query.key as string;
      const moduleDefault = (req.query.default as string) || "en";
      const channel = req.query.channel as any;

      const localesChain = negotiateLocales(req, moduleDefault);

      // Check cache
      const cacheKey = `resolve:${moduleSlug}:${namespace}:${key}:${localesChain.join(",")}:${channel}`;
      const cached = await getCached<any>(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      const items = await i18n.resolve({
        module: moduleSlug,
        namespace,
        key,
        localesChain,
        channel,
      });

      const response = { localesChain, items };

      // Cache for 1 hour
      await setCached(cacheKey, response, config.redis.ttl);

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /v1/i18n/entries - Upsert entry (editor only)
 * Body: { module_slug, namespace, key, locale, pattern_icu, metadata }
 */
router.post(
  "/entries",
  authRequired,
  requireRole(config.allowedRoles.editor),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        module_slug,
        namespace,
        key,
        locale,
        pattern_icu,
        metadata,
      } = req.body;

      if (!module_slug || !namespace || !key || !locale || !pattern_icu) {
        throw new AppError(
          400,
          "bad_request",
          "module_slug, namespace, key, locale, and pattern_icu are required"
        );
      }

      const id = await i18n.upsertEntry(
        {
          module_slug,
          namespace,
          key,
          locale,
          pattern_icu,
          metadata,
        },
        (req as any).user?.userId
      );

      res.status(201).json({ id });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /v1/i18n/entries - List entries
 * Query params: module, locale, namespace
 */
router.get(
  "/entries",
  authRequired,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { module, locale, namespace } = req.query;

      const params: any[] = [];
      const where: string[] = [];

      if (module) {
        params.push(module);
        where.push(`module_slug = $${params.length}`);
      }

      if (locale) {
        params.push(locale);
        where.push(`locale = $${params.length}`);
      }

      if (namespace) {
        params.push(namespace);
        where.push(`namespace = $${params.length}`);
      }

      const sql = `
        SELECT id, module_slug, namespace, key, locale, pattern_icu, metadata, version, created_at, updated_at
        FROM i18n_entries
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY module_slug, namespace, key, locale
        LIMIT 500
      `;

      const { rows } = await pool.query(sql, params);

      res.json({ items: rows, count: rows.length });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /v1/i18n/releases - Create release (reviewer required)
 * Body: { module_slug, tag, locales, notes }
 */
router.post(
  "/releases",
  authRequired,
  requireRole(config.allowedRoles.reviewer),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { module_slug, tag, locales, notes } = req.body;

      if (!module_slug || !tag || !locales || !Array.isArray(locales)) {
        throw new AppError(
          400,
          "bad_request",
          "module_slug, tag, and locales (array) are required"
        );
      }

      const id = await i18n.createRelease(
        module_slug,
        tag,
        locales,
        notes,
        (req as any).user?.userId
      );

      res.status(201).json({ id });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /v1/i18n/releases - List releases
 * Query params: module, status
 */
router.get(
  "/releases",
  authRequired,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { module, status } = req.query;

      const params: any[] = [];
      const where: string[] = [];

      if (module) {
        params.push(module);
        where.push(`module_slug = $${params.length}`);
      }

      if (status) {
        params.push(status);
        where.push(`status = $${params.length}`);
      }

      const sql = `
        SELECT id, module_slug, tag, status, locales, version_seq, notes, created_at, updated_at
        FROM i18n_releases
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY created_at DESC
        LIMIT 100
      `;

      const { rows } = await pool.query(sql, params);

      res.json({ items: rows, count: rows.length });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /v1/i18n/releases/:id/publish - Publish release
 * Builds and uploads bundles to S3
 */
router.post(
  "/releases/:id/publish",
  authRequired,
  requireRole(config.allowedRoles.reviewer),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const releaseId = req.params.id;

      const results = await i18n.publishRelease(
        releaseId,
        (req as any).user?.userId
      );

      res.json({
        release_id: releaseId,
        published: results,
        count: results.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /v1/i18n/missing-keys - Get missing translations
 * Query params: module (required), locale (required)
 */
router.get(
  "/missing-keys",
  authRequired,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { module, locale } = req.query;

      if (!module || !locale) {
        throw new AppError(400, "bad_request", "module and locale are required");
      }

      const missing = await i18n.getMissingKeys(
        module as string,
        locale as string
      );

      res.json({ module, locale, missing });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /v1/i18n/stats - Get statistics
 * Query params: module (optional)
 */
router.get(
  "/stats",
  authRequired,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { module } = req.query;

      const stats = await i18n.getStats(module as string);

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /v1/i18n/locales - Get supported locales
 */
router.get(
  "/locales",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT code, name, is_rtl, enabled FROM i18n_locales WHERE enabled = true ORDER BY code`
      );

      res.json({ locales: rows });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /v1/i18n/modules - Get modules
 */
router.get(
  "/modules",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT slug, display_name, default_locale FROM i18n_modules ORDER BY slug`
      );

      res.json({ modules: rows });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
