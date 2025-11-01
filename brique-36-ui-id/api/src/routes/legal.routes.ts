/**
 * Legal documents routes
 * Serves versioned legal documents (CGU, Privacy Policy, etc.)
 */
import { Router } from 'express';
import db from '../db';

const router = Router();

/**
 * GET /api/legal/:type/:lang
 * Get latest version of a legal document
 */
router.get('/api/legal/:type/:lang', async (req, res) => {
  try {
    const { type, lang } = req.params;

    // Validate type
    const validTypes = ['cgu', 'privacy', 'legal', 'cookies', 'data_protection'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    // Validate lang
    const validLangs = ['fr', 'en', 'wo', 'ar', 'es', 'pt'];
    if (!validLangs.includes(lang)) {
      return res.status(400).json({ error: 'Invalid language' });
    }

    const row = await db.oneOrNone(
      `SELECT id, type, lang, version, content, html_content, published_at
       FROM molam_legal_docs
       WHERE type = $1 AND lang = $2
       ORDER BY version DESC
       LIMIT 1`,
      [type, lang]
    );

    if (!row) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(row);
  } catch (error: any) {
    console.error('Error fetching legal document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/legal/:type/:lang/:version
 * Get specific version of a legal document
 */
router.get('/api/legal/:type/:lang/:version', async (req, res) => {
  try {
    const { type, lang, version } = req.params;

    const row = await db.oneOrNone(
      `SELECT id, type, lang, version, content, html_content, published_at
       FROM molam_legal_docs
       WHERE type = $1 AND lang = $2 AND version = $3`,
      [type, lang, parseInt(version)]
    );

    if (!row) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(row);
  } catch (error: any) {
    console.error('Error fetching legal document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/legal/:type/:lang/versions
 * List all versions of a legal document
 */
router.get('/api/legal/:type/:lang/versions', async (req, res) => {
  try {
    const { type, lang } = req.params;

    const rows = await db.any(
      `SELECT id, version, published_at
       FROM molam_legal_docs
       WHERE type = $1 AND lang = $2
       ORDER BY version DESC`,
      [type, lang]
    );

    res.json({ versions: rows });
  } catch (error: any) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/legal/types
 * List available document types
 */
router.get('/api/legal/types', async (req, res) => {
  res.json({
    types: [
      { id: 'cgu', name: 'Terms and Conditions', nameFr: 'CGU' },
      { id: 'privacy', name: 'Privacy Policy', nameFr: 'Politique de Confidentialité' },
      { id: 'legal', name: 'Legal Notice', nameFr: 'Mentions Légales' },
      { id: 'cookies', name: 'Cookies Policy', nameFr: 'Politique des Cookies' },
      { id: 'data_protection', name: 'Data Protection', nameFr: 'Protection des Données' },
    ],
  });
});

/**
 * GET /api/legal/languages
 * List available languages
 */
router.get('/api/legal/languages', async (req, res) => {
  res.json({
    languages: [
      { code: 'fr', name: 'Français' },
      { code: 'en', name: 'English' },
      { code: 'wo', name: 'Wolof' },
      { code: 'ar', name: 'العربية' },
      { code: 'es', name: 'Español' },
      { code: 'pt', name: 'Português' },
    ],
  });
});

export default router;
