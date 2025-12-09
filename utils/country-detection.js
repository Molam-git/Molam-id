/**
 * Country Detection Utility for Molam ID
 * Detects user's country from multiple sources:
 * 1. Phone number prefix (MSISDN)
 * 2. Mobile Country Code (MCC) - from SIM card
 * 3. IP address geolocation
 *
 * Priority: Phone > MCC > IP
 */

// ============================================================================
// Phone Number to Country Mapping (West Africa + major African countries)
// ============================================================================

const PHONE_PREFIXES = {
  // West Africa
  '+221': 'SN', // Senegal
  '+225': 'CI', // Côte d'Ivoire
  '+226': 'BF', // Burkina Faso
  '+227': 'NE', // Niger
  '+228': 'TG', // Togo
  '+229': 'BJ', // Benin
  '+230': 'MU', // Mauritius
  '+231': 'LR', // Liberia
  '+232': 'SL', // Sierra Leone
  '+233': 'GH', // Ghana
  '+234': 'NG', // Nigeria
  '+235': 'TD', // Chad
  '+236': 'CF', // Central African Republic
  '+237': 'CM', // Cameroon
  '+238': 'CV', // Cape Verde
  '+239': 'ST', // São Tomé and Príncipe
  '+240': 'GQ', // Equatorial Guinea
  '+241': 'GA', // Gabon
  '+242': 'CG', // Republic of Congo
  '+243': 'CD', // Democratic Republic of Congo
  '+244': 'AO', // Angola
  '+245': 'GW', // Guinea-Bissau
  '+246': 'IO', // British Indian Ocean Territory
  '+248': 'SC', // Seychelles
  '+249': 'SD', // Sudan
  '+250': 'RW', // Rwanda
  '+251': 'ET', // Ethiopia
  '+252': 'SO', // Somalia
  '+253': 'DJ', // Djibouti
  '+254': 'KE', // Kenya
  '+255': 'TZ', // Tanzania
  '+256': 'UG', // Uganda
  '+257': 'BI', // Burundi
  '+258': 'MZ', // Mozambique
  '+260': 'ZM', // Zambia
  '+261': 'MG', // Madagascar
  '+262': 'RE', // Réunion
  '+263': 'ZW', // Zimbabwe
  '+264': 'NA', // Namibia
  '+265': 'MW', // Malawi
  '+266': 'LS', // Lesotho
  '+267': 'BW', // Botswana
  '+268': 'SZ', // Eswatini
  '+269': 'KM', // Comoros
  '+27': 'ZA',  // South Africa
  '+20': 'EG',  // Egypt
  '+212': 'MA', // Morocco
  '+213': 'DZ', // Algeria
  '+216': 'TN', // Tunisia
  '+218': 'LY', // Libya
  '+220': 'GM', // Gambia
  '+223': 'ML', // Mali
  '+224': 'GN', // Guinea
};

// ============================================================================
// Mobile Country Code (MCC) to Country Mapping
// ============================================================================

const MCC_MAPPING = {
  // West Africa
  '608': 'SN', // Senegal
  '612': 'CI', // Côte d'Ivoire
  '613': 'BF', // Burkina Faso
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
  '630': 'CD', // Democratic Republic of Congo
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
  '602': 'EG', // Egypt
  '604': 'MA', // Morocco
  '603': 'DZ', // Algeria
  '605': 'TN', // Tunisia
  '606': 'LY', // Libya
  '607': 'GM', // Gambia
  '610': 'ML', // Mali
  '611': 'GN', // Guinea
};

// ============================================================================
// Country to Currency Mapping (ISO 4217)
// ============================================================================

const COUNTRY_CURRENCY = {
  // West African CFA Franc (XOF)
  'SN': 'XOF', 'CI': 'XOF', 'BF': 'XOF', 'NE': 'XOF',
  'TG': 'XOF', 'BJ': 'XOF', 'ML': 'XOF', 'GW': 'XOF',

  // Central African CFA Franc (XAF)
  'CM': 'XAF', 'GA': 'XAF', 'GQ': 'XAF', 'CF': 'XAF',
  'TD': 'XAF', 'CG': 'XAF',

  // Other currencies
  'NG': 'NGN', // Nigerian Naira
  'GH': 'GHS', // Ghanaian Cedi
  'KE': 'KES', // Kenyan Shilling
  'ZA': 'ZAR', // South African Rand
  'EG': 'EGP', // Egyptian Pound
  'MA': 'MAD', // Moroccan Dirham
  'TN': 'TND', // Tunisian Dinar
  'DZ': 'DZD', // Algerian Dinar
  'ET': 'ETB', // Ethiopian Birr
  'UG': 'UGX', // Ugandan Shilling
  'TZ': 'TZS', // Tanzanian Shilling
  'RW': 'RWF', // Rwandan Franc
  'MU': 'MUR', // Mauritian Rupee
  'MG': 'MGA', // Malagasy Ariary
  'AO': 'AOA', // Angolan Kwanza
  'MZ': 'MZN', // Mozambican Metical
  'ZM': 'ZMW', // Zambian Kwacha
  'ZW': 'ZWL', // Zimbabwean Dollar
  'BW': 'BWP', // Botswana Pula
  'NA': 'NAD', // Namibian Dollar
  'LS': 'LSL', // Lesotho Loti
  'SZ': 'SZL', // Swazi Lilangeni
  'MW': 'MWK', // Malawian Kwacha
  'GM': 'GMD', // Gambian Dalasi
  'SL': 'SLL', // Sierra Leonean Leone
  'LR': 'LRD', // Liberian Dollar
  'GN': 'GNF', // Guinean Franc
  'CV': 'CVE', // Cape Verdean Escudo
  'ST': 'STN', // São Tomé and Príncipe Dobra
  'DJ': 'DJF', // Djiboutian Franc
  'SO': 'SOS', // Somali Shilling
  'BI': 'BIF', // Burundian Franc
  'KM': 'KMF', // Comorian Franc
  'SC': 'SCR', // Seychellois Rupee
  'SD': 'SDG', // Sudanese Pound
  'LY': 'LYD', // Libyan Dinar
  'CD': 'CDF', // Congolese Franc
};

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Detect country from phone number (MSISDN)
 * @param {string} phone - Phone number with country code (e.g., "+221771234567")
 * @returns {string|null} - ISO 3166-1 alpha-2 country code or null
 */
function detectCountryFromPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  // Normalize phone number (remove spaces, hyphens, etc.)
  const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

  // Try to match phone prefixes (longest first)
  const sortedPrefixes = Object.keys(PHONE_PREFIXES).sort((a, b) => b.length - a.length);

  for (const prefix of sortedPrefixes) {
    if (normalizedPhone.startsWith(prefix)) {
      return PHONE_PREFIXES[prefix];
    }
  }

  return null;
}

/**
 * Detect country from Mobile Country Code (MCC)
 * @param {string|number} mcc - Mobile Country Code from SIM card
 * @returns {string|null} - ISO 3166-1 alpha-2 country code or null
 */
function detectCountryFromMCC(mcc) {
  if (!mcc) {
    return null;
  }

  const mccString = String(mcc);
  return MCC_MAPPING[mccString] || null;
}

/**
 * Detect country from IP address using geoip-lite
 * @param {string} ip - IP address
 * @returns {string|null} - ISO 3166-1 alpha-2 country code or null
 */
function detectCountryFromIP(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null; // Skip localhost and private IPs
  }

  try {
    const geoip = require('geoip-lite');
    const geo = geoip.lookup(ip);
    return geo ? geo.country : null;
  } catch (error) {
    console.error('GeoIP lookup failed:', error.message);
    return null;
  }
}

/**
 * Main country detection function
 * Tries multiple detection methods in priority order:
 * 1. Phone number (most reliable)
 * 2. Mobile Country Code (SIM card)
 * 3. IP address geolocation (fallback)
 *
 * @param {Object} req - Express request object
 * @returns {Promise<string>} - ISO 3166-1 alpha-2 country code
 */
async function detectCountry(req) {
  const { phone, mcc } = req.body || {};
  const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];

  // Priority 1: Phone number
  let country = detectCountryFromPhone(phone);
  if (country) {
    console.log(`🌍 Country detected from phone: ${country} (${phone})`);
    return country;
  }

  // Priority 2: Mobile Country Code
  if (mcc) {
    country = detectCountryFromMCC(mcc);
    if (country) {
      console.log(`🌍 Country detected from MCC: ${country} (MCC: ${mcc})`);
      return country;
    }
  }

  // Priority 3: IP address
  if (ip) {
    country = detectCountryFromIP(ip);
    if (country) {
      console.log(`🌍 Country detected from IP: ${country} (${ip})`);
      return country;
    }
  }

  // Fallback: Default to Senegal (primary market)
  console.log('🌍 Country detection failed, defaulting to SN (Senegal)');
  return 'SN';
}

/**
 * Get currency for a country
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @returns {string} - ISO 4217 currency code
 */
function getCountryCurrency(countryCode) {
  return COUNTRY_CURRENCY[countryCode] || 'XOF'; // Default to XOF
}

/**
 * Get country name (for display purposes)
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @returns {string} - Country name in French
 */
function getCountryName(countryCode) {
  const COUNTRY_NAMES = {
    'SN': 'Sénégal', 'CI': 'Côte d\'Ivoire', 'BF': 'Burkina Faso', 'NE': 'Niger',
    'TG': 'Togo', 'BJ': 'Bénin', 'ML': 'Mali', 'GW': 'Guinée-Bissau',
    'GN': 'Guinée', 'GM': 'Gambie', 'SL': 'Sierra Leone', 'LR': 'Liberia',
    'GH': 'Ghana', 'NG': 'Nigeria', 'CM': 'Cameroun', 'TD': 'Tchad',
    'CF': 'République Centrafricaine', 'GA': 'Gabon', 'GQ': 'Guinée Équatoriale',
    'CG': 'Congo', 'CD': 'République Démocratique du Congo', 'AO': 'Angola',
    'KE': 'Kenya', 'TZ': 'Tanzanie', 'UG': 'Ouganda', 'RW': 'Rwanda',
    'ET': 'Éthiopie', 'SO': 'Somalie', 'DJ': 'Djibouti', 'SD': 'Soudan',
    'ZA': 'Afrique du Sud', 'ZW': 'Zimbabwe', 'MZ': 'Mozambique', 'ZM': 'Zambie',
    'BW': 'Botswana', 'NA': 'Namibie', 'MG': 'Madagascar', 'MU': 'Maurice',
    'SC': 'Seychelles', 'KM': 'Comores', 'EG': 'Égypte', 'MA': 'Maroc',
    'DZ': 'Algérie', 'TN': 'Tunisie', 'LY': 'Libye',
  };
  return COUNTRY_NAMES[countryCode] || countryCode;
}

module.exports = {
  detectCountry,
  detectCountryFromPhone,
  detectCountryFromMCC,
  detectCountryFromIP,
  getCountryCurrency,
  getCountryName,
  PHONE_PREFIXES,
  MCC_MAPPING,
  COUNTRY_CURRENCY,
};
