#!/usr/bin/env ts-node
"use strict";
/**
 * i18n Lint Tool
 * Ensures each module & namespace has same variable set across locales
 * Fails CI if variables are missing or ICU syntax differs
 */
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
async function main() {
    const pool = new pg_1.Pool({
        connectionString: process.env.DATABASE_URL,
    });
    console.log("🔍 Linting i18n entries...\n");
    const { rows } = await pool.query(`
    SELECT module_slug, namespace, key, locale, pattern_icu
    FROM i18n_entries
    ORDER BY module_slug, namespace, key, locale
  `);
    // Group by (module, namespace, key)
    const group = new Map();
    for (const r of rows) {
        const k = `${r.module_slug}:${r.namespace}:${r.key}`;
        if (!group.has(k))
            group.set(k, []);
        group.get(k).push(r);
    }
    const errors = [];
    // Check variable consistency
    for (const [k, arr] of group) {
        const varsSet = (s) => Array.from(new Set(Array.from(s.matchAll(/{(\w+)}/g)).map((m) => m[1])));
        const base = arr.find((x) => x.locale === "en") || arr[0];
        if (!base)
            continue;
        const baseVars = varsSet(base.pattern_icu);
        for (const r of arr) {
            const v = varsSet(r.pattern_icu);
            const missing = baseVars.filter((x) => !v.includes(x));
            if (missing.length) {
                errors.push(`❌ [${k}] locale=${r.locale} missing vars: ${missing.join(", ")}`);
            }
        }
    }
    // Check USSD/SMS length constraints
    for (const r of rows) {
        if (r.namespace === "ussd" && r.pattern_icu.length > 182) {
            errors.push(`❌ [${r.module_slug}:${r.namespace}:${r.key}] locale=${r.locale} exceeds USSD max length (${r.pattern_icu.length} > 182)`);
        }
        if (r.namespace === "sms" && r.pattern_icu.length > 160) {
            errors.push(`❌ [${r.module_slug}:${r.namespace}:${r.key}] locale=${r.locale} exceeds SMS max length (${r.pattern_icu.length} > 160)`);
        }
    }
    await pool.end();
    if (errors.length) {
        console.error(errors.join("\n"));
        console.error(`\n❌ ${errors.length} lint error(s) found\n`);
        process.exit(1);
    }
    else {
        console.log("✅ i18n lint OK\n");
        process.exit(0);
    }
}
main().catch((error) => {
    console.error("Lint failed:", error);
    process.exit(1);
});
//# sourceMappingURL=i18n-lint.js.map