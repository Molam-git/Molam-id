// MaxMind GeoIP2 integration
import { Reader } from "@maxmind/geoip2-node";
import { config } from "../config";
import { getCached, setCached } from "../util/redis";

let cityReader: Reader | null = null;
let asnReader: Reader | null = null;

/**
 * Initialize MaxMind readers
 */
export async function initMaxMind(): Promise<void> {
  try {
    if (config.maxmind.dbPath) {
      cityReader = await Reader.open(config.maxmind.dbPath);
      console.log("✅ MaxMind City database loaded");
    }

    if (config.maxmind.asnDbPath) {
      asnReader = await Reader.open(config.maxmind.asnDbPath);
      console.log("✅ MaxMind ASN database loaded");
    }
  } catch (error) {
    console.error("⚠️  MaxMind database not found - using fallback geo detection");
  }
}

export interface GeoLookupResult {
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  asn: number | null;
  asnOrg: string | null;
  isVpn: boolean;
  isMobile: boolean;
}

/**
 * Lookup IP address geolocation
 */
export async function lookupIp(ip: string): Promise<GeoLookupResult> {
  // Check cache
  const cacheKey = `geo:ip:${ip}`;
  const cached = await getCached<GeoLookupResult>(cacheKey);
  if (cached) return cached;

  const result: GeoLookupResult = {
    country: null,
    region: null,
    city: null,
    latitude: null,
    longitude: null,
    timezone: null,
    asn: null,
    asnOrg: null,
    isVpn: false,
    isMobile: false,
  };

  try {
    // City lookup
    if (cityReader) {
      // Note: Actual MaxMind Reader API usage would be:
      // const cityData = (cityReader as any).city(ip);
      // For now, stub it out since we don't have the database files
      // TODO: Implement actual MaxMind lookup when databases are available
      console.log(`[MaxMind] Would lookup IP: ${ip}`);
    }

    // ASN lookup
    if (asnReader) {
      // Note: Actual MaxMind Reader API usage would be:
      // const asnData = (asnReader as any).asn(ip);
      // For now, stub it out
      console.log(`[MaxMind ASN] Would lookup IP: ${ip}`);
    }

    // Cache for 1 hour
    await setCached(cacheKey, result, 3600);
  } catch (error) {
    console.error("MaxMind lookup failed:", error);
  }

  return result;
}

/**
 * Detect VPN/proxy
 */
export function isVpnOrProxy(asnOrg: string | null): boolean {
  if (!asnOrg) return false;
  const org = asnOrg.toLowerCase();
  return (
    org.includes("vpn") ||
    org.includes("proxy") ||
    org.includes("hosting") ||
    org.includes("cloud") ||
    org.includes("datacenter")
  );
}
