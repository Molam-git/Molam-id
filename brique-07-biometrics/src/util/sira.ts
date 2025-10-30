// src/util/sira.ts
// SIRA: Système d'Intégrité et de Risque Anticipé (Risk analysis service)
import { redis } from "./redis.js";
import { config } from "../config/index.js";

export interface SIRASignalPayload {
  biometric_enrolled?: boolean;
  biometric_assert_ok?: boolean;
  device_trust_score?: number;
  signal_biometric_ok?: boolean;
  [key: string]: any;
}

/**
 * Send risk signal to SIRA via Redis Stream
 */
export async function siraSignal(
  userId: string,
  payload: SIRASignalPayload
): Promise<void> {
  if (!config.sira.enabled) {
    return;
  }

  try {
    // Publish to Redis Stream for SIRA consumer
    await redis.xAdd(
      config.sira.streamName,
      "*",
      {
        user: userId,
        evt: JSON.stringify(payload),
        timestamp: new Date().toISOString(),
      }
    );
  } catch (err) {
    console.error("SIRA signal error:", err);
    // Non-fatal
  }
}

/**
 * Update device trust score in SIRA
 */
export async function updateDeviceTrust(
  userId: string,
  deviceId: string,
  score: number
): Promise<void> {
  await siraSignal(userId, {
    device_id: deviceId,
    device_trust_score: score,
    signal_biometric_ok: score > 0.7,
  });
}
