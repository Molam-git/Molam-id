-- Seed data for Brique 9 - Géolocalisation
-- Multi-country configuration

-- Senegal
INSERT INTO molam_country_matrix (
  country_code, country_name,
  currency_code, currency_symbol,
  timezones, default_timezone,
  ussd_prefix, ussd_gateway_url,
  phone_prefix, phone_regex, phone_example,
  default_locale, supported_locales,
  is_active, supports_ussd, supports_mobile_money,
  metadata
) VALUES (
  'SN', 'Sénégal',
  'XOF', 'CFA',
  ARRAY['Africa/Dakar'], 'Africa/Dakar',
  '*131#', 'https://ussd.orange.sn/molam',
  '+221', '^(77|78|76|70|75)[0-9]{7}$', '+221 77 123 45 67',
  'fr_SN', ARRAY['fr_SN', 'wo_SN', 'en_SN'],
  TRUE, TRUE, TRUE,
  '{"carriers": ["Orange SN", "Free SN", "Expresso"], "mcc": "608", "capital": "Dakar"}'::jsonb
);

-- Côte d'Ivoire
INSERT INTO molam_country_matrix (
  country_code, country_name,
  currency_code, currency_symbol,
  timezones, default_timezone,
  ussd_prefix, ussd_gateway_url,
  phone_prefix, phone_regex, phone_example,
  default_locale, supported_locales,
  is_active, supports_ussd, supports_mobile_money,
  metadata
) VALUES (
  'CI', 'Côte d''Ivoire',
  'XOF', 'CFA',
  ARRAY['Africa/Abidjan'], 'Africa/Abidjan',
  '*131#', 'https://ussd.orange.ci/molam',
  '+225', '^[0-9]{10}$', '+225 07 12 34 56 78',
  'fr_CI', ARRAY['fr_CI', 'en_CI'],
  TRUE, TRUE, TRUE,
  '{"carriers": ["Orange CI", "MTN CI", "Moov"], "mcc": "612", "capital": "Abidjan"}'::jsonb
);

-- Ghana
INSERT INTO molam_country_matrix (
  country_code, country_name,
  currency_code, currency_symbol,
  timezones, default_timezone,
  ussd_prefix, ussd_gateway_url,
  phone_prefix, phone_regex, phone_example,
  default_locale, supported_locales,
  is_active, supports_ussd, supports_mobile_money,
  metadata
) VALUES (
  'GH', 'Ghana',
  'GHS', '₵',
  ARRAY['Africa/Accra'], 'Africa/Accra',
  '*131#', 'https://ussd.mtn.gh/molam',
  '+233', '^(20|23|24|26|27|28|50|54|55|56|57|59)[0-9]{7}$', '+233 20 123 4567',
  'en_GH', ARRAY['en_GH', 'tw_GH', 'ee_GH'],
  TRUE, TRUE, TRUE,
  '{"carriers": ["MTN GH", "Vodafone GH", "AirtelTigo"], "mcc": "620", "capital": "Accra"}'::jsonb
);

-- Nigeria
INSERT INTO molam_country_matrix (
  country_code, country_name,
  currency_code, currency_symbol,
  timezones, default_timezone,
  ussd_prefix, ussd_gateway_url,
  phone_prefix, phone_regex, phone_example,
  default_locale, supported_locales,
  is_active, supports_ussd, supports_mobile_money,
  metadata
) VALUES (
  'NG', 'Nigeria',
  'NGN', '₦',
  ARRAY['Africa/Lagos'], 'Africa/Lagos',
  '*131#', 'https://ussd.mtn.ng/molam',
  '+234', '^(70|80|81|90|91)[0-9]{8}$', '+234 80 1234 5678',
  'en_NG', ARRAY['en_NG', 'ha_NG', 'ig_NG', 'yo_NG'],
  TRUE, TRUE, TRUE,
  '{"carriers": ["MTN NG", "Airtel NG", "Glo", "9mobile"], "mcc": "621", "capital": "Abuja"}'::jsonb
);

