// Brique 15: i18n - Service avec fallback hiérarchique

import { Pool } from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createHash, sign } from "crypto";
import { v4 as uuid } from "uuid";
import { config, ChannelType } from "./config";

export interface ResolveOpts {
  module: string;
  namespace?: string;
  key?: string;
  localesChain: string[];     // e.g. ["fr-SN","fr","en"]
  channel?: ChannelType;
}

export interface I18nEntry {
  id: string;
  module_slug: string;
  namespace: string;
  key: string;
  locale: string;
  pattern_icu: string;
  metadata?: Record<string, any>;
  hash_sha256: string;
  version: number;
}

export interface BundleResult {
  id: string;
  eTag: string;
  key: string;
  signature?: string;
}

export class I18nService {
  constructor(
    private pool: Pool,
    private s3: S3Client
  ) {}

  /**
   * Resolve translations with fallback chain
   * Priority: user.preference → module.default → Accept-Language → country.default → app.default (en)
   */
  async resolve(opts: ResolveOpts): Promise<Record<string, string>> {
    const { module, namespace, key, localesChain, channel } = opts;

    // Build query
    const params: any[] = [module, localesChain];
    let where = `module_slug = $1 AND locale = ANY($2)`;

    if (namespace) {
      params.push(namespace);
      where += ` AND namespace = $${params.length}`;
    }

    if (key) {
      params.push(key);
      where += ` AND key = $${params.length}`;
    }

    if (channel) {
      params.push(channel);
      where += ` AND (metadata IS NULL OR metadata->'channel' IS NULL OR $${params.length} = ANY(SELECT jsonb_array_elements_text(metadata->'channel')))`;
    }

    const sql = `
      SELECT namespace, key, locale, pattern_icu
      FROM i18n_entries
      WHERE ${where}
    `;

    const { rows } = await this.pool.query(sql, params);

    // Apply fallback: base first (en) then overwrite with specific (fr, fr-SN)
    const order = [...localesChain].reverse();
    const bag: Record<string, Record<string, string>> = {};

    for (const loc of order) {
      for (const r of rows.filter((x: any) => x.locale === loc)) {
        const fqk = `${r.namespace}.${r.key}`;
        bag[fqk] = bag[fqk] || {};
        bag[fqk][loc] = r.pattern_icu;
      }
    }

    // Flatten choosing the first available in original localesChain
    const out: Record<string, string> = {};
    for (const fqk of Object.keys(bag)) {
      for (const loc of localesChain) {
        if (bag[fqk][loc]) {
          out[fqk] = bag[fqk][loc];
          break;
        }
      }
    }

    return out;
  }

  /**
   * Get locale fallback chain (fr-SN → fr → en)
   */
  getFallbackChain(locale: string): string[] {
    const chain: string[] = [locale];

    // If locale with region (fr-SN), add base (fr)
    if (locale.includes("-")) {
      const base = locale.split("-")[0];
      chain.push(base);
    }

    // Always add 'en' as final fallback
    if (locale !== "en") {
      chain.push("en");
    }

    return chain;
  }

  /**
   * Upsert entry
   */
  async upsertEntry(entry: Partial<I18nEntry>, userId?: string): Promise<string> {
    const id = entry.id || uuid();
    const hash = createHash("sha256")
      .update(entry.pattern_icu || "")
      .digest("hex");

    const { rows } = await this.pool.query(
      `INSERT INTO i18n_entries
       (id, module_slug, namespace, key, locale, pattern_icu, metadata, hash_sha256, version, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9)
       ON CONFLICT (module_slug, namespace, key, locale)
       DO UPDATE SET
         pattern_icu = EXCLUDED.pattern_icu,
         metadata = EXCLUDED.metadata,
         hash_sha256 = EXCLUDED.hash_sha256,
         version = i18n_entries.version + 1,
         updated_at = NOW()
       RETURNING id, version`,
      [
        id,
        entry.module_slug,
        entry.namespace,
        entry.key,
        entry.locale,
        entry.pattern_icu,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        hash,
        userId || null,
      ]
    );

    // Audit
    await this.audit({
      module_slug: entry.module_slug!,
      actor_id: userId,
      action: rows[0].version === 1 ? "entry.create" : "entry.update",
      details: {
        namespace: entry.namespace,
        key: entry.key,
        locale: entry.locale,
      },
    });

    return rows[0].id;
  }

  /**
   * Create release
   */
  async createRelease(
    moduleSlug: string,
    tag: string,
    locales: string[],
    notes?: string,
    userId?: string
  ): Promise<string> {
    const id = uuid();

    await this.pool.query(
      `INSERT INTO i18n_releases
       (id, module_slug, tag, locales, status, notes, created_by)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6)`,
      [id, moduleSlug, tag, locales, notes || null, userId || null]
    );

    // Audit
    await this.audit({
      module_slug: moduleSlug,
      actor_id: userId,
      action: "release.create",
      details: { tag, locales },
    });

    return id;
  }

