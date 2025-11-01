// import request from "supertest";
// import app from "../src/*"; // ou ton entrypoint Express/Fastify
// import db from "../src/db";

// describe("🧩 Brique 33 – Admin ID Governance (4-eyes / Superadmin)", () => {
//   let aToken: string, bToken: string, targetId: string, requestId: string;

//   beforeAll(async () => {
//     // Nettoyage tables
//     await db.none("TRUNCATE molam_roles, molam_users RESTART IDENTITY CASCADE");

//     // Création de 3 utilisateurs
//     const A = await db.one("INSERT INTO molam_users(email) VALUES('a@molam.io') RETURNING id");
//     const B = await db.one("INSERT INTO molam_users(email) VALUES('b@molam.io') RETURNING id");
//     const T = await db.one("INSERT INTO molam_users(email) VALUES('t@molam.io') RETURNING id");

//     // Ajout rôles superadmin
//     await db.none("INSERT INTO molam_roles(user_id,module,role,access_scope) VALUES($1,'id','superadmin','admin')", [A.id]);
//     await db.none("INSERT INTO molam_roles(user_id,module,role,access_scope) VALUES($1,'id','superadmin','admin')", [B.id]);

//     // Tokens JWT simulés
//     aToken = "Bearer " + (await fakeJwt(A.id));
//     bToken = "Bearer " + (await fakeJwt(B.id));
//     targetId = T.id;
//   });

//   it("✅ GET / superadmins – liste les superadmins", async () => {
//     const res = await request(app)
//       .get("/api/id/admin/superadmins")
//       .set("Authorization", aToken)
//       .expect(200);
//     expect(res.body.superadmins.length).toBeGreaterThanOrEqual(2);
//   });

//   it("✅ A crée une requête ADD_SUPERADMIN", async () => {
//     const res = await request(app)
//       .post("/api/id/admin/requests")
//       .set("Authorization", aToken)
//       .set("Idempotency-Key", "req-1")
//       .send({
//         action_key: "ADD_SUPERADMIN",
//         target_user: targetId,
//         justification: "Besoin d’un 3e superadmin pour astreinte"
//       })
//       .expect(201);
//     requestId = res.body.id;
//     expect(res.body.action_key).toBe("ADD_SUPERADMIN");
//   });

//   it("✅ B approuve la requête", async () => {
//     await request(app)
//       .post(`/api/id/admin/requests/${requestId}/approve`)
//       .set("Authorization", bToken)
//       .send({ decision: "APPROVE", reason: "OK pour ajout" })
//       .expect(200);

//     const st = await db.one("SELECT status FROM id_admin_action_requests WHERE id=$1", [requestId]);
//     expect(st.status).toBe("APPROVED");
//   });

//   it("✅ A exécute la requête (avec HSM assertion)", async () => {
//     await request(app)
//       .post(`/api/id/admin/requests/${requestId}/execute`)
//       .set("Authorization", aToken)
//       .set("X-Hsm-Assertion", "ATT_OK")
//       .set("Idempotency-Key", "exec-1")
//       .expect(200);

//     const role = await db.oneOrNone(
//       "SELECT 1 FROM molam_roles WHERE user_id=$1 AND module='id' AND role='superadmin'",
//       [targetId]
//     );
//     expect(role).toBeTruthy();
//   });

//   it("✅ Audit WORM contient l’entrée ADD_SUPERADMIN_EXECUTE", async () => {
//     const log = await db.oneOrNone(
//       "SELECT * FROM id_admin_worm_audit WHERE action_key='ADD_SUPERADMIN_EXECUTE' ORDER BY at DESC LIMIT 1"
//     );
//     expect(log).not.toBeNull();
//   });

//   it("✅ Refus auto si self-approve", async () => {
//     const res = await request(app)
//       .post("/api/id/admin/requests")
//       .set("Authorization", aToken)
//       .set("Idempotency-Key", "req-2")
//       .send({
//         action_key: "REMOVE_SUPERADMIN",
//         target_user: targetId,
//         justification: "Test self-approve"
//       })
//       .expect(201);

//     const newReq = res.body.id;
//     await request(app)
//       .post(`/api/id/admin/requests/${newReq}/approve`)
//       .set("Authorization", aToken)
//       .send({ decision: "APPROVE" })
//       .expect(403);
//   });

//   it("✅ Création et fermeture Break-Glass", async () => {
//     // 1. création + approbation + exécution simulée
//     const r = await db.one(`
//       INSERT INTO id_admin_action_requests(action_key, requested_by, approvals_required, status)
//       VALUES('BREAK_GLASS',(SELECT id FROM molam_users WHERE email='a@molam.io'),1,'APPROVED')
//       RETURNING id`);
//     await db.none(
//       "INSERT INTO id_break_glass_events(request_id, activated_by, hsm_assertion) VALUES($1,(SELECT id FROM molam_users WHERE email='a@molam.io'),'HSM_OK')",
//       [r.id]
//     );

//     // 2. fermeture
//     await request(app)
//       .post(`/api/id/admin/break-glass/${r.id}/close`)
//       .set("Authorization", aToken)
//       .send({ postmortem_url: "https://postmortem.molam.io/incident/1234" })
//       .expect(200);

//     const st = await db.one("SELECT status FROM id_break_glass_events WHERE request_id=$1", [r.id]);
//     expect(st.status).toBe("CLOSED");
//   });
// });

// // Utilitaire : JWT factice
// async function fakeJwt(id: string) {
//   // génère un JWT valide pour tests (bibliothèque jsonwebtoken)
//   const jwt = require("jsonwebtoken");
//   return jwt.sign({ id, roles:[{module:"id",role:"superadmin"}] }, process.env.JWT_SECRET || "dev", { expiresIn: "1h" });
// }
// function beforeAll(arg0: () => Promise<void>) {
//     throw new Error("Function not implemented.");
// }

// function expect(role: any) {
//     throw new Error("Function not implemented.");
// }

