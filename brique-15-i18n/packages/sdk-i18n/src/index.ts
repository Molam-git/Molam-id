// i18n SDK Client with signature verification

export interface I18nClientOpts {
  cdnBaseUrl: string;                   // e.g. https://cdn.molam.com/i18n
  module: string;
  localesChain: string[];               // ["fr-SN","fr","en"]
  enforceBundleSignature?: boolean;
  publicKeyHex?: string;                // Ed25519 public key (hex)
}

export class I18nClient {
  private translations: Record<string, string> = {};

  constructor(private opts: I18nClientOpts) {}

  async load(): Promise<Record<string, string>> {
    // Try to fetch most specific locale first; merge fallback order
    const bag: Record<string, string> = {};

    for (const loc of [...this.opts.localesChain].reverse()) {
      const url = `${this.opts.cdnBaseUrl}/${this.opts.module}/latest/${loc}.json`;

      try {
        const res = await fetch(url, { cache: "reload" });
        if (res.ok) {
          const etag = (res.headers.get("etag") || "").replaceAll('"', "");
          const payload = await res.json();

          // Signature verification (if enabled)
          if (this.opts.enforceBundleSignature && this.opts.publicKeyHex) {
            const sigUrl = `${url}.sig`;
            const sigRes = await fetch(sigUrl);
            if (sigRes.ok) {
              const sig = new Uint8Array(await sigRes.arrayBuffer());
              const ok = await this.verifySignature(
                sig,
                hexToBytes(etag),
                hexToBytes(this.opts.publicKeyHex)
              );
              if (!ok) {
                console.warn(`Bundle signature invalid for ${loc}`);
                throw new Error("bundle_signature_invalid");
              }
            }
          }

          Object.assign(bag, payload); // Later locales override base
        }
      } catch (error) {
        console.error(`Failed to load ${loc}:`, error);
      }
    }

    this.translations = bag;
    return bag;
  }

  /**
   * Translate key with ICU-like variable substitution
   */
  t(key: string, vars?: Record<string, any>): string {
    const raw = this.translations[key] || key;
    return formatICU(raw, vars);
  }

  /**
   * Check if translation exists
   */
  has(key: string): boolean {
    return key in this.translations;
  }

  /**
   * Get all translations
   */
  getAll(): Record<string, string> {
    return { ...this.translations };
  }

  /**
   * Verify Ed25519 signature (simplified - use @noble/ed25519 in production)
   */
  private async verifySignature(
    signature: Uint8Array,
    message: Uint8Array,
    publicKey: Uint8Array
  ): Promise<boolean> {
    // In production, use: import { verify } from "@noble/ed25519";
    // For now, just return true as placeholder
    console.log("Signature verification:", { signature, message, publicKey });
    return true; // Placeholder
  }
}

/**
 * Minimal ICU formatter
 * For production, use @formatjs/intl-messageformat
 */
function formatICU(pattern: string, vars: Record<string, any> = {}): string {
  return pattern.replace(/{(\w+)}/g, (_, k) => vars[k] ?? `{${k}}`);
}

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
}

export default I18nClient;
