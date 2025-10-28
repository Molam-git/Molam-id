import { Pool } from "pg";
import { createHash } from "crypto";

export interface ConvertOpts {
    from: string; to: string;
    amount: string | number;
    countryCode?: string;
    preferSource?: string;
    pivot?: "USD" | "EUR" | null;
    moduleSlug: string;
    userId?: string | null;
    requestId?: string | null;
    mode?: "pricing" | "cash";
}

export class FxService {
    constructor(private pool: Pool) { }

    private async bestRate(base: string, quote: string, preferSource?: string) {
        const direct = await this.pool.query(
            `SELECT * FROM fx_best_rates WHERE base=$1 AND quote=$2 ORDER BY asof DESC LIMIT 1`, [base, quote]
        );
        if (direct.rowCount && (!preferSource || direct.rows[0].source_slug === preferSource)) {
            return { rate: Number(direct.rows[0].rate), asof: direct.rows[0].asof, source: direct.rows[0].source_slug, path: "direct" };
        }
        for (const pivot of ["USD", "EUR"]) {
            const a = await this.pool.query(`SELECT rate,asof,source_slug FROM fx_best_rates WHERE base=$1 AND quote=$2 ORDER BY asof DESC LIMIT 1`, [base, pivot]);
            const b = await this.pool.query(`SELECT rate,asof,source_slug FROM fx_best_rates WHERE base=$1 AND quote=$2 ORDER BY asof DESC LIMIT 1`, [pivot, quote]);
            if (a.rowCount && b.rowCount) {
                const rate = Number(a.rows[0].rate) * Number(b.rows[0].rate);
                const asof = a.rows[0].asof > b.rows[0].asof ? a.rows[0].asof : b.rows[0].asof;
                const src = `${a.rows[0].source_slug}+${b.rows[0].source_slug}`;
                return { rate, asof, source: src, path: `${pivot} pivot` };
            }
        }
        throw new Error("rate_unavailable");
    }

    private async rounding(currency: string, country?: string | null, mode: "pricing" | "cash" = "pricing") {
        const base = await this.pool.query(`SELECT minor_unit, cash_rounding, cash_rule FROM fx_currencies WHERE code=$1`, [currency]);
        if (!base.rowCount) throw new Error("currency_unknown");
        let { minor_unit, cash_rounding, cash_rule } = base.rows[0];
        if (country) {
            const cr = await this.pool.query(`SELECT cash_rounding, cash_rule, status FROM fx_country_rules WHERE country_code=$1 AND currency_code=$2`, [country, currency]);
            if (cr.rowCount && cr.rows[0].status === 'active') {
                cash_rounding = cr.rows[0].cash_rounding ?? cash_rounding;
                cash_rule = cr.rows[0].cash_rule ?? cash_rule;
            }
        }
        const decimals = Number(minor_unit);
        const cashStep = (mode === "cash" && cash_rounding) ? Number(cash_rounding) : null;
        return (x: number) => {
            const d = Math.pow(10, decimals);
            let y = Math.round(x * d) / d;
            if (cashStep) {
                const k = Math.round(y / cashStep);
                if (cash_rule === 'up') y = Math.ceil(y / cashStep) * cashStep;
                else if (cash_rule === 'down') y = Math.floor(y / cashStep) * cashStep;
                else y = k * cashStep;
                y = Math.round(y * d) / d;
            }
            return y;
        };
    }

    async convert(opts: ConvertOpts) {
        const { from, to, amount, countryCode, preferSource, moduleSlug, userId = null, requestId = null, mode = "pricing" } = opts;
        if (from === to) {
            return { amount_in: Number(amount), amount_out: Number(amount), rate: 1, asof: new Date(), path: "identity", source: "identity" };
        }
        const { rate, asof, source, path } = await this.bestRate(from, to, preferSource);
        const roundFn = await this.rounding(to, countryCode, mode);
        const raw = Number(amount) * rate;
        const out = roundFn(raw);

        const proofHash = createHash("sha256")
            .update([requestId || '', userId || '', moduleSlug, from, to, String(amount), String(out), String(rate), asof.toISOString(), path, source].join("|"))
            .digest("hex");

        await this.pool.query(`
      INSERT INTO fx_convert_audit (id, request_id, user_id, module_slug, from_ccy, to_ccy, amount_in, amount_out, rate_used, rate_asof, path, source_slug, country_code, rounding_rule, proof_hash)
      VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    `, [opts.requestId || null, opts.userId || null, moduleSlug, from, to, amount, out, rate, asof, path, source, countryCode || null,
        { mode, to_currency: to }, proofHash]);

        return { amount_in: Number(amount), amount_out: out, rate, asof, path, source, proof_hash: proofHash };
    }
}