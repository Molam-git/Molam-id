// api/src/routes.ts
// API routes for i18n service

import { Router } from 'express';
import type { Request, Response } from 'express';
import * as service from './service';
import type { Language, CreateTranslationDTO, UpdateTranslationDTO, UpdateUserLanguageDTO } from './types';

const router = Router();

// ============================================================================
// PUBLIC ROUTES (no auth required)
// ============================================================================

/**
 * GET /api/i18n/:lang
 * Get translation bundle for a language
 */
router.get('/api/i18n/:lang', async (req: Request, res: Response) => {
  try {
    const lang = req.params.lang as Language;

    // Validate language
    if (!['fr', 'en', 'wo', 'ar', 'es'].includes(lang)) {
      return res.status(400).json({ error: 'Invalid language code' });
    }

    const bundle = await service.getTranslationBundle(lang);

    res.json({
      lang: bundle.lang,
      translations: bundle.translations,
      version: bundle.version,
      count: Object.keys(bundle.translations).length
    });
  } catch (error: any) {
    console.error('Error fetching translation bundle:', error);
    res.status(500).json({ error: 'Failed to fetch translations' });
  }
});

/**
 * GET /api/i18n/:lang/key/:key
 * Get single translation with fallback
 */
router.get('/api/i18n/:lang/key/:key', async (req: Request, res: Response) => {
  try {
    const lang = req.params.lang as Language;
    const key = req.params.key;
    const fallbackLang = (req.query.fallback as Language) || 'en';

    const value = await service.getTranslation(key, lang, fallbackLang);

    // Record request for observability
    await service.recordTranslationRequest(lang, key, value !== key);

    res.json({ key, lang, value, fallback: value === key });
  } catch (error: any) {
    console.error('Error fetching translation:', error);
    res.status(500).json({ error: 'Failed to fetch translation' });
  }
});

/**
 * GET /api/i18n/detect
 * Auto-detect user language based on SIRA (geo, history, browser)
 */
router.get('/api/i18n/detect', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    const ip = req.ip || req.headers['x-forwarded-for'] as string;
    const acceptLanguage = req.headers['accept-language'] as string;
    const countryCode = req.query.countryCode as string | undefined;

    const detected = await service.detectUserLanguage({
      userId,
      ip,
      acceptLanguage,
      countryCode
    });

    res.json(detected);
  } catch (error: any) {
    console.error('Error detecting language:', error);
    res.status(500).json({ error: 'Failed to detect language' });
  }
});

// ============================================================================
// ADMIN ROUTES (require authentication)
// ============================================================================
// Note: Add authentication middleware in production

/**
 * GET /api/admin/i18n/translations
 * List all translations with pagination and filters
 */
router.get('/api/admin/i18n/translations', async (req: Request, res: Response) => {
  try {
    const lang = req.query.lang as Language | undefined;
    const category = req.query.category as string | undefined;
    const key = req.query.key as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;

    const result = await service.listTranslations({
      lang,
      category,
      key,
      page,
      pageSize
    });

    res.json({
      translations: result.translations,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize)
    });
  } catch (error: any) {
    console.error('Error listing translations:', error);
    res.status(500).json({ error: 'Failed to list translations' });
  }
});

/**
 * GET /api/admin/i18n/translations/:id
 * Get translation by ID
 */
router.get('/api/admin/i18n/translations/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const translation = await service.getTranslationById(id);

    if (!translation) {
      return res.status(404).json({ error: 'Translation not found' });
    }

    res.json(translation);
  } catch (error: any) {
    console.error('Error fetching translation:', error);
    res.status(500).json({ error: 'Failed to fetch translation' });
  }
});

/**
 * POST /api/admin/i18n/translations
 * Create new translation
 */
router.post('/api/admin/i18n/translations', async (req: Request, res: Response) => {
  try {
    const dto: CreateTranslationDTO = req.body;
    const userId = req.headers['x-user-id'] as string || 'system'; // In production, get from JWT

    // Validate required fields
    if (!dto.key || !dto.lang || !dto.value) {
      return res.status(400).json({ error: 'Missing required fields: key, lang, value' });
    }

    const translation = await service.createTranslation(dto, userId);
    res.status(201).json(translation);
  } catch (error: any) {
    console.error('Error creating translation:', error);
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'Translation already exists for this key and language' });
    } else {
      res.status(500).json({ error: 'Failed to create translation' });
    }
  }
});

/**
 * PUT /api/admin/i18n/translations/:id
 * Update existing translation
 */
