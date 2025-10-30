// src/utils/phone.ts
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export interface NormalizedIdentity {
  type: 'email' | 'phone';
  value: string;
  country?: string;
}

/**
 * Normalize identity (email or E.164 phone)
 */
export function normalizeIdentity(input: string): NormalizedIdentity {
  if (input.includes('@')) {
    return { type: 'email', value: input.trim().toLowerCase() };
  }

  const phone = parsePhoneNumberFromString(input);
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
 * Detect country from MCC/MNC or MSISDN
 */
export function detectCountry(mccmnc?: string, msisdn?: string): string | undefined {
  // MCC (Mobile Country Code) mapping for Afrique + LATAM
  const mccMap: Record<string, string> = {
    // West Africa
    '608': 'SN', // Senegal
    '612': 'CI', // Côte d'Ivoire
    '613': 'BJ', // Benin
    '614': 'NE', // Niger
    '615': 'TG', // Togo
    '616': 'BJ', // Benin
    '617': 'MU', // Mauritius
    '618': 'LR', // Liberia
    '619': 'SL', // Sierra Leone
    '620': 'GH', // Ghana
    '621': 'NG', // Nigeria
    '622': 'TD', // Chad
    '623': 'CF', // Central African Republic
    '624': 'CM', // Cameroon
    '625': 'CV', // Cape Verde
    '626': 'ST', // São Tomé and Príncipe
    '627': 'GQ', // Equatorial Guinea
    '628': 'GA', // Gabon
    '629': 'CG', // Republic of Congo
    '630': 'CD', // DR Congo
    '631': 'AO', // Angola
    '632': 'GW', // Guinea-Bissau
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

    // Latin America
    '704': 'GT', // Guatemala
    '706': 'SV', // El Salvador
    '708': 'HN', // Honduras
    '710': 'NI', // Nicaragua
    '712': 'CR', // Costa Rica
    '714': 'PA', // Panama
    '716': 'PE', // Peru
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

  // Try MCC first
  if (mccmnc) {
    const mcc = mccmnc.substring(0, 3);
    if (mccMap[mcc]) {
      return mccMap[mcc];
    }
  }

  // Fallback: parse MSISDN
  if (msisdn) {
    const phone = parsePhoneNumberFromString(msisdn);
    if (phone?.country) {
      return phone.country;
    }
  }

  return undefined;
}
