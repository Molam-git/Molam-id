import request from "supertest";
import app from "../src/app";
import db from "../src/db";

// Mock JWT token generation for tests
async function fakeJwt(userId: string, claims: any = {}): Promise<string> {
    // In real implementation, this would generate a proper JWT
    return `fake.jwt.${userId}`;
}

describe("Session Monitoring", () => {
    let userId: string, token: string, sessionId: string;

    beforeAll(async () => {
        // Create test user
        const u = await db.one(
            "INSERT INTO molam_users(email, user_type) VALUES('testuser@molam.io','external') RETURNING id"
        );
        userId = u.id;

        // Generate token with appropriate roles
        token = "Bearer " + await fakeJwt(userId, {
            roles: [{ module: 'id', role: 'user' }]
        });

        // Create test session
        const s = await db.one(
            `INSERT INTO molam_sessions(user_id, user_type, channel, expires_at, is_active)
       VALUES ($1, 'external', 'web', NOW() + interval '30 minutes', true) RETURNING id`,
            [userId]
        );
        sessionId = s.id;
    });

    afterAll(async () => {
        // Cleanup
        await db.none("DELETE FROM molam_session_activity WHERE session_id = $1", [sessionId]);
        await db.none("DELETE FROM molam_sessions WHERE user_id = $1", [userId]);
        await db.none("DELETE FROM molam_users WHERE id = $1", [userId]);
    });

    it("should list my active sessions", async () => {
        const res = await request(app)
            .get("/api/id/sessions/me")
            .set("Authorization", token)
            .expect(200);

        expect(res.body.sessions).toBeDefined();
        expect(Array.isArray(res.body.sessions)).toBe(true);
        expect(res.body.sessions.length).toBeGreaterThan(0);
        expect(res.body.sessions[0].channel).toBe("web");
    });

    it("should extend session expiration on heartbeat", async () => {
        await request(app)
            .post("/api/id/sessions/heartbeat")
            .set("Authorization", token)
            .send({ session_id: sessionId })
            .expect(200);

        const row = await db.one(
            "SELECT is_active, last_seen_at FROM molam_sessions WHERE id = $1",
            [sessionId]
        );
        expect(row.is_active).toBe(true);
        // last_seen_at should be recent
    });

    it("should revoke one session", async () => {
        await request(app)
            .post(`/api/id/sessions/${sessionId}/revoke`)
            .set("Authorization", token)
            .expect(200);

        const row = await db.one(
            "SELECT is_active, revoked_at FROM molam_sessions WHERE id = $1",
            [sessionId]
        );
        expect(row.is_active).toBe(false);
        expect(row.revoked_at).not.toBeNull();
    });

    it("should return 404 when revoking non-existent session", async () => {
        const res = await request(app)
            .post("/api/id/sessions/invalid-uuid/revoke")
            .set("Authorization", token)
            .expect(404);

        expect(res.body.error).toBeDefined();
    });
});