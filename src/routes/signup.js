import { pool } from "../db.js";
import { hashPassword } from "../utils/crypto.js";
import { createToken } from "../utils/jwt.js";

export default async function signupRoutes(fastify) {
  fastify.post("/api/signup", async (req, reply) => {
    try {
      const { phone, email, password } = req.body;
      if (!phone && !email) return reply.code(400).send({ error: "phone or email required" });
      if (!password) return reply.code(400).send({ error: "password required" });

      const hashed = await hashPassword(password);
      const molam_id = "MOLAM-SN-" + Math.floor(Math.random() * 10000000).toString().padStart(8, "0");

      const { rows } = await pool.query(
        "INSERT INTO molam_users (molam_id, phone_e164, email, password_hash, status) VALUES ($1,$2,$3,$4,'active') RETURNING id, molam_id",
        [molam_id, phone || null, email || null, hashed]
      );

      const token = createToken({ user_id: rows[0].id, molam_id: rows[0].molam_id });
      return reply.send({ molam_id: rows[0].molam_id, access_token: token });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: "internal_error" });
    }
  });
}
