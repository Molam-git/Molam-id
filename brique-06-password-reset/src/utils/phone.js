import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

/**
 * Normalize user identity (email or phone)
 * @param {string} input - Email or phone number
 * @returns {object} - { type, value, country }
 */
export function normalizeIdentity(input) {
  const trimmed = input.trim();

  // Check if it's an email
  if (trimmed.includes('@')) {
    return {
      type: 'email',
      value: trimmed.toLowerCase(),
      country: undefined
    };
  }

  // Parse as phone number
  const phone = parsePhoneNumberFromString(trimmed);

  if (!phone || !phone.isValid()) {
    throw new Error('INVALID_PHONE');
  }

  return {
    type: 'phone',
    value: phone.number, // E.164 format
    country: phone.country || undefined
  };
}

/**
 * Detect country from MCC/MNC (Mobile Country Code / Mobile Network Code)
 * @param {string} mccmnc - MCC+MNC code (e.g., '60801' for Senegal Orange)
 * @param {string} msisdn - Fallback: phone number in E.164
 * @returns {string|undefined} - ISO 3166-1 alpha-2 country code
 */
export function detectCountry(mccmnc, msisdn) {
  // MCC mapping (first 3 digits)
  const mccMap = {
    '608': 'SN', // Senegal
    '612': 'CI', // Côte d'Ivoire
    '620': 'GH', // Ghana
    '621': 'NG', // Nigeria
    '625': 'RW', // Rwanda
    '630': 'CD', // DR Congo
    '633': 'SC', // Seychelles
    '634': 'SD', // Sudan
    '635': 'RW', // Rwanda
    '636': 'ET', // Ethiopia
    '637': 'SO', // Somalia
    '638': 'DJ', // Djibouti
    '639': 'KE', // Kenya
    '640': 'TZ', // Tanzania
    '641': 'UG', // Uganda
    '642': 'BI', // Burundi
    '643': 'MZ', // Mozambique
    '645': 'ZM', // Zambia
    '646': 'MG', // Madagascar
    '647': 'RE', // Réunion
    '648': 'ZW', // Zimbabwe
    '649': 'NA', // Namibia
    '650': 'MW', // Malawi
    '651': 'LS', // Lesotho
    '652': 'BW', // Botswana
    '653': 'SZ', // Eswatini
    '654': 'KM', // Comoros
    '655': 'ZA', // South Africa
    '659': 'SS', // South Sudan
    '702': 'BZ', // Belize
    '704': 'GT', // Guatemala
    '706': 'SV', // El Salvador
    '708': 'HN', // Honduras
    '710': 'NI', // Nicaragua
    '712': 'CR', // Costa Rica
    '714': 'PA', // Panama
    '722': 'AR', // Argentina
    '724': 'BR', // Brazil
    '730': 'CL', // Chile
    '732': 'CO', // Colombia
    '734': 'VE', // Venezuela
    '736': 'BO', // Bolivia
    '738': 'GY', // Guyana
    '740': 'EC', // Ecuador
    '742': 'GF', // French Guiana
    '744': 'PY', // Paraguay
    '746': 'SR', // Suriname
    '748': 'UY', // Uruguay
    '750': 'FK', // Falkland Islands
  };

  // Try MCC-based detection
  if (mccmnc && mccmnc.length >= 3) {
    const mcc = mccmnc.substring(0, 3);
    const country = mccMap[mcc];
    if (country) return country;
  }

  // Fallback: parse MSISDN
  if (msisdn) {
    const phone = parsePhoneNumberFromString(msisdn);
    if (phone && phone.country) {
      return phone.country;
    }
  }

  return undefined;
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid E.164
 */
export function isValidPhone(phone) {
  try {
    const p = parsePhoneNumberFromString(phone);
    return p ? p.isValid() : false;
  } catch {
    return false;
  }
}

/**
 * Format phone number for display
 * @param {string} phone - Phone number in E.164
 * @returns {string} - Formatted phone (international format)
 */
export function formatPhone(phone) {
  try {
    const p = parsePhoneNumberFromString(phone);
    return p ? p.formatInternational() : phone;
  } catch {
    return phone;
  }
}
