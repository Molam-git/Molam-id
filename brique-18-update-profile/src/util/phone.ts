/**
 * Phone Normalization Utilities
 * E.164 format conversion using libphonenumber-js
 */

import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js";

/**
 * ISO 3166-1 alpha-3 to alpha-2 conversion
 */
const ISO3_TO_ISO2: Record<string, string> = {
  SEN: "SN", // Senegal
  MLI: "ML", // Mali
  CIV: "CI", // Côte d'Ivoire
  BFA: "BF", // Burkina Faso
  NER: "NE", // Niger
  TGO: "TG", // Togo
  BEN: "BJ", // Benin
  GIN: "GN", // Guinea
  MRT: "MR", // Mauritania
  GMB: "GM", // Gambia
  USA: "US",
  FRA: "FR",
  GBR: "GB",
  DEU: "DE",
  ESP: "ES",
  ITA: "IT",
  BEL: "BE",
  CHE: "CH",
  CAN: "CA",
  MAR: "MA", // Morocco
  DZA: "DZ", // Algeria
  TUN: "TN", // Tunisia
  EGY: "EG", // Egypt
  ZAF: "ZA", // South Africa
  NGA: "NG", // Nigeria
  GHA: "GH", // Ghana
  KEN: "KE", // Kenya
};

/**
 * ISO 3166-1 alpha-2 to alpha-3 conversion
 */
const ISO2_TO_ISO3: Record<string, string> = Object.fromEntries(
  Object.entries(ISO3_TO_ISO2).map(([iso3, iso2]) => [iso2, iso3])
);

/**
 * Convert ISO 3166-1 alpha-3 to alpha-2
 */
export function iso3ToIso2(iso3?: string): string | undefined {
  if (!iso3) return undefined;
  return ISO3_TO_ISO2[iso3.toUpperCase()];
}

/**
 * Convert ISO 3166-1 alpha-2 to alpha-3
 */
export function iso2ToIso3(iso2?: string): string {
  if (!iso2) return "SEN"; // Default to Senegal
  return ISO2_TO_ISO3[iso2.toUpperCase()] || "SEN";
}

/**
 * Normalize phone number to E.164 format
 *
 * @param raw - Raw phone input (e.g., "77 123 45 67", "+221771234567")
 * @param iso3 - ISO 3166-1 alpha-3 country code (e.g., "SEN", "USA")
 * @returns Normalized phone details or validation error
 *
 * @example
 * normalizePhoneE164("77 123 45 67", "SEN")
 * // => { valid: true, e164: "+221771234567", country_code: "SEN" }
 *
 * normalizePhoneE164("+1-555-123-4567", "USA")
 * // => { valid: true, e164: "+15551234567", country_code: "USA" }
 */
export function normalizePhoneE164(
  raw: string,
  iso3?: string
): {
  valid: boolean;
  e164?: string;
  country_code?: string;
  error?: string;
} {
  if (!raw || typeof raw !== "string") {
    return { valid: false, error: "Phone number is required" };
  }

  // Convert ISO3 to ISO2 for libphonenumber
  const iso2 = iso3ToIso2(iso3);

  try {
    const parsed = parsePhoneNumberFromString(raw, iso2 as CountryCode);

    if (!parsed || !parsed.isValid()) {
      return {
        valid: false,
        error: `Invalid phone number for country ${iso3 || "default"}`,
      };
    }

    return {
      valid: true,
      e164: parsed.number,
      country_code: iso3 || iso2ToIso3(parsed.country),
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Phone parsing failed",
    };
  }
}

/**
 * Validate if a string is a valid E.164 phone number
 */
export function isValidE164(phone: string): boolean {
  const parsed = parsePhoneNumberFromString(phone);
  return parsed?.isValid() || false;
}

/**
 * Format E.164 phone for display
 *
 * @example
 * formatPhoneForDisplay("+221771234567")
 * // => "+221 77 123 45 67"
 */
export function formatPhoneForDisplay(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed?.formatInternational() || e164;
}

/**
 * Extract country code from E.164 number
 */
export function getCountryFromE164(e164: string): string | undefined {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed?.country ? iso2ToIso3(parsed.country) : undefined;
}
