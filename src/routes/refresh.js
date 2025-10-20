import { verifyToken, createToken } from "../utils/jwt.js";

export default async function refreshRoutes(fastify) {
  fastify.post("/api/refresh", async (req, reply) => {
    try {
      const { token } = req.body;
      if (!token) return reply.code(400).send({ error: "token required" });
      const payload = verifyToken(token);
      const newToken = createToken({ user_id: payload.user_id, molam_id: payload.molam_id });
      reply.send({ access_token: newToken });
    } catch (err) {
      reply.code(401).send({ error: "Invalid token" });
    }
  });
}
