// Voice authentication routes
import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../util/pg";
import { v4 as uuid } from "uuid";
import { putTempAudio, deleteTempAudio, getS3Url } from "../util/s3";
import { extractEmbeddingFromUrl } from "../voiceML";
import { randomSalt, hmacEmbedding } from "../util/hash";
import { encryptEnvelopeCombined, decryptEnvelopeCombined } from "../util/kms";
import { audit } from "../util/audit";
import { siraSignal } from "../util/sira";
import { AppError } from "../util/errors";

const router = Router();

// Async handler wrapper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Begin enrollment: generates phrase & request ID
 * POST /v1/voice/enroll/begin
 * body: { locale? }
 * returns: { phrase, reqId, locale }
 */
router.post("/enroll/begin", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const locale = (req.body?.locale || "fr_SN") as string;

  // Get random phrase from database
  const { rows } = await pool.query(
    `SELECT phrase_text FROM molam_voice_phrases
     WHERE locale = $1 AND phrase_type = 'enrollment'
     ORDER BY RANDOM() LIMIT 1`,
    [locale]
  );

  const phrase = rows[0]?.phrase_text || "Je confirme être le propriétaire de ce compte Molam";
  const reqId = uuid();

  await audit(userId, "voice_enroll_begin", req, { reqId, locale });

  res.json({ phrase, reqId, locale });
}));

/**
 * Upload audio (base64 encoded) — temporary storage
 * POST /v1/voice/upload
 * body: { reqId, base64, mime }
 * returns: { status, key }
 */
router.post("/upload", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { reqId, base64, mime } = req.body || {};

  if (!reqId || !base64) {
    throw new AppError(400, "invalid_body", "Missing reqId or base64");
  }

  const key = `voice/${userId}/${reqId}.wav`;
  const buf = Buffer.from(base64, "base64");

  if (buf.length > 4_000_000) {
    throw new AppError(413, "audio_too_large", "Audio file exceeds 4MB limit");
  }

  await putTempAudio(key, buf, mime || "audio/wav");
  await audit(userId, "voice_upload", req, { reqId, size: buf.length });

  res.json({ status: "ok", key });
}));

/**
 * Finish enrollment: extract embedding, store encrypted
 * POST /v1/voice/enroll/finish
 * body: { reqId, key, locale, channel?, phrase? }
 * returns: { status, enrolled, replaced }
 */
