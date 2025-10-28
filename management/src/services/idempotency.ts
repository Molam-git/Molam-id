import { pool } from '../repo';
import crypto from 'crypto';

export async function withIdempotency(key: string, reqBody: any, fn: () => Promise<{ code: number, body: any }>) {
    const hash = crypto.createHash('sha256').update(JSON.stringify(reqBody)).digest('hex');
    const existing = await pool.query(`SELECT response_code, response_body FROM molam_idempotency_keys WHERE key=$1 AND request_hash=$2`, [key, hash]);
    if (existing.rows[0]) {
        return { code: existing.rows[0].response_code, body: existing.rows[0].response_body };
    }
    const result = await fn();
    await pool.query(
        `INSERT INTO molam_idempotency_keys(key,request_hash,response_code,response_body)
     VALUES ($1,$2,$3,$4) ON CONFLICT (key) DO NOTHING`,
        [key, hash, result.code, result.body]
    );
    return result;
}