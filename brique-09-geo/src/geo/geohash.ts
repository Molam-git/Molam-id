// Geohash encoding for privacy-preserving location
// Based on geohash algorithm (base32 encoding)

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/**
 * Encode latitude/longitude to geohash
 * Precision levels:
 * - 1: ±2500 km (country level)
 * - 2: ±630 km (large region)
 * - 3: ±78 km (region)
 * - 4: ±20 km (city)
 * - 5: ±2.4 km (neighborhood)
 * - 6: ±610 m (street)
 * - 7: ±76 m (building)
 * - 8: ±19 m (precise)
 */
export function encode(latitude: number, longitude: number, precision: number = 6): string {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = "";

  let latMin = -90.0;
  let latMax = 90.0;
  let lonMin = -180.0;
  let lonMax = 180.0;

  while (geohash.length < precision) {
    if (evenBit) {
      // Longitude
      const lonMid = (lonMin + lonMax) / 2;
      if (longitude > lonMid) {
        idx |= (1 << (4 - bit));
        lonMin = lonMid;
      } else {
        lonMax = lonMid;
      }
    } else {
      // Latitude
      const latMid = (latMin + latMax) / 2;
      if (latitude > latMid) {
        idx |= (1 << (4 - bit));
        latMin = latMid;
      } else {
        latMax = latMid;
      }
    }

    evenBit = !evenBit;

    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

/**
 * Decode geohash to approximate latitude/longitude
 * Returns center point of the geohash cell
 */
export function decode(geohash: string): { latitude: number; longitude: number } {
  let evenBit = true;
  let latMin = -90.0;
  let latMax = 90.0;
  let lonMin = -180.0;
  let lonMax = 180.0;

  for (const char of geohash) {
    const idx = BASE32.indexOf(char);
    if (idx === -1) throw new Error(`Invalid geohash character: ${char}`);

    for (let bit = 4; bit >= 0; bit--) {
      const bitValue = (idx >> bit) & 1;

      if (evenBit) {
        // Longitude
        const lonMid = (lonMin + lonMax) / 2;
        if (bitValue === 1) {
          lonMin = lonMid;
        } else {
          lonMax = lonMid;
        }
      } else {
        // Latitude
        const latMid = (latMin + latMax) / 2;
        if (bitValue === 1) {
          latMin = latMid;
        } else {
          latMax = latMid;
        }
      }

      evenBit = !evenBit;
    }
  }

  return {
    latitude: (latMin + latMax) / 2,
    longitude: (lonMin + lonMax) / 2,
  };
}

/**
 * Get precision in meters for a given geohash length
 */
export function getPrecisionMeters(geohashLength: number): number {
  const precisions: Record<number, number> = {
    1: 5000000, // ±5000 km
    2: 630000,  // ±630 km
    3: 78000,   // ±78 km
    4: 20000,   // ±20 km
    5: 2400,    // ±2.4 km
    6: 610,     // ±610 m
    7: 76,      // ±76 m
    8: 19,      // ±19 m
  };
  return precisions[geohashLength] || 0;
}

/**
 * Get geohash precision based on user privacy preference
 */
export function getPrecisionForLevel(level: "country" | "region" | "city" | "precise"): number {
  const levelToPrecision: Record<string, number> = {
    country: 2,
    region: 3,
    city: 5,
    precise: 7,
  };
  return levelToPrecision[level] || 5;
}
