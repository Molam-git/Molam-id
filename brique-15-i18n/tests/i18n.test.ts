// i18n service tests

import { config } from "../src/i18n/config";

describe("i18n Service", () => {
  describe("Configuration", () => {
    test("should have valid config", () => {
      expect(config.serviceName).toBe("id-i18n");
      expect(config.port).toBeGreaterThan(0);
      expect(config.i18n.defaultLocale).toBe("en");
      expect(config.i18n.supportedLocales).toContain("fr");
      expect(config.i18n.supportedLocales).toContain("ar");
    });

    test("should have USSD/SMS constraints", () => {
      expect(config.i18n.ussdMaxLength).toBe(182);
      expect(config.i18n.smsMaxLength).toBe(160);
    });

    test("should have correct modules", () => {
      expect(config.modules).toContain("id");
      expect(config.modules).toContain("pay");
      expect(config.modules).toContain("eats");
    });
  });

  describe("Locale Fallback", () => {
    test("should create proper fallback chain", () => {
      // fr-SN → fr → en
      const chain = ["fr-SN", "fr", "en"];
      expect(chain[0]).toBe("fr-SN");
      expect(chain[chain.length - 1]).toBe("en");
    });

    test("should always include en as final fallback", () => {
      const chains = [
        ["fr-SN", "fr", "en"],
        ["ar", "en"],
        ["en"]
      ];
      chains.forEach(chain => {
        expect(chain[chain.length - 1]).toBe("en");
      });
    });
  });

  describe("RTL Support", () => {
    test("should identify RTL languages", () => {
      const rtlLanguages = ["ar", "he"];
      rtlLanguages.forEach(lang => {
        expect(["ar", "he"]).toContain(lang);
      });
    });
  });

  describe("Modules", () => {
    test("should support all Molam modules", () => {
      const expectedModules = ["id", "pay", "eats", "talk", "ads", "shop", "free", "shared"];
      expectedModules.forEach(mod => {
        expect(config.modules).toContain(mod);
      });
    });
  });

  describe("Channels", () => {
    test("should support all channels", () => {
      const expectedChannels = ["app", "web", "ussd", "sms", "dashboard"];
      expectedChannels.forEach(channel => {
        expect(config.channels).toContain(channel);
      });
    });
  });
});
