// api/src/routes/ui.routes.ts
// API routes for Molam ID UI Management

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { authzEnforce } from '../middleware/authz';
import * as ctrl from '../controllers/ui.controller';

const router = Router();

// ============================================================================
// PROFILE & SETTINGS
// ============================================================================

/**
 * GET /api/id/me
 * Get current user profile and settings
 */
router.get(
  '/api/id/me',
  requireAuth,
  authzEnforce('id:profile:read'),
  ctrl.getMe
);

/**
 * PATCH /api/id/profile
 * Update user profile (display_name, email, phone)
 */
router.patch(
  '/api/id/profile',
  requireAuth,
  authzEnforce('id:profile:update'),
  ctrl.updateProfile
);

/**
 * GET /api/id/settings
 * Get user settings (language, currency, theme, etc.)
 */
router.get(
  '/api/id/settings',
  requireAuth,
  authzEnforce('id:settings:read'),
  ctrl.getSettings
);

/**
 * PATCH /api/id/settings
 * Update user settings
 */
router.patch(
  '/api/id/settings',
  requireAuth,
  authzEnforce('id:settings:update'),
  ctrl.updateSettings
);

// ============================================================================
// SECURITY - SESSIONS
// ============================================================================

/**
 * GET /api/id/security/sessions
 * List all active sessions for current user
 */
router.get(
  '/api/id/security/sessions',
  requireAuth,
  authzEnforce('id:security:sessions:read'),
  ctrl.listSessions
);

/**
 * POST /api/id/security/sessions/:sessionId/revoke
 * Revoke a specific session
 */
router.post(
  '/api/id/security/sessions/:sessionId/revoke',
  requireAuth,
  authzEnforce('id:security:sessions:revoke'),
  ctrl.revokeSession
);

// ============================================================================
// SECURITY - DEVICES
// ============================================================================

/**
 * GET /api/id/security/devices
 * List all registered devices for current user
 */
router.get(
  '/api/id/security/devices',
  requireAuth,
  authzEnforce('id:security:devices:read'),
  ctrl.listDevices
);

/**
 * POST /api/id/security/devices/:deviceId/trust
 * Trust or untrust a device
 * Body: { trust: boolean }
 */
router.post(
  '/api/id/security/devices/:deviceId/trust',
  requireAuth,
  authzEnforce('id:security:devices:trust'),
  ctrl.trustDevice
);

/**
 * POST /api/id/security/devices/:deviceId/revoke
 * Revoke a device and all its sessions
 */
router.post(
  '/api/id/security/devices/:deviceId/revoke',
  requireAuth,
  authzEnforce('id:security:devices:revoke'),
  ctrl.revokeDevice
);

// ============================================================================
// SECURITY - 2FA
// ============================================================================

/**
 * POST /api/id/security/2fa/setup
 * Setup 2FA for user
 * Body: { method: 'totp' | 'sms' | 'app' }
 */
router.post(
  '/api/id/security/2fa/setup',
  requireAuth,
  authzEnforce('id:security:2fa:setup'),
  ctrl.setup2FA
);

/**
 * POST /api/id/security/2fa/verify
 * Verify 2FA code
 * Body: { method: 'totp' | 'sms' | 'app', code: string }
 */
router.post(
  '/api/id/security/2fa/verify',
  requireAuth,
  authzEnforce('id:security:2fa:verify'),
  ctrl.verify2FA
);

// ============================================================================
// SECURITY - PASSWORD
// ============================================================================

/**
 * POST /api/id/security/password/change
 * Change user password
 * Body: { current_password: string, new_password: string }
 */
router.post(
  '/api/id/security/password/change',
  requireAuth,
  authzEnforce('id:security:password:change'),
  ctrl.changePassword
);

// ============================================================================
// ROLES
// ============================================================================

/**
 * GET /api/id/roles
 * Get user roles across all modules (read-only)
 */
router.get(
  '/api/id/roles',
  requireAuth,
  authzEnforce('id:roles:read'),
  ctrl.getRoles
);

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * GET /api/id/notifications
 * List user notifications
 * Query: ?limit=50
 */
router.get(
  '/api/id/notifications',
  requireAuth,
  authzEnforce('id:notifications:read'),
  ctrl.listNotifications
);

/**
 * POST /api/id/notifications/:id/read
 * Mark notification as read
 */
router.post(
  '/api/id/notifications/:id/read',
  requireAuth,
  authzEnforce('id:notifications:update'),
  ctrl.markNotificationRead
);

// ============================================================================
// AUDIT
// ============================================================================

/**
 * GET /api/id/audit
 * List personal audit logs
 * Query: ?limit=100
 */
router.get(
  '/api/id/audit',
  requireAuth,
  authzEnforce('id:audit:read'),
  ctrl.listAudit
);

// ============================================================================
// COMPLIANCE
// ============================================================================

/**
 * POST /api/id/export
 * Request data export (GDPR)
 * Body: { format: 'json' | 'pdf', modules?: string[] }
 */
router.post(
  '/api/id/export',
  requireAuth,
  authzEnforce('id:export:create'),
  ctrl.requestExport
);

/**
 * POST /api/id/delete
 * Request account deletion
 * Body: { reason?: string, password: string }
 */
router.post(
  '/api/id/delete',
  requireAuth,
  authzEnforce('id:delete:request'),
  ctrl.requestDelete
);

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * GET /api/id/health
 * Health check endpoint
 */
router.get('/api/id/health', (req, res) => {
  res.json({ status: 'ok', service: 'molam-id-ui', timestamp: new Date().toISOString() });
});

export default router;
