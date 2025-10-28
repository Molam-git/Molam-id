import { FxRepo } from "./fx.repo";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { EcbProvider, BCEAOProvider, FxProvider, RawRate } from "./fx.sources";

export async function ingestFx(pool: Pool, pairs: [string, string][]): Promise<void> {
    const repo = new FxRepo(pool);
    const batchId = uuid();
    const providers: FxProvider[] = [
        new BCEAOProvider(),
        new EcbProvider(),
    ];

    // Correction des types pour Promise.all
    const providerPromises: Promise<RawRate[]>[] = providers.map(p =>
        p.fetchLatest(pairs).catch((error: Error) => {
            console.error(`Provider ${p.slug} failed:`, error);
            return [] as RawRate[];
        })
    );

    const resultsArrays: RawRate[][] = await Promise.all(providerPromises);

    // Utilisation de reduce au lieu de flat() pour meilleur typage
    const results: RawRate[] = resultsArrays.reduce<RawRate[]>((acc, curr) => {
        return acc.concat(curr);
    }, []);

    const grouped = new Map<string, number[]>();

    for (const r of results) {
        const k = `${r.base}/${r.quote}`;
        const existing = grouped.get(k);
        if (existing) {
            existing.push(r.rate);
        } else {
            grouped.set(k, [r.rate]);
        }
    }

    const filtered = results.filter(r => {
        const arr = grouped.get(`${r.base}/${r.quote}`);
        if (!arr || arr.length === 0) return false;

        // Correction: copie explicite du tableau pour le tri
        const sorted = arr.slice().sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        return Math.abs((r.rate - median) / median) < 0.1;
    });

    await repo.upsertRates(
        batchId,
        filtered.map(r => ({
            base: r.base,
            quote: r.quote,
            rate: r.rate,
            asof: r.asof,
            source_slug: r.source,
            quality: r.quality
        }))
    );
}