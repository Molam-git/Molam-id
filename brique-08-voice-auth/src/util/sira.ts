// SIRA integration for risk scoring
import { redis } from "./redis";
import { config } from "../config";

/**
 * Send signal to SIRA risk engine via Redis Streams
 */
export async function siraSignal(
  userId: string,
  payload: Record<string, any>
): Promise<void> {
  if (!config.sira.enabled) return;

  try {
    await redis.xAdd(
      config.sira.streamName,
      "*",
      {
        user: userId,
        evt: JSON.stringify({
          type: "voice",
          timestamp: new Date().toISOString(),
          ...payload,
        }),
      }
    );
  } catch (err) {
    console.error("Failed to send SIRA signal:", err);
  }
}
