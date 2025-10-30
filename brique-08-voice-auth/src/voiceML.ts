// Voice ML microservice client
// Extracts embeddings and anti-spoofing scores from audio
import fetch from "node-fetch";
import { config } from "./config";

export interface MLResult {
  embedding: number[];      // normalized voice embedding vector (128-512 dims)
  quality: number;          // audio quality score (0-100, higher = better)
  spoofing: number;         // anti-spoofing score (0-100, lower = more genuine)
  duration_sec?: number;    // audio duration
}

/**
 * Extract voice embedding from S3 URL
 * @param url - S3 URL (s3://bucket/key) or HTTP URL
 * @param locale - Language/locale hint for better processing
 */
export async function extractEmbeddingFromUrl(
  url: string,
  locale?: string
): Promise<MLResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.voiceML.timeout);

  try {
    const response = await fetch(`${config.voiceML.url}/v1/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, locale }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ML extraction failed: ${response.status} - ${error}`);
    }

    const result = (await response.json()) as MLResult;

    // Validate result
    if (!Array.isArray(result.embedding) || result.embedding.length === 0) {
      throw new Error("Invalid embedding returned from ML service");
    }

    return result;
  } catch (err) {
    clearTimeout(timeout);
    if ((err as any).name === "AbortError") {
      throw new Error("ML service timeout");
    }
    throw err;
  }
}

/**
 * Extract embedding from raw audio buffer (base64)
 * Alternative method for direct upload
 */
export async function extractEmbeddingFromBuffer(
  audioBase64: string,
  locale?: string
): Promise<MLResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.voiceML.timeout);

  try {
    const response = await fetch(`${config.voiceML.url}/v1/extract/buffer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: audioBase64, locale }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ML extraction failed: ${response.status} - ${error}`);
    }

    return (await response.json()) as MLResult;
  } catch (err) {
    clearTimeout(timeout);
    if ((err as any).name === "AbortError") {
      throw new Error("ML service timeout");
    }
    throw err;
  }
}

/**
 * Health check for ML service
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${config.voiceML.url}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
