// Geo routes
import { Router, Request, Response, NextFunction } from "express";
import { query, queryOne } from "../util/pg";
import { audit } from "../util/audit";
import { AppError } from "../util/errors";
import { lookupIp, initMaxMind } from "../geo/maxmind";
import { encode as encodeGeohash, getPrecisionForLevel } from "../geo/geohash";
import { getActiveCountries, getCountryByCode, detectCountryFromPhone, detectCountryFromMcc } from "../geo/countryMatrix";
import { detectImpossibleTravel, logGeoEvent } from "../geo/fraud";
// import { encryptCoordinateSimple } from "../util/kms";  // Reserved for future use
import { config } from "../config";

const router = Router();

// Initialize MaxMind on module load
initMaxMind().catch(console.error);

// Async handler wrapper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * GET /countries
 * List all active countries
 */
router.get("/countries", asyncHandler(async (_req: Request, res: Response) => {
  const countries = await getActiveCountries();

  res.json({
    countries: countries.map(c => ({
      code: c.countryCode,
      name: c.countryName,
      currency: c.currencyCode,
      currencySymbol: c.currencySymbol,
      timezone: c.defaultTimezone,
      phonePrefix: c.phonePrefix,
      phoneExample: c.phoneExample,
      locale: c.defaultLocale,
      supportsUssd: c.supportsUssd,
      supportsMobileMoney: c.supportsMobileMoney,
    })),
  });
}));

/**
 * GET /countries/:code
 * Get country details
 */
router.get("/countries/:code", asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;

  const country = await getCountryByCode(code.toUpperCase());
  if (!country) {
    throw new AppError(404, "country_not_found", "Country not found");
  }

  res.json({ country });
}));

/**
 * POST /detect
 * Detect country from phone or IP
 *
 * Body:
 * {
 *   "phone": "+221771234567",  // optional
 *   "ip": "41.82.1.1",          // optional
 *   "mcc": 608,                 // optional
 *   "mnc": 1                    // optional
 * }
 */
router.post("/detect", asyncHandler(async (req: Request, res: Response) => {
  const { phone, ip, mcc } = req.body;  // mnc reserved for future use

  let detectedCountry: string | null = null;
  let detectionMethod: string | null = null;
  let geoData: any = null;

  // Try phone first
  if (phone) {
    detectedCountry = await detectCountryFromPhone(phone);
    if (detectedCountry) {
      detectionMethod = "phone";
    }
  }

  // Try MCC
  if (!detectedCountry && mcc) {
    detectedCountry = await detectCountryFromMcc(mcc);
    if (detectedCountry) {
      detectionMethod = "mcc";
    }
  }

  // Try IP
  if (!detectedCountry && ip) {
    geoData = await lookupIp(ip);
    detectedCountry = geoData.country;
    if (detectedCountry) {
      detectionMethod = "ip";
    }
  }

  // Fallback to request IP
  if (!detectedCountry) {
    const requestIp = req.ip || (req.headers["x-forwarded-for"] as string) || "";
    if (requestIp) {
      geoData = await lookupIp(requestIp);
      detectedCountry = geoData.country;
      if (detectedCountry) {
        detectionMethod = "request_ip";
      }
    }
  }

  if (!detectedCountry) {
    throw new AppError(404, "country_not_detected", "Could not detect country");
  }

  const country = await getCountryByCode(detectedCountry);

  res.json({
    country: detectedCountry,
    detectionMethod,
    countryData: country,
    geoData: geoData ? {
      city: geoData.city,
      region: geoData.region,
      timezone: geoData.timezone,
      isVpn: geoData.isVpn,
      isMobile: geoData.isMobile,
    } : null,
  });
}));

/**
 * GET /prefs
 * Get user geo preferences (requires auth)
 */
router.get("/prefs", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, "unauthorized", "Authentication required");
  }

  let prefs = await queryOne<any>(`
    SELECT
      gps_opt_in AS "gpsOptIn",
      precision_level AS "precisionLevel",
      preferred_country AS "preferredCountry",
      preferred_currency AS "preferredCurrency",
      preferred_locale AS "preferredLocale",
      preferred_timezone AS "preferredTimezone",
      home_country AS "homeCountry"
    FROM molam_user_geo_prefs
    WHERE user_id = $1
  `, [userId]);

  // Create default if not exists
  if (!prefs) {
    await query(`
      INSERT INTO molam_user_geo_prefs (user_id, precision_level)
      VALUES ($1, $2)
    `, [userId, config.privacy.defaultPrecision]);

    prefs = {
      gpsOptIn: false,
      precisionLevel: config.privacy.defaultPrecision,
      preferredCountry: null,
      preferredCurrency: null,
      preferredLocale: null,
      preferredTimezone: null,
      homeCountry: null,
    };
  }

  res.json({ prefs });
}));

/**
 * PUT /prefs
 * Update user geo preferences (requires auth)
 */
