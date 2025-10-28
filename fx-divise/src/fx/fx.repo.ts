import { Pool } from "pg";
import { v4 as uuid } from "uuid";

export class FxRepo {
    constructor(private pool: Pool) { }

    async upsertRates(batchId: string, rows: { base: string; quote: string; rate: number; asof: Date; source_slug: string; quality: number }[]) {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            for (const r of rows) {
                await client.query(`
          INSERT INTO fx_rates (id, base, quote, rate, asof, source_slug, quality, ingest_batch_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (base,quote,asof,source_slug) DO NOTHING
        `, [uuid(), r.base, r.quote, r.rate, r.asof, r.source_slug, r.quality, batchId]);
            }
            await client.query("REFRESH MATERIALIZED VIEW CONCURRENTLY fx_best_rates");
            await client.query("COMMIT");
        } catch (e) {
            await client.query("ROLLBACK"); throw e;
        } finally {
            client.release();
        }
    }
}