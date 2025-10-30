// api/src/service.ts
// Service layer for i18n operations

import { pool } from './config';
import type {
  Language,
  Translation,
  TranslationBundle,
  CreateTranslationDTO,
  UpdateTranslationDTO,
  MissingTranslation,
  UserLanguagePref,
  UpdateUserLanguageDTO,
  TranslationStats
} from './types';

// ============================================================================
// PUBLIC TRANSLATIONS API
// ============================================================================

/**
 * Get translation bundle for a language (cached)
 */
export async function getTranslationBundle(lang: Language): Promise<TranslationBundle> {
  const result = await pool.query(
    `SELECT lang, bundle, version, generated_at
     FROM molam_translation_cache
     WHERE lang = $1`,
    [lang]
  );

  if (result.rows.length === 0) {
    // Generate cache if not exists
    await refreshTranslationCache();
    return getTranslationBundle(lang);
  }

  const row = result.rows[0];
  return {
    lang: row.lang,
    translations: row.bundle,
    version: row.version,
    generated_at: row.generated_at
  };
}

/**
 * Get single translation with fallback
 */
export async function getTranslation(
  key: string,
  lang: Language,
  fallbackLang: Language = 'en'
): Promise<string> {
  const result = await pool.query(
    'SELECT get_translation($1, $2, $3) AS value',
    [key, lang, fallbackLang]
  );
  return result.rows[0].value;
}

/**
 * Refresh translation cache for all languages
 */
export async function refreshTranslationCache(): Promise<Array<{lang: string; count: number}>> {
  const result = await pool.query('SELECT * FROM refresh_translation_cache()');
  return result.rows;
}

// ============================================================================
// ADMIN CRUD API
// ============================================================================

/**
 * List all translations with pagination and filters
 */
export async function listTranslations(params: {
  lang?: Language;
  category?: string;
  key?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ translations: Translation[]; total: number }> {
  const { lang, category, key, page = 1, pageSize = 50 } = params;
  const offset = (page - 1) * pageSize;

  let whereClause = '';
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (lang) {
    whereClause += ` AND lang = $${paramIndex++}`;
    queryParams.push(lang);
  }
  if (category) {
    whereClause += ` AND category = $${paramIndex++}`;
    queryParams.push(category);
  }
  if (key) {
    whereClause += ` AND key ILIKE $${paramIndex++}`;
    queryParams.push(`%${key}%`);
  }

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM molam_translations WHERE 1=1 ${whereClause}`,
    queryParams
  );
  const total = parseInt(countResult.rows[0].count);

  // Get paginated results
  queryParams.push(pageSize, offset);
  const result = await pool.query(
    `SELECT * FROM molam_translations
     WHERE 1=1 ${whereClause}
     ORDER BY updated_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    queryParams
  );

  return {
    translations: result.rows,
    total
  };
}

/**
 * Get translation by ID
 */
