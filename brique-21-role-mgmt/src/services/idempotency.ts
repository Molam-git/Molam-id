/**
 * Molam ID - Idempotency Service
 * Ensures exactly-once semantics for role management operations
 */
import { query } from '../repo';
import crypto from 'crypto';

export interface IdempotencyResult<T = any> {
  code: number;
  body: T;
  cached?: boolean;
}

/**
 * Execute a function with idempotency guarantee
 * If the same key + request hash exists, returns cached response
 * Otherwise, executes the function and caches the result
 */
export async function withIdempotency<T = any>(
  key: string,
  reqBody: any,
  fn: () => Promise<IdempotencyResult<T>>
): Promise<IdempotencyResult<T>> {
  // Hash the request body to detect if request changed
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(reqBody))
    .digest('hex');

  // Check if we've seen this exact request before
  const existing = await query(
    `SELECT response_code, response_body
     FROM molam_idempotency_keys
     WHERE key = $1 AND request_hash = $2
       AND expires_at > NOW()`,
    [key, hash]
  );

  if (existing.rows.length > 0) {
    // Found cached response - return it
    return {
      code: existing.rows[0].response_code,
      body: existing.rows[0].response_body,
      cached: true,
    };
  }

  // Not found - execute the function
  const result = await fn();

  // Cache the result (best-effort, don't fail if caching fails)
  try {
    await query(
      `INSERT INTO molam_idempotency_keys (key, request_hash, response_code, response_body)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET
         request_hash = EXCLUDED.request_hash,
         response_code = EXCLUDED.response_code,
         response_body = EXCLUDED.response_body,
         created_at = NOW(),
         expires_at = NOW() + INTERVAL '24 hours'`,
      [key, hash, result.code, result.body]
    );
  } catch (err) {
    console.error('Failed to cache idempotency key:', err);
    // Don't throw - the operation succeeded, caching is secondary
  }

  return { ...result, cached: false };
}

/**
 * Check if an idempotency key exists
 */
export async function checkIdempotencyKey(
  key: string,
  requestHash: string
): Promise<{ exists: boolean; response?: any }> {
  const { rows } = await query(
    `SELECT response_code, response_body
     FROM molam_idempotency_keys
     WHERE key = $1 AND request_hash = $2
       AND expires_at > NOW()`,
    [key, requestHash]
  );

  if (rows.length > 0) {
    return {
      exists: true,
      response: {
        code: rows[0].response_code,
        body: rows[0].response_body,
      },
    };
  }

  return { exists: false };
}

/**
 * Cleanup expired idempotency keys (call from cron job)
 */
export async function cleanupExpiredKeys(): Promise<number> {
  const { rows } = await query(
    `SELECT cleanup_expired_idempotency_keys() AS deleted_count`
  );
  return rows[0]?.deleted_count ?? 0;
}
