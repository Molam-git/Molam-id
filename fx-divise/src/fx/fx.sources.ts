export interface RawRate {
    base: string;
    quote: string;
    rate: number;
    asof: Date;
    source: string;
    quality: number;
}

export interface FxProvider {
    slug: string;
    fetchLatest(pairs: Array<[string, string]>): Promise<RawRate[]>;
}

export class EcbProvider implements FxProvider {
    slug = "ecb";

    async fetchLatest(pairs: [string, string][]): Promise<RawRate[]> {
        const results: RawRate[] = [];

        for (const [base, quote] of pairs) {
            if (base === 'EUR' || quote === 'EUR') {
                results.push({
                    base,
                    quote,
                    rate: base === 'EUR' ? 655.957 : 1 / 655.957,
                    asof: new Date(),
                    source: this.slug,
                    quality: 85
                });
            }
        }

        return results;
    }
}

export class BCEAOProvider implements FxProvider {
    slug = "cb_sn";

    async fetchLatest(pairs: [string, string][]): Promise<RawRate[]> {
        const results: RawRate[] = [];

        for (const [base, quote] of pairs) {
            if (base === 'XOF' || quote === 'XOF') {
                results.push({
                    base,
                    quote,
                    rate: base === 'XOF' ? 0.001524 : 655.957,
                    asof: new Date(),
                    source: this.slug,
                    quality: 95
                });
            }
        }

        return results;
    }
}