export async function getTranslationById(id: string): Promise<Translation | null> {
  const result = await pool.query(
    'SELECT * FROM molam_translations WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Create new translation
 */
export async function createTranslation(
  dto: CreateTranslationDTO,
  userId: string
): Promise<Translation> {
  const result = await pool.query(
    `INSERT INTO molam_translations (key, lang, value, category, platform, notes, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     RETURNING *`,
    [dto.key, dto.lang, dto.value, dto.category, dto.platform, dto.notes, userId]
  );

  // Invalidate cache
  await refreshTranslationCache();

  return result.rows[0];
}

/**
 * Update existing translation
 */
export async function updateTranslation(
  id: string,
  dto: UpdateTranslationDTO,
  userId: string
): Promise<Translation> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (dto.value !== undefined) {
    fields.push(`value = $${paramIndex++}`);
    values.push(dto.value);
  }
  if (dto.category !== undefined) {
    fields.push(`category = $${paramIndex++}`);
    values.push(dto.category);
  }
  if (dto.platform !== undefined) {
    fields.push(`platform = $${paramIndex++}`);
    values.push(dto.platform);
  }
  if (dto.notes !== undefined) {
    fields.push(`notes = $${paramIndex++}`);
    values.push(dto.notes);
  }

  fields.push(`updated_by = $${paramIndex++}`);
  values.push(userId);
  values.push(id);

  const result = await pool.query(
    `UPDATE molam_translations
     SET ${fields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error('Translation not found');
  }

  // Invalidate cache
  await refreshTranslationCache();

  return result.rows[0];
}

/**
 * Delete translation
 */
export async function deleteTranslation(id: string, userId: string): Promise<void> {
  const result = await pool.query(
    `UPDATE molam_translations SET updated_by = $2
     WHERE id = $1;
     DELETE FROM molam_translations WHERE id = $1`,
    [id, userId]
  );

  if (result[1].rowCount === 0) {
    throw new Error('Translation not found');
  }

  // Invalidate cache
  await refreshTranslationCache();
}

/**
 * Bulk create translations
 */
export async function bulkCreateTranslations(
  translations: CreateTranslationDTO[],
  userId: string
): Promise<Translation[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const results: Translation[] = [];
    for (const dto of translations) {
      const result = await client.query(
        `INSERT INTO molam_translations (key, lang, value, category, platform, notes, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         ON CONFLICT (key, lang) DO UPDATE
         SET value = EXCLUDED.value,
             category = EXCLUDED.category,
             platform = EXCLUDED.platform,
             notes = EXCLUDED.notes,
             updated_by = EXCLUDED.updated_by
         RETURNING *`,
        [dto.key, dto.lang, dto.value, dto.category, dto.platform, dto.notes, userId]
      );
      results.push(result.rows[0]);
    }

    await client.query('COMMIT');

    // Invalidate cache
    await refreshTranslationCache();

    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// MISSING TRANSLATIONS
// ============================================================================

/**
 * Get missing translations for a language
 */
export async function getMissingTranslations(lang: Language): Promise<MissingTranslation[]> {
  const result = await pool.query(
    'SELECT * FROM get_missing_translations($1)',
    [lang]
  );
  return result.rows;
}

/**
 * Get translation coverage statistics
 */
export async function getTranslationCoverage(): Promise<Array<{
  lang: Language;
  total: number;
  missing: number;
  coverage_percent: number;
}>> {
  const result = await pool.query(`
    WITH english_keys AS (
      SELECT COUNT(*) as total FROM molam_translations WHERE lang = 'en'
    ),
    lang_counts AS (
      SELECT lang, COUNT(*) as count
      FROM molam_translations
      WHERE lang != 'en'
      GROUP BY lang
    )
    SELECT
      lc.lang,
      lc.count as total,
      (ek.total - lc.count) as missing,
      ROUND((lc.count::numeric / ek.total::numeric) * 100, 2) as coverage_percent
    FROM lang_counts lc
    CROSS JOIN english_keys ek
    ORDER BY coverage_percent DESC
  `);
  return result.rows;
}

// ============================================================================
// USER LANGUAGE PREFERENCES
// ============================================================================

/**
 * Get user language preference
 */
export async function getUserLanguagePref(userId: string): Promise<UserLanguagePref | null> {
  const result = await pool.query(
    'SELECT * FROM molam_user_language_prefs WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Update user language preference
 */
export async function updateUserLanguagePref(
  userId: string,
  dto: UpdateUserLanguageDTO
): Promise<UserLanguagePref> {
  const existing = await getUserLanguagePref(userId);

  if (existing) {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.preferred_lang !== undefined) {
      fields.push(`preferred_lang = $${paramIndex++}`);
      values.push(dto.preferred_lang);
    }
    if (dto.fallback_lang !== undefined) {
      fields.push(`fallback_lang = $${paramIndex++}`);
      values.push(dto.fallback_lang);
    }
    if (dto.auto_detect !== undefined) {
      fields.push(`auto_detect = $${paramIndex++}`);
      values.push(dto.auto_detect);
    }

    fields.push(`last_changed_at = NOW()`);
    values.push(userId);

    const result = await pool.query(
      `UPDATE molam_user_language_prefs
       SET ${fields.join(', ')}
       WHERE user_id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0];
  } else {
    const result = await pool.query(
      `INSERT INTO molam_user_language_prefs (user_id, preferred_lang, fallback_lang, auto_detect)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, dto.preferred_lang || 'en', dto.fallback_lang || 'en', dto.auto_detect ?? true]
    );
    return result.rows[0];
  }
}

/**
 * Detect user language based on SIRA (geo, history, browser)
 */
export async function detectUserLanguage(params: {
  userId?: string;
  ip?: string;
  acceptLanguage?: string;
  countryCode?: string;
}): Promise<{ detected_lang: Language; source: string }> {
  // Priority: user history > geo > browser
  const { userId, ip, acceptLanguage, countryCode } = params;

  // 1. Check user history
  if (userId) {
    const pref = await getUserLanguagePref(userId);
    if (pref && pref.auto_detect && pref.detected_lang) {
      return { detected_lang: pref.detected_lang, source: 'history' };
    }
  }

  // 2. Check geo (country code mapping)
  if (countryCode) {
    const geoLangMap: Record<string, Language> = {
      'SN': 'fr', // Senegal -> French
      'ML': 'fr', // Mali -> French
      'CI': 'fr', // Ivory Coast -> French
      'MA': 'ar', // Morocco -> Arabic
      'TN': 'ar', // Tunisia -> Arabic
      'DZ': 'ar', // Algeria -> Arabic
      'ES': 'es', // Spain -> Spanish
      'MX': 'es', // Mexico -> Spanish
      'AR': 'es', // Argentina -> Spanish
      'US': 'en', // USA -> English
      'GB': 'en', // UK -> English
      'CA': 'fr', // Canada -> French (can also be 'en')
    };
    const geoLang = geoLangMap[countryCode.toUpperCase()];
    if (geoLang) {
      return { detected_lang: geoLang, source: 'geo' };
    }
  }

  // 3. Check browser Accept-Language header
  if (acceptLanguage) {
    const browserLang = acceptLanguage.split(',')[0].split('-')[0].toLowerCase();
    if (['fr', 'en', 'wo', 'ar', 'es'].includes(browserLang)) {
      return { detected_lang: browserLang as Language, source: 'browser' };
    }
  }

  // Default fallback
  return { detected_lang: 'en', source: 'default' };
}

// ============================================================================
// TRANSLATION STATISTICS
// ============================================================================

/**
 * Record translation request (for observability)
 */
export async function recordTranslationRequest(
  lang: Language,
  key: string,
  found: boolean
): Promise<void> {
  await pool.query(
    `INSERT INTO molam_translation_stats (lang, key, request_count, missing_count, last_requested_at, date)
     VALUES ($1, $2, 1, $3, NOW(), CURRENT_DATE)
     ON CONFLICT (lang, key, date) DO UPDATE
     SET request_count = molam_translation_stats.request_count + 1,
         missing_count = molam_translation_stats.missing_count + $3,
         last_requested_at = NOW()`,
    [lang, key, found ? 0 : 1]
  );
}

/**
 * Get translation statistics
 */
export async function getTranslationStats(params: {
  lang?: Language;
  startDate?: Date;
  endDate?: Date;
  onlyMissing?: boolean;
}): Promise<TranslationStats[]> {
  const { lang, startDate, endDate, onlyMissing } = params;

  let whereClause = '';
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (lang) {
    whereClause += ` AND lang = $${paramIndex++}`;
    queryParams.push(lang);
  }
  if (startDate) {
    whereClause += ` AND date >= $${paramIndex++}`;
    queryParams.push(startDate);
  }
  if (endDate) {
    whereClause += ` AND date <= $${paramIndex++}`;
    queryParams.push(endDate);
  }
  if (onlyMissing) {
    whereClause += ` AND missing_count > 0`;
  }

  const result = await pool.query(
    `SELECT * FROM molam_translation_stats
     WHERE 1=1 ${whereClause}
     ORDER BY missing_count DESC, request_count DESC
     LIMIT 100`,
    queryParams
  );

  return result.rows;
}