router.put('/api/admin/i18n/translations/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const dto: UpdateTranslationDTO = req.body;
    const userId = req.headers['x-user-id'] as string || 'system';

    const translation = await service.updateTranslation(id, dto, userId);
    res.json(translation);
  } catch (error: any) {
    console.error('Error updating translation:', error);
    if (error.message === 'Translation not found') {
      res.status(404).json({ error: 'Translation not found' });
    } else {
      res.status(500).json({ error: 'Failed to update translation' });
    }
  }
});

/**
 * DELETE /api/admin/i18n/translations/:id
 * Delete translation
 */
router.delete('/api/admin/i18n/translations/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const userId = req.headers['x-user-id'] as string || 'system';

    await service.deleteTranslation(id, userId);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting translation:', error);
    if (error.message === 'Translation not found') {
      res.status(404).json({ error: 'Translation not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete translation' });
    }
  }
});

/**
 * POST /api/admin/i18n/translations/bulk
 * Bulk create/update translations
 */
router.post('/api/admin/i18n/translations/bulk', async (req: Request, res: Response) => {
  try {
    const { translations } = req.body as { translations: CreateTranslationDTO[] };
    const userId = req.headers['x-user-id'] as string || 'system';

    if (!Array.isArray(translations) || translations.length === 0) {
      return res.status(400).json({ error: 'Invalid request: translations array required' });
    }

    const results = await service.bulkCreateTranslations(translations, userId);
    res.status(201).json({
      count: results.length,
      translations: results
    });
  } catch (error: any) {
    console.error('Error bulk creating translations:', error);
    res.status(500).json({ error: 'Failed to bulk create translations' });
  }
});

/**
 * POST /api/admin/i18n/cache/refresh
 * Manually refresh translation cache
 */
router.post('/api/admin/i18n/cache/refresh', async (req: Request, res: Response) => {
  try {
    const results = await service.refreshTranslationCache();
    res.json({
      message: 'Cache refreshed successfully',
      results
    });
  } catch (error: any) {
    console.error('Error refreshing cache:', error);
    res.status(500).json({ error: 'Failed to refresh cache' });
  }
});

/**
 * GET /api/admin/i18n/missing/:lang
 * Get missing translations for a language
 */
router.get('/api/admin/i18n/missing/:lang', async (req: Request, res: Response) => {
  try {
    const lang = req.params.lang as Language;

    if (!['fr', 'en', 'wo', 'ar', 'es'].includes(lang)) {
      return res.status(400).json({ error: 'Invalid language code' });
    }

    const missing = await service.getMissingTranslations(lang);

    res.json({
      lang,
      missing,
      count: missing.length
    });
  } catch (error: any) {
    console.error('Error fetching missing translations:', error);
    res.status(500).json({ error: 'Failed to fetch missing translations' });
  }
});

/**
 * GET /api/admin/i18n/coverage
 * Get translation coverage statistics for all languages
 */
router.get('/api/admin/i18n/coverage', async (req: Request, res: Response) => {
  try {
    const coverage = await service.getTranslationCoverage();
    res.json({ coverage });
  } catch (error: any) {
    console.error('Error fetching coverage:', error);
    res.status(500).json({ error: 'Failed to fetch coverage statistics' });
  }
});

/**
 * GET /api/admin/i18n/stats
 * Get translation usage statistics
 */
router.get('/api/admin/i18n/stats', async (req: Request, res: Response) => {
  try {
    const lang = req.query.lang as Language | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const onlyMissing = req.query.onlyMissing === 'true';

    const stats = await service.getTranslationStats({
      lang,
      startDate,
      endDate,
      onlyMissing
    });

    res.json({ stats, count: stats.length });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch translation statistics' });
  }
});

// ============================================================================
// USER LANGUAGE PREFERENCES
// ============================================================================

/**
 * GET /api/i18n/user/preference
 * Get user language preference
 */
router.get('/api/i18n/user/preference', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const pref = await service.getUserLanguagePref(userId);

    if (!pref) {
      return res.status(404).json({ error: 'User preference not found' });
    }

    res.json(pref);
  } catch (error: any) {
    console.error('Error fetching user preference:', error);
    res.status(500).json({ error: 'Failed to fetch user preference' });
  }
});

/**
 * PUT /api/i18n/user/preference
 * Update user language preference
 */
router.put('/api/i18n/user/preference', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const dto: UpdateUserLanguageDTO = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const pref = await service.updateUserLanguagePref(userId, dto);
    res.json(pref);
  } catch (error: any) {
    console.error('Error updating user preference:', error);
    res.status(500).json({ error: 'Failed to update user preference' });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'molam-i18n',
    timestamp: new Date().toISOString(),
    supportedLanguages: ['fr', 'en', 'wo', 'ar', 'es']
  });
});

export default router;
