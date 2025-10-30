// IVR webhook routes for telephony integration
// Supports Twilio, Infobip, Africa's Talking
import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { putTempAudio } from "../util/s3";
import { audit } from "../util/audit";
import { config } from "../config";
import { AppError } from "../util/errors";
import { v4 as uuid } from "uuid";

const router = Router();

// Async handler wrapper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Verify IVR webhook signature (HMAC-SHA256)
 */
function verifyWebhookSignature(req: Request): boolean {
  const signature = req.headers["x-ivr-signature"] as string;
  if (!signature || !config.ivr.webhookSecret) return false;

  const body = JSON.stringify(req.body);
  const expected = "sha256=" + crypto
    .createHmac("sha256", config.ivr.webhookSecret)
    .update(body)
    .digest("hex");

  return signature === expected;
}

/**
 * IVR webhook endpoint
 * POST /webhook
 *
 * Receives call recording from IVR provider
 *
 * Expected body formats:
 *
 * 1. Twilio:
 * {
 *   "AccountSid": "...",
 *   "CallSid": "...",
 *   "RecordingUrl": "https://...",
 *   "RecordingSid": "...",
 *   "From": "+221XXXXXXXX",
 *   "To": "+221XXXXXXXX",
 *   "CallDuration": "5"
 * }
 *
 * 2. Africa's Talking:
 * {
 *   "sessionId": "...",
 *   "phoneNumber": "+221XXXXXXXX",
 *   "recordingUrl": "https://...",
 *   "duration": 5
 * }
 *
 * 3. Direct base64:
 * {
 *   "userId": "uuid",
 *   "reqId": "uuid",
 *   "audioBase64": "...",
 *   "phone": "+221XXXXXXXX"
 * }
 */
router.post("/webhook", asyncHandler(async (req: Request, res: Response) => {
  // Verify signature
  if (!verifyWebhookSignature(req)) {
    throw new AppError(401, "invalid_signature", "Invalid webhook signature");
  }

  const {
    // Twilio format
    // AccountSid,  // Not used, kept for documentation
    CallSid,
    RecordingUrl,
    From,
    // To,  // Not used, kept for documentation
    CallDuration,

    // Africa's Talking format
    sessionId,
    phoneNumber,
    recordingUrl,
    duration,

    // Direct format
    userId,
    reqId,
    audioBase64,
    phone,
  } = req.body;

  // Normalize data
  const normalizedData = {
    sessionId: CallSid || sessionId || uuid(),
    phone: From || phoneNumber || phone,
    recordingUrl: RecordingUrl || recordingUrl,
    audioBase64: audioBase64,
    duration: CallDuration || duration,
    userId: userId,
    reqId: reqId || uuid(),
  };

  // Handle different input methods
  if (normalizedData.audioBase64) {
    // Direct base64 audio
    await handleBase64Audio(normalizedData);
  } else if (normalizedData.recordingUrl) {
    // Download from URL
    await handleRecordingUrl(normalizedData);
  } else {
    throw new AppError(400, "missing_audio", "No audio data or URL provided");
  }

  await audit(normalizedData.userId || null, "ivr_webhook_received", req, {
    sessionId: normalizedData.sessionId,
    phone: normalizedData.phone,
    duration: normalizedData.duration,
  });

  res.json({ status: "ok", reqId: normalizedData.reqId });
}));

/**
 * Handle base64-encoded audio
 */
async function handleBase64Audio(data: any): Promise<void> {
  const { userId, reqId, audioBase64 } = data;

  if (!userId || !audioBase64) {
    throw new AppError(400, "invalid_data", "Missing userId or audioBase64");
  }

  const key = `voice/${userId}/${reqId}_ivr.wav`;
  const buf = Buffer.from(audioBase64, "base64");

  if (buf.length > 10_000_000) {
    throw new AppError(413, "audio_too_large", "Audio exceeds 10MB limit");
  }

  await putTempAudio(key, buf, "audio/wav");
}

/**
 * Handle recording URL (download and store)
 */
async function handleRecordingUrl(data: any): Promise<void> {
  const { recordingUrl } = data;

  if (!recordingUrl) {
    throw new AppError(400, "missing_url", "No recording URL provided");
  }

  // In production, you'd download the audio from the URL
  // For now, we'll stub this
  // TODO: Implement actual download logic with retry and timeout

  // const response = await fetch(recordingUrl, { timeout: 10000 });
  // const buffer = await response.buffer();
  // const key = `voice/${userId}/${reqId}_ivr.wav`;
  // await putTempAudio(key, buffer, "audio/wav");

  console.log(`[IVR] Would download audio from: ${recordingUrl}`);
}

/**
 * IVR status check endpoint
 * GET /status/:sessionId
 */
router.get("/status/:sessionId", asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  // In production, you'd check the status of the IVR session
  // For now, return stub response
  res.json({
    sessionId,
    status: "completed",
    message: "IVR session completed successfully",
  });
}));

/**
 * Health check for IVR service
 * GET /health
 */
router.get("/health", asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "ivr",
    timestamp: new Date().toISOString(),
  });
}));

export default router;