router.post("/enroll/finish", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { reqId, key, locale, channel, phrase } = req.body || {};

  if (!key) {
    throw new AppError(400, "missing_audio_key", "Audio key is required");
  }

  // Extract embedding from ML service
  const url = getS3Url(key);
  const ml = await extractEmbeddingFromUrl(url, locale);

  // Check quality thresholds
  if (ml.quality < 40) {
    await deleteTempAudio(key);
    throw new AppError(400, "poor_audio_quality", `Audio quality too low: ${ml.quality}`);
  }

  if (ml.spoofing > 0.50) {
    await deleteTempAudio(key);
    throw new AppError(400, "spoofing_detected", `Spoofing score too high: ${ml.spoofing}`);
  }

  // Convert embedding to buffer
  const embedding = Buffer.from(Float32Array.from(ml.embedding).buffer);
  const salt = randomSalt();
  const hmac = hmacEmbedding(embedding, salt);

  // Encrypt embedding & salt with envelope encryption
  const encEmb = encryptEnvelopeCombined(embedding);
  const encSalt = encryptEnvelopeCombined(salt);

  // Check if user already has credentials (replace)
  const { rows: existing } = await pool.query(
    "SELECT id FROM molam_voice_credentials WHERE user_id=$1",
    [userId]
  );

  if (existing.length > 0) {
    // Update existing
    await pool.query(
      `UPDATE molam_voice_credentials
       SET channel=$2, phrase_hint=$3, locale=$4, embedding_norm=$5,
           embedding_hash=$6, salt=$7, quality_score=$8, spoofing_score=$9,
           created_at=NOW(), sign_count=0
       WHERE user_id=$1`,
      [userId, channel || "mobile_app", phrase || null, locale || "fr_SN",
       encEmb, hmac, encSalt, ml.quality, ml.spoofing]
    );
  } else {
    // Insert new
    const id = uuid();
    await pool.query(
      `INSERT INTO molam_voice_credentials
       (id, user_id, channel, phrase_hint, locale, embedding_algo,
        embedding_norm, embedding_hash, salt, quality_score, spoofing_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, userId, channel || "mobile_app", phrase || null, locale || "fr_SN",
       "ecapa-tdnn@v1", encEmb, hmac, encSalt, ml.quality, ml.spoofing]
    );
  }

  // Enable voice authentication in preferences
  await pool.query(
    `INSERT INTO molam_voice_prefs(user_id, voice_enabled)
     VALUES ($1, true)
     ON CONFLICT (user_id) DO UPDATE SET voice_enabled=true, updated_at=NOW()`,
    [userId]
  );

  // Delete temporary audio
  await deleteTempAudio(key);

  await audit(userId, "voice_enroll_finish", req, {
    reqId,
    quality: ml.quality,
    spoofing: ml.spoofing,
  });

  await siraSignal(userId, {
    voice_enrolled: true,
    quality: ml.quality,
    spoofing: ml.spoofing,
  });

  res.json({
    status: "ok",
    enrolled: true,
    replaced: existing.length > 0,
  });
}));

/**
 * Begin assertion: returns phrase/nonce (anti-replay)
 * POST /v1/voice/assert/begin
 * body: { locale? }
 * returns: { reqId, phrase }
 */
router.post("/assert/begin", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const locale = req.body?.locale || "fr_SN";

  // Check if user has voice credentials
  const { rows } = await pool.query(
    "SELECT id FROM molam_voice_credentials WHERE user_id=$1",
    [userId]
  );

  if (rows.length === 0) {
    throw new AppError(400, "not_enrolled", "User has not enrolled voice authentication");
  }

  const reqId = uuid();

  // Get random verification phrase
  const { rows: phraseRows } = await pool.query(
    `SELECT phrase_text FROM molam_voice_phrases
     WHERE locale = $1 AND phrase_type = 'verification'
     ORDER BY RANDOM() LIMIT 1`,
    [locale]
  );

  const phrase = phraseRows[0]?.phrase_text || "Molam sécurise mon argent aujourd'hui";

  await audit(userId, "voice_assert_begin", req, { reqId });

  res.json({ reqId, phrase });
}));

/**
 * Finish assertion: compare embedding with stored template
 * POST /v1/voice/assert/finish
 * body: { reqId, key, channel? }
 * returns: { status, similarity, spoofing, ttl_sec }
 */
router.post("/assert/finish", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { reqId, key, channel } = req.body || {};

  if (!key) {
    throw new AppError(400, "missing_audio_key", "Audio key is required");
  }

  // Load user preferences
  const { rows: prefsRows } = await pool.query(
    "SELECT * FROM molam_voice_prefs WHERE user_id=$1",
    [userId]
  );

  const prefs = prefsRows[0] || {
    similarity_threshold: 0.78,
    spoofing_threshold: 0.35,
    max_failures: 5,
    cooldown_sec: 900,
  };

  // Load voice credential
  const { rows: credRows } = await pool.query(
    "SELECT * FROM molam_voice_credentials WHERE user_id=$1 LIMIT 1",
    [userId]
  );

  if (credRows.length === 0) {
    throw new AppError(400, "not_enrolled", "User has not enrolled voice authentication");
  }

  const cred = credRows[0];

  // Extract embedding from new audio
  const url = getS3Url(key);
  const ml = await extractEmbeddingFromUrl(url);
  const probe = Buffer.from(Float32Array.from(ml.embedding).buffer);

  // Decrypt stored embedding
  const storedEmbedding = decryptEnvelopeCombined(cred.embedding_norm);

  // Compute cosine similarity
  const similarity = cosineSimilarity(storedEmbedding, probe);
  const spoofing = ml.spoofing;

  // Decision logic
  const pass =
    similarity >= prefs.similarity_threshold &&
    spoofing <= prefs.spoofing_threshold;

  // Log attempt
  await pool.query(
    `INSERT INTO molam_voice_attempts
     (id, user_id, req_id, success, similarity, spoofing, ip, user_agent, channel, geo_country)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      uuid(),
      userId,
      reqId,
      pass,
      similarity,
      spoofing,
      (req.headers["x-forwarded-for"] || req.ip) as string,
      req.headers["user-agent"] || null,
      channel || "mobile_app",
      req.headers["x-geo-country"] || null,
    ]
  );

  // Delete temporary audio
  await deleteTempAudio(key);

  if (!pass) {
    await audit(userId, "voice_assert_fail", req, { reqId, similarity, spoofing });
    await siraSignal(userId, { voice_assert_ok: false, similarity, spoofing });

    throw new AppError(401, "voice_not_match", "Voice verification failed");
  }

  // Update credential usage
  await pool.query(
    "UPDATE molam_voice_credentials SET sign_count=sign_count+1, last_used_at=NOW() WHERE id=$1",
    [cred.id]
  );

  await audit(userId, "voice_assert_ok", req, { reqId, similarity, spoofing });
  await siraSignal(userId, { voice_assert_ok: true, similarity, spoofing });

  res.json({
    status: "ok",
    similarity: Number(similarity.toFixed(4)),
    spoofing: Number(spoofing.toFixed(4)),
    ttl_sec: 300, // 5 minutes for step-up
  });
}));

