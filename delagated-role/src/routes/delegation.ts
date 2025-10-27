import { Router } from "express";
import { pool } from "../repo";
import { requireJWT } from "../auth";
import { v4 as uuid } from "uuid";

const r = Router();

r.post("/", requireJWT("id:delegation:create"), async (req, res) => {
    const userId = res.locals.user.sub; // Changé ici
    const { grantee_id, module, role, country_code, scope, start_at, end_at, approvers } = req.body || {};
    // ... reste du code
});

r.post("/:id/approve", requireJWT("id:delegation:approve"), async (req, res) => {
    const actorId = res.locals.user.sub; // Changé ici
    // ... reste du code
});

r.post("/:id/revoke", requireJWT("id:delegation:revoke"), async (req, res) => {
    const actorId = res.locals.user.sub; // Changé ici
    // ... reste du code
});

r.get("/mine", requireJWT(), async (req, res) => {
    const userId = res.locals.user.sub; // Changé ici
    // ... reste du code
});

export default r;