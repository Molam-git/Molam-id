// tests/biometrics.test.ts
import request from "supertest";
import { pool } from "../src/util/pg";
import { redis } from "../src/util/redis";
import jwt from "jsonwebtoken";

// Mock app (import your actual app in production)
const app = {} as any; // Replace with actual app import

describe("Biometrics API", () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Connect to test database and Redis
    await pool.connect();
    await redis.connect();

    // Create test user
    const { rows } = await pool.query(
      "INSERT INTO molam_users (id, molam_id, email, password_hash, country_code, currency) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      ["test-user-id", "test-user", "test@molam.com", "hash", "SN", "XOF"]
    );
    userId = rows[0].id;

    // Generate test JWT
    authToken = jwt.sign(
      { sub: userId, roles: ["customer"], country: "SN", currency: "XOF" },
      process.env.JWT_PRIVATE_KEY!,
      { algorithm: "RS256", audience: "molam.id", issuer: "https://id.molam.com" }
    );
  });

  afterAll(async () => {
    // Cleanup
    await pool.query("DELETE FROM molam_users WHERE id = $1", [userId]);
    await pool.end();
    await redis.quit();
  });

  describe("Health check", () => {
    it("should return ok status", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
    });
  });

  describe("Enrollment flow", () => {
    it("should begin enrollment", async () => {
      const response = await request(app)
        .post("/v1/biometrics/enroll/begin")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ platform: "web" });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("options");
      expect(response.body).toHaveProperty("deviceId");
      expect(response.body.options).toHaveProperty("challenge");
    });

    it("should reject enrollment without auth", async () => {
      const response = await request(app)
        .post("/v1/biometrics/enroll/begin")
        .send({ platform: "web" });

      expect(response.status).toBe(401);
    });

    it("should reject enrollment with invalid platform", async () => {
      const response = await request(app)
        .post("/v1/biometrics/enroll/begin")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ platform: "invalid" });

      expect(response.status).toBe(400);
    });

    // Note: Full enrollment finish test requires real WebAuthn credential
    // which cannot be simulated in unit tests. Use E2E tests with real browsers.
  });

  describe("Assertion flow", () => {
    it("should fail to begin assertion without credentials", async () => {
      const response = await request(app)
        .post("/v1/biometrics/assert/begin")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("no_credentials");
    });
  });

  describe("Preferences", () => {
    it("should get user preferences", async () => {
      const response = await request(app)
        .get("/v1/biometrics/prefs")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("biometrics_enabled");
      expect(response.body).toHaveProperty("require_biometric_for_sensitive");
      expect(response.body).toHaveProperty("step_up_threshold");
    });

    it("should update user preferences", async () => {
      const response = await request(app)
        .patch("/v1/biometrics/prefs")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          biometrics_enabled: true,
          step_up_threshold: 100000,
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
    });
  });

  describe("Devices", () => {
    it("should list user devices", async () => {
      const response = await request(app)
        .get("/v1/biometrics/devices")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("devices");
      expect(Array.isArray(response.body.devices)).toBe(true);
    });
  });

  describe("Rate limiting", () => {
    it("should rate limit excessive requests", async () => {
      // Make many requests quickly
      const requests = Array(70).fill(null).map(() =>
        request(app)
          .get("/v1/biometrics/prefs")
          .set("Authorization", `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