/**
 * Get user voice preferences
 * GET /v1/voice/prefs
 */
router.get("/prefs", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const { rows } = await pool.query(
    "SELECT * FROM molam_voice_prefs WHERE user_id=$1",
    [userId]
  );

  if (rows.length === 0) {
    res.json({ voice_enabled: false });
    return;
  }

  res.json(rows[0]);
}));

/**
 * Update user voice preferences
 * PATCH /v1/voice/prefs
 * body: { voice_enabled?, require_voice_for_sensitive?, similarity_threshold?, spoofing_threshold?, max_failures?, cooldown_sec? }
 */
router.patch("/prefs", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const {
    voice_enabled,
    require_voice_for_sensitive,
    similarity_threshold,
    spoofing_threshold,
    max_failures,
    cooldown_sec,
  } = req.body || {};

  await pool.query(
    `INSERT INTO molam_voice_prefs
     (user_id, voice_enabled, require_voice_for_sensitive, similarity_threshold,
      spoofing_threshold, max_failures, cooldown_sec)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET
       voice_enabled = COALESCE($2, molam_voice_prefs.voice_enabled),
       require_voice_for_sensitive = COALESCE($3, molam_voice_prefs.require_voice_for_sensitive),
       similarity_threshold = COALESCE($4, molam_voice_prefs.similarity_threshold),
       spoofing_threshold = COALESCE($5, molam_voice_prefs.spoofing_threshold),
       max_failures = COALESCE($6, molam_voice_prefs.max_failures),
       cooldown_sec = COALESCE($7, molam_voice_prefs.cooldown_sec),
       updated_at = NOW()`,
    [
      userId,
      voice_enabled,
      require_voice_for_sensitive,
      similarity_threshold,
      spoofing_threshold,
      max_failures,
      cooldown_sec,
    ]
  );

  res.json({ status: "ok" });
}));

/**
 * Delete voice credentials (revoke)
 * DELETE /v1/voice/credentials
 */
router.delete("/credentials", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  await pool.query("DELETE FROM molam_voice_credentials WHERE user_id=$1", [userId]);
  await pool.query("UPDATE molam_voice_prefs SET voice_enabled=false WHERE user_id=$1", [userId]);

  await audit(userId, "voice_revoke", req, {});

  res.json({ status: "ok", revoked: true });
}));

// Helper: cosine similarity
function cosineSimilarity(a: Buffer, b: Buffer): number {
  const fa = new Float32Array(a.buffer, a.byteOffset, a.length / 4);
  const fb = new Float32Array(b.buffer, b.byteOffset, b.length / 4);

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < Math.min(fa.length, fb.length); i++) {
    dot += fa[i] * fb[i];
    normA += fa[i] * fa[i];
    normB += fb[i] * fb[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-9);
}

export default router;