-- France (for diaspora support)
INSERT INTO molam_country_matrix (
  country_code, country_name,
  currency_code, currency_symbol,
  timezones, default_timezone,
  ussd_prefix, ussd_gateway_url,
  phone_prefix, phone_regex, phone_example,
  default_locale, supported_locales,
  is_active, supports_ussd, supports_mobile_money,
  metadata
) VALUES (
  'FR', 'France',
  'EUR', '€',
  ARRAY['Europe/Paris'], 'Europe/Paris',
  NULL, NULL,
  '+33', '^[67][0-9]{8}$', '+33 6 12 34 56 78',
  'fr_FR', ARRAY['fr_FR', 'en_FR'],
  TRUE, FALSE, FALSE,
  '{"carriers": ["Orange FR", "SFR", "Bouygues", "Free"], "mcc": "208", "capital": "Paris"}'::jsonb
);

-- Mali (future expansion)
INSERT INTO molam_country_matrix (
  country_code, country_name,
  currency_code, currency_symbol,
  timezones, default_timezone,
  ussd_prefix, ussd_gateway_url,
  phone_prefix, phone_regex, phone_example,
  default_locale, supported_locales,
  is_active, supports_ussd, supports_mobile_money,
  metadata
) VALUES (
  'ML', 'Mali',
  'XOF', 'CFA',
  ARRAY['Africa/Bamako'], 'Africa/Bamako',
  '*131#', NULL,
  '+223', '^[0-9]{8}$', '+223 70 12 34 56',
  'fr_ML', ARRAY['fr_ML', 'bm_ML'],
  FALSE, TRUE, TRUE,
  '{"carriers": ["Orange ML", "Malitel"], "mcc": "610", "capital": "Bamako"}'::jsonb
);

-- Burkina Faso (future expansion)
INSERT INTO molam_country_matrix (
  country_code, country_name,
  currency_code, currency_symbol,
  timezones, default_timezone,
  ussd_prefix, ussd_gateway_url,
  phone_prefix, phone_regex, phone_example,
  default_locale, supported_locales,
  is_active, supports_ussd, supports_mobile_money,
  metadata
) VALUES (
  'BF', 'Burkina Faso',
  'XOF', 'CFA',
  ARRAY['Africa/Ouagadougou'], 'Africa/Ouagadougou',
  '*131#', NULL,
  '+226', '^[0-9]{8}$', '+226 70 12 34 56',
  'fr_BF', ARRAY['fr_BF', 'mos_BF'],
  FALSE, TRUE, TRUE,
  '{"carriers": ["Orange BF", "Telecel"], "mcc": "613", "capital": "Ouagadougou"}'::jsonb
);

-- Togo (future expansion)
INSERT INTO molam_country_matrix (
  country_code, country_name,
  currency_code, currency_symbol,
  timezones, default_timezone,
  ussd_prefix, ussd_gateway_url,
  phone_prefix, phone_regex, phone_example,
  default_locale, supported_locales,
  is_active, supports_ussd, supports_mobile_money,
  metadata
) VALUES (
  'TG', 'Togo',
  'XOF', 'CFA',
  ARRAY['Africa/Lome'], 'Africa/Lome',
  '*131#', NULL,
  '+228', '^[0-9]{8}$', '+228 90 12 34 56',
  'fr_TG', ARRAY['fr_TG', 'ee_TG'],
  FALSE, TRUE, TRUE,
  '{"carriers": ["Togocom", "Moov"], "mcc": "615", "capital": "Lomé"}'::jsonb
);

-- Benin (future expansion)
INSERT INTO molam_country_matrix (
  country_code, country_name,
  currency_code, currency_symbol,
  timezones, default_timezone,
  ussd_prefix, ussd_gateway_url,
  phone_prefix, phone_regex, phone_example,
  default_locale, supported_locales,
  is_active, supports_ussd, supports_mobile_money,
  metadata
) VALUES (
  'BJ', 'Bénin',
  'XOF', 'CFA',
  ARRAY['Africa/Porto-Novo'], 'Africa/Porto-Novo',
  '*131#', NULL,
  '+229', '^[0-9]{8}$', '+229 97 12 34 56',
  'fr_BJ', ARRAY['fr_BJ', 'yo_BJ'],
  FALSE, TRUE, TRUE,
  '{"carriers": ["MTN BJ", "Moov"], "mcc": "616", "capital": "Porto-Novo"}'::jsonb
);
