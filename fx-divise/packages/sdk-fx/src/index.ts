export interface FxClientOpts {
    baseUrl: string;
    serviceToken: string;
    module: string;
}

export class FxClient {
    constructor(private opts: FxClientOpts) { }

    async convert(from: string, to: string, amount: number, country?: string, mode: "pricing" | "cash" = "pricing") {
        const u = new URL(this.opts.baseUrl + "/api/fx/convert");
        u.searchParams.set("from", from);
        u.searchParams.set("to", to);
        u.searchParams.set("amount", String(amount));
        u.searchParams.set("module", this.opts.module);
        u.searchParams.set("mode", mode);
        if (country) u.searchParams.set("country", country);
        const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${this.opts.serviceToken}` } });
        if (!res.ok) throw new Error("fx_convert_failed");
        return res.json();
    }

    format(amount: number, currency: string, locale: string) {
        return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
    }
}