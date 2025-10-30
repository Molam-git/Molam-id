import { Router } from "express";
import { pool } from "../util/pg";
import { requireJWT } from "../util/auth";
import { v4 as uuid } from "uuid";
import { signUploadUrl, signDownloadUrl } from "../util/storage";

const r = Router();

// GET /v1/profile/me - Get own profile
r.get("/me", requireJWT(), async (req, res) => {
  const userId = req.user!.sub;
  const { rows } = await pool.query("SELECT * FROM molam_profiles WHERE user_id=$1", [userId]);
  if (!rows[0]) return res.status(404).json({ error: "not_found" });

  let profile = rows[0];
  if (profile.avatar_obj_key) {
    profile.avatar_url = await signDownloadUrl(profile.avatar_obj_key, 3600);
  }
  res.json({ profile });
});

// PATCH /v1/profile/me - Update own profile
r.patch("/me", requireJWT(), async (req, res) => {
  const userId = req.user!.sub;
  const { display_name, country_code, preferences, bio } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE molam_profiles
     SET display_name=COALESCE($2,display_name),
         country_code=COALESCE($3,country_code),
         preferences=COALESCE($4,preferences),
         bio=COALESCE($5,bio),
         updated_at=NOW()
     WHERE user_id=$1
     RETURNING *`,
    [userId, display_name, country_code, preferences, bio]
  );
  if (!rows[0]) return res.status(404).json({ error: "not_found" });

  await pool.query(
    `INSERT INTO molam_profile_events(id,user_id,event_type,detail,actor_id)
     VALUES ($1,$2,'update_profile',$3,$4)`,
    [uuid(), userId, JSON.stringify(req.body), userId]
  );
  res.json({ profile: rows[0] });
});

// POST /v1/profile/avatar/upload - Request avatar upload URL
r.post("/avatar/upload", requireJWT(), async (req, res) => {
  const userId = req.user!.sub;
  const key = `avatars/${userId}/${uuid()}.jpg`;
  const url = await signUploadUrl(key, 900);

  await pool.query(
    `UPDATE molam_profiles SET avatar_obj_key=$2, updated_at=NOW() WHERE user_id=$1`,
    [userId, key]
  );
  res.json({ upload_url: url, key });
});

// POST /v1/profile/:user_id/badges - Add badge (admin only)
r.post("/:user_id/badges", requireJWT("id:profile:badge:add"), async (req, res) => {
  const targetId = req.params.user_id;
  const { badge } = req.body || {};
  if (!badge) return res.status(400).json({ error: "missing_badge" });

  const { rows } = await pool.query(
    `UPDATE molam_profiles
     SET badges = array_append(badges,$2), updated_at=NOW()
     WHERE user_id=$1 RETURNING *`,
    [targetId, badge]
  );

  await pool.query(
    `INSERT INTO molam_profile_events(id,user_id,event_type,detail,actor_id)
     VALUES ($1,$2,'add_badge',$3,$4)`,
    [uuid(), targetId, JSON.stringify({ badge }), req.user!.sub]
  );
  res.json({ profile: rows[0] });
});

export default r;
