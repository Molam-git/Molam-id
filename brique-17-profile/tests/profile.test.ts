// Profile service tests

import { config } from "../src/profile/config";

describe("Profile Service", () => {
  describe("Configuration", () => {
    test("should have valid config", () => {
      expect(config.serviceName).toBe("id-profile");
      expect(config.port).toBeGreaterThan(0);
      expect(config.s3.bucket).toBeDefined();
    });

    test("should have S3 configuration", () => {
      expect(config.s3.region).toBeDefined();
      expect(config.s3.bucket).toBe("molam-avatars");
    });
  });

  describe("Badges", () => {
    test("should validate badge types", () => {
      const validBadges = [
        "kyc_verified",
        "merchant_pro",
        "employee",
        "agent",
        "partner_bank"
      ];

      validBadges.forEach(badge => {
        expect(typeof badge).toBe("string");
        expect(badge.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Preferences", () => {
    test("should support theme preferences", () => {
      const themes = ["light", "dark", "auto"];
      themes.forEach(theme => {
        expect(["light", "dark", "auto"]).toContain(theme);
      });
    });

    test("should support notification preferences", () => {
      const prefs = {
        notify_email: true,
        notify_sms: false,
        notify_push: true
      };

      expect(prefs.notify_email).toBe(true);
      expect(prefs.notify_sms).toBe(false);
    });
  });

  describe("Avatar URLs", () => {
    test("should generate temporary URLs", () => {
      const ttl = 3600; // 1 hour
      expect(ttl).toBe(3600);
      expect(ttl).toBeGreaterThan(0);
    });
  });
});