  /**
   * Build bundle for a module + locale
   */
  async buildBundle(
    moduleSlug: string,
    locale: string,
    releaseId: string
  ): Promise<BundleResult> {
    // Fetch all entries for this module + locale
    const { rows } = await this.pool.query(
      `SELECT namespace, key, pattern_icu
       FROM i18n_entries
       WHERE module_slug = $1 AND locale = $2`,
      [moduleSlug, locale]
    );

    // Flatten to { "namespace.key": "pattern" }
    const flat: Record<string, string> = {};
    for (const r of rows) {
      flat[`${r.namespace}.${r.key}`] = r.pattern_icu;
    }

    const payload = JSON.stringify(flat, null, 2);
    const eTag = createHash("sha256").update(payload).digest("hex");

    // Sign with Ed25519 (if enabled)
    let signature: Buffer | null = null;
    if (config.signature.enabled && config.signature.privateKey) {
      signature = sign(
        null,
        Buffer.from(eTag, "hex"),
        Buffer.from(config.signature.privateKey, "hex")
      );
    }

    // Upload to S3
    let s3Key: string | null = null;
    if (config.s3.enabled) {
      s3Key = `i18n/${moduleSlug}/${releaseId}/${locale}.json`;

      await this.s3.send(
        new PutObjectCommand({
          Bucket: config.s3.bucket,
          Key: s3Key,
          Body: payload,
          ContentType: "application/json",
          ChecksumSHA256: Buffer.from(eTag, "hex").toString("base64"),
          ServerSideEncryption: "aws:kms",
          SSEKMSKeyId: config.s3.kmsKeyId || undefined,
          Metadata: {
            module: moduleSlug,
            locale,
            release_id: releaseId,
            etag: eTag,
          },
        })
      );

      // Upload signature if available
      if (signature) {
        await this.s3.send(
          new PutObjectCommand({
            Bucket: config.s3.bucket,
            Key: `${s3Key}.sig`,
            Body: signature,
            ContentType: "application/octet-stream",
          })
        );
      }
    }

    // Store bundle in DB
    const bundleId = uuid();
    await this.pool.query(
      `INSERT INTO i18n_bundles
       (id, release_id, locale, json_payload, e_tag, signature, s3_key, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        bundleId,
        releaseId,
        locale,
        flat,
        eTag,
        signature || null,
        s3Key,
      ]
    );

    return {
      id: bundleId,
      eTag,
      key: s3Key!,
      signature: signature?.toString("hex"),
    };
  }

  /**
   * Publish release (build all bundles)
   */
  async publishRelease(releaseId: string, userId?: string): Promise<BundleResult[]> {
    // Get release info
    const { rows } = await this.pool.query(
      `SELECT module_slug, locales, tag FROM i18n_releases WHERE id = $1`,
      [releaseId]
    );

    if (rows.length === 0) {
      throw new Error("Release not found");
    }

    const { module_slug, locales, tag } = rows[0];

    // Build bundles for each locale
    const results: BundleResult[] = [];
    for (const locale of locales as string[]) {
      const result = await this.buildBundle(module_slug, locale, releaseId);
      results.push(result);
    }

    // Update release status
    await this.pool.query(
      `UPDATE i18n_releases
       SET status = 'published', updated_at = NOW()
       WHERE id = $1`,
      [releaseId]
    );

    // Audit
    await this.audit({
      module_slug,
      actor_id: userId,
      action: "release.publish",
      details: { release_id: releaseId, tag, locales },
    });

    return results;
  }

  /**
   * Get missing keys for a locale
   */
  async getMissingKeys(moduleSlug: string, locale: string): Promise<any[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM count_missing_keys($1, $2)`,
      [moduleSlug, locale]
    );
    return rows;
  }

  /**
   * Audit log
   */
  private async audit(event: {
    module_slug: string;
    actor_id?: string;
    action: string;
    details?: any;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO i18n_audit (id, module_slug, actor_id, action, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        uuid(),
        event.module_slug,
        event.actor_id || null,
        event.action,
        event.details ? JSON.stringify(event.details) : null,
      ]
    );
  }

  /**
   * Get statistics
   */
  async getStats(moduleSlug?: string): Promise<any> {
    const whereCl = moduleSlug ? `WHERE module_slug = $1` : "";
    const params = moduleSlug ? [moduleSlug] : [];

    const { rows } = await this.pool.query(
      `SELECT
         COUNT(*) as total_entries,
         COUNT(DISTINCT locale) as total_locales,
         COUNT(DISTINCT module_slug) as total_modules,
         COUNT(DISTINCT namespace) as total_namespaces
       FROM i18n_entries ${whereCl}`,
      params
    );

    return rows[0];
  }
}
