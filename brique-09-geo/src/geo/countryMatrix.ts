// Country matrix operations
import { query, queryOne } from "../util/pg";
import { getCached, setCached } from "../util/redis";

export interface CountryConfig {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencySymbol: string;
  timezones: string[];
  defaultTimezone: string;
  ussdPrefix: string | null;
  ussdGatewayUrl: string | null;
  phonePrefix: string;
  phoneRegex: string | null;
  phoneExample: string | null;
  defaultLocale: string;
  supportedLocales: string[];
  isActive: boolean;
  supportsUssd: boolean;
  supportsMobileMoney: boolean;
  metadata: Record<string, any>;
}

/**
 * Get all active countries
 */
export async function getActiveCountries(): Promise<CountryConfig[]> {
  const cacheKey = "geo:countries:active";
  const cached = await getCached<CountryConfig[]>(cacheKey);
  if (cached) return cached;

  const rows = await query<any>(`
    SELECT
      country_code AS "countryCode",
      country_name AS "countryName",
      currency_code AS "currencyCode",
      currency_symbol AS "currencySymbol",
      timezones,
      default_timezone AS "defaultTimezone",
      ussd_prefix AS "ussdPrefix",
      ussd_gateway_url AS "ussdGatewayUrl",
      phone_prefix AS "phonePrefix",
      phone_regex AS "phoneRegex",
      phone_example AS "phoneExample",
      default_locale AS "defaultLocale",
      supported_locales AS "supportedLocales",
      is_active AS "isActive",
      supports_ussd AS "supportsUssd",
      supports_mobile_money AS "supportsMobileMoney",
      metadata
    FROM molam_country_matrix
    WHERE is_active = TRUE
    ORDER BY country_code
  `);

  await setCached(cacheKey, rows, 86400); // Cache for 24 hours
  return rows;
}

/**
 * Get country by code
 */
export async function getCountryByCode(code: string): Promise<CountryConfig | null> {
  const cacheKey = `geo:country:${code}`;
  const cached = await getCached<CountryConfig>(cacheKey);
  if (cached) return cached;

  const row = await queryOne<any>(`
    SELECT
      country_code AS "countryCode",
      country_name AS "countryName",
      currency_code AS "currencyCode",
      currency_symbol AS "currencySymbol",
      timezones,
      default_timezone AS "defaultTimezone",
      ussd_prefix AS "ussdPrefix",
      ussd_gateway_url AS "ussdGatewayUrl",
      phone_prefix AS "phonePrefix",
      phone_regex AS "phoneRegex",
      phone_example AS "phoneExample",
      default_locale AS "defaultLocale",
      supported_locales AS "supportedLocales",
      is_active AS "isActive",
      supports_ussd AS "supportsUssd",
      supports_mobile_money AS "supportsMobileMoney",
      metadata
    FROM molam_country_matrix
    WHERE country_code = $1
  `, [code]);

  if (row) {
    await setCached(cacheKey, row, 86400);
  }

  return row;
}

/**
 * Detect country from phone number
 */
export async function detectCountryFromPhone(phone: string): Promise<string | null> {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");

  // Try to match phone prefix
  const countries = await getActiveCountries();

  for (const country of countries) {
    const prefix = country.phonePrefix.replace(/\D/g, "");
    if (digits.startsWith(prefix)) {
      // Validate with regex if available
      if (country.phoneRegex) {
        const regex = new RegExp(country.phoneRegex);
        if (regex.test(digits.substring(prefix.length))) {
          return country.countryCode;
        }
      } else {
        return country.countryCode;
      }
    }
  }

  return null;
}

/**
 * Detect country from MCC (Mobile Country Code)
 */
export async function detectCountryFromMcc(mcc: number): Promise<string | null> {
  // MCC to country code mapping (subset)
  const mccMap: Record<number, string> = {
    608: "SN", // Senegal
    612: "CI", // Côte d'Ivoire
    620: "GH", // Ghana
    621: "NG", // Nigeria
    208: "FR", // France
    610: "ML", // Mali
    613: "BF", // Burkina Faso
    615: "TG", // Togo
    616: "BJ", // Benin
  };

  return mccMap[mcc] || null;
}

/**
 * Get timezone for country
 */
export async function getTimezoneForCountry(countryCode: string): Promise<string | null> {
  const country = await getCountryByCode(countryCode);
  return country?.defaultTimezone || null;
}

/**
 * Get currency for country
 */
export async function getCurrencyForCountry(countryCode: string): Promise<string | null> {
  const country = await getCountryByCode(countryCode);
  return country?.currencyCode || null;
}