router.put("/prefs", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, "unauthorized", "Authentication required");
  }

  const {
    gpsOptIn,
    precisionLevel,
    preferredCountry,
    preferredCurrency,
    preferredLocale,
    preferredTimezone,
    homeCountry,
  } = req.body;

  // Validate precision level
  const validPrecisions = ["country", "region", "city", "precise"];
  if (precisionLevel && !validPrecisions.includes(precisionLevel)) {
    throw new AppError(400, "invalid_precision", "Invalid precision level");
  }

  // Upsert preferences
  await query(`
    INSERT INTO molam_user_geo_prefs (
      user_id,
      gps_opt_in,
      precision_level,
      preferred_country,
      preferred_currency,
      preferred_locale,
      preferred_timezone,
      home_country
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (user_id) DO UPDATE SET
      gps_opt_in = COALESCE($2, molam_user_geo_prefs.gps_opt_in),
      precision_level = COALESCE($3, molam_user_geo_prefs.precision_level),
      preferred_country = COALESCE($4, molam_user_geo_prefs.preferred_country),
      preferred_currency = COALESCE($5, molam_user_geo_prefs.preferred_currency),
      preferred_locale = COALESCE($6, molam_user_geo_prefs.preferred_locale),
      preferred_timezone = COALESCE($7, molam_user_geo_prefs.preferred_timezone),
      home_country = COALESCE($8, molam_user_geo_prefs.home_country),
      updated_at = NOW()
  `, [
    userId,
    gpsOptIn,
    precisionLevel,
    preferredCountry,
    preferredCurrency,
    preferredLocale,
    preferredTimezone,
    homeCountry,
  ]);

  await audit(userId, "geo_prefs_updated", req, { gpsOptIn, precisionLevel });

  res.json({ status: "ok" });
}));

/**
 * POST /context
 * Capture geo context (requires auth)
 *
 * Body:
 * {
 *   "latitude": 14.6928,    // optional (requires gpsOptIn)
 *   "longitude": -17.4467,  // optional (requires gpsOptIn)
 *   "accuracy": 10,         // optional (meters)
 *   "mcc": 608,             // optional
 *   "mnc": 1,               // optional
 *   "carrier": "Orange SN"  // optional
 * }
 */
router.post("/context", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, "unauthorized", "Authentication required");
  }

  const { latitude, longitude, accuracy, mcc, mnc, carrier } = req.body;

  // Get user preferences
  const prefs = await queryOne<any>(`
    SELECT gps_opt_in AS "gpsOptIn", precision_level AS "precisionLevel"
    FROM molam_user_geo_prefs
    WHERE user_id = $1
  `, [userId]);

  const gpsOptIn = prefs?.gpsOptIn || false;
  const precisionLevel = prefs?.precisionLevel || config.privacy.defaultPrecision;

  // Get IP-based geo
  const requestIp = req.ip || (req.headers["x-forwarded-for"] as string) || "";
  const ipGeo = requestIp ? await lookupIp(requestIp) : null;

  let finalLat: number | null = null;
  let finalLon: number | null = null;
  let geohash: string | null = null;
  let source = "ip";

  // Use GPS if opted in
  if (gpsOptIn && latitude && longitude) {
    finalLat = latitude;
    finalLon = longitude;
    source = "gps";

    // Generate geohash based on precision level
    const geohashPrecision = getPrecisionForLevel(precisionLevel as any);
    geohash = encodeGeohash(latitude, longitude, geohashPrecision);

    // Check impossible travel
    const travelCheck = await detectImpossibleTravel(userId, latitude, longitude);
    if (travelCheck?.isImpossible) {
      await logGeoEvent(userId, "impossible_travel", {
        distanceKm: travelCheck.distanceKm,
        timeDeltaMinutes: travelCheck.timeDeltaMinutes,
        riskScore: travelCheck.riskScore,
        actionTaken: "log_only",
      });
    }
  } else if (ipGeo && ipGeo.latitude && ipGeo.longitude) {
    finalLat = ipGeo.latitude;
    finalLon = ipGeo.longitude;
    source = "ip";

    const geohashPrecision = 5; // City level for IP
    geohash = encodeGeohash(ipGeo.latitude, ipGeo.longitude, geohashPrecision);
  }

  // Detect country
  let country = ipGeo?.country || null;
  if (mcc) {
    country = await detectCountryFromMcc(mcc) || country;
    source = "mcc_mnc";
  }

  // Store geo context
  await query(`
    INSERT INTO molam_geo_last_context (
      user_id,
      source,
      country,
      region,
      city,
      geohash,
      latitude,
      longitude,
      accuracy_meters,
      ip_address,
      asn,
      asn_org,
      is_vpn,
      is_mobile,
      mcc,
      mnc,
      carrier,
      timezone,
      utc_offset,
      expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
  `, [
    userId,
    source,
    country,
    ipGeo?.region,
    ipGeo?.city,
    geohash,
    finalLat,
    finalLon,
    accuracy,
    requestIp || null,
    ipGeo?.asn,
    ipGeo?.asnOrg,
    ipGeo?.isVpn,
    ipGeo?.isMobile,
    mcc,
    mnc,
    carrier,
    ipGeo?.timezone,
    null, // UTC offset (TODO: calculate)
    gpsOptIn && latitude ? new Date(Date.now() + config.privacy.gpsMaxTtlMinutes * 60 * 1000) : null,
  ]);

  await audit(userId, "geo_context_captured", req, { source, country });

  res.json({
    status: "ok",
    context: {
      country,
      city: ipGeo?.city,
      timezone: ipGeo?.timezone,
      source,
    },
  });
}));

/**
 * GET /context
 * Get last geo context (requires auth)
 */
router.get("/context", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, "unauthorized", "Authentication required");
  }

  const context = await queryOne<any>(`
    SELECT
      source,
      country,
      region,
      city,
      geohash,
      timezone,
      is_vpn AS "isVpn",
      is_mobile AS "isMobile",
      carrier,
      captured_at AS "capturedAt"
    FROM molam_geo_last_context
    WHERE user_id = $1
    ORDER BY captured_at DESC
    LIMIT 1
  `, [userId]);

  if (!context) {
    throw new AppError(404, "no_context", "No geo context found");
  }

  res.json({ context });
}));

export default router;
