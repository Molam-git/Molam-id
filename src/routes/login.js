import { pool } from "../db.js";
import { verifyPassword } from "../utils/crypto.js";
import { createToken } from "../utils/jwt.js";

export default async function loginRoutes(fastify) {
  fastify.post("/api/login", async (req, reply) => {
    try {
      const { phone, email, password } = req.body;
      if (!password) return reply.code(400).send({ error: "password required" });

      const { rows } = await pool.query(
        "SELECT id, molam_id, password_hash FROM molam_users WHERE phone_e164=$1 OR email=$2",
        [phone || null, email || null]
      );

      if (rows.length === 0) return reply.code(404).send({ error: "User not found" });
      const user = rows[0];

      const ok = await verifyPassword(user.password_hash, password);
      if (!ok) return reply.code(401).send({ error: "Invalid password" });

      const token = createToken({ user_id: user.id, molam_id: user.molam_id });
      reply.send({ access_token: token, molam_id: user.molam_id });
    } catch (err) {
      fastify.log.error(err);
      reply.code(500).send({ error: "internal_error" });
    }
  });
}
