// Fraud detection based on geo data
import { config } from "../config";
import { query, queryOne } from "../util/pg";

/**
 * Calculate distance between two points (Haversine formula)
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export interface ImpossibleTravelResult {
  isImpossible: boolean;
  distanceKm: number;
  timeDeltaMinutes: number;
  speedKmh: number;
  riskScore: number;
}

/**
 * Detect impossible travel
 * Compares current location with last known location
 */
export async function detectImpossibleTravel(
  userId: string,
  currentLat: number,
  currentLon: number
): Promise<ImpossibleTravelResult | null> {
  // Get last geo context
  const lastContext = await queryOne<any>(`
    SELECT
      latitude,
      longitude,
      captured_at
    FROM molam_geo_last_context
    WHERE user_id = $1
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
    ORDER BY captured_at DESC
    LIMIT 1
  `, [userId]);

  if (!lastContext) {
    return null; // No previous location
  }

  const distanceKm = calculateDistance(
    lastContext.latitude,
    lastContext.longitude,
    currentLat,
    currentLon
  );

  const timeDeltaMs = Date.now() - new Date(lastContext.captured_at).getTime();
  const timeDeltaMinutes = timeDeltaMs / (1000 * 60);
  const timeDeltaHours = timeDeltaMinutes / 60;

  const speedKmh = distanceKm / timeDeltaHours;

  const isImpossible = speedKmh > config.fraud.impossibleTravelSpeedKmh;

  // Calculate risk score (0-100)
  let riskScore = 0;
  if (isImpossible) {
    riskScore = Math.min(100, (speedKmh / config.fraud.impossibleTravelSpeedKmh) * 80);
  }

  return {
    isImpossible,
    distanceKm: Math.round(distanceKm),
    timeDeltaMinutes: Math.round(timeDeltaMinutes),
    speedKmh: Math.round(speedKmh),
    riskScore: Math.round(riskScore),
  };
}

/**
 * Log geo event for fraud detection
 */
export async function logGeoEvent(
  userId: string,
  eventType: string,
  metadata: {
    fromCountry?: string;
    toCountry?: string;
    fromIp?: string;
    toIp?: string;
    distanceKm?: number;
    timeDeltaMinutes?: number;
    actionTaken?: string;
    riskScore?: number;
  }
): Promise<void> {
  await query(`
    INSERT INTO molam_geo_events (
      user_id,
      event_type,
      from_country,
      to_country,
      from_ip,
      to_ip,
      distance_km,
      time_delta_minutes,
      action_taken,
      risk_score,
      metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
    userId,
    eventType,
    metadata.fromCountry || null,
    metadata.toCountry || null,
    metadata.fromIp || null,
    metadata.toIp || null,
    metadata.distanceKm || null,
    metadata.timeDeltaMinutes || null,
    metadata.actionTaken || "log_only",
    metadata.riskScore || 0,
    JSON.stringify(metadata),
  ]);
}
