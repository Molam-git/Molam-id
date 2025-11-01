/**
 * Session monitoring routes
 */
import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/jwt';
import { authzEnforce } from '../middleware/authz';

import {
  listMySessions,
  heartbeat,
  revokeOne,
  revokeAllButCurrent,
  adminListByUser,
  adminRevokeByFilter,
  getSessionPolicies,
  updateSessionPolicies,
} from '../services/session.service';

const router = Router();

// =============================================================================
// USER SELF-SERVICE ROUTES
// =============================================================================

/**
 * GET /api/id/sessions/me
 * List my active sessions
 */
router.get('/api/id/sessions/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await listMySessions(req.user.id);
    res.json({ sessions: rows });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * POST /api/id/sessions/:id/revoke
 * Revoke one of my sessions
 */
router.post('/api/id/sessions/:id/revoke', requireAuth, async (req: AuthRequest, res) => {
  try {
    const out = await revokeOne(req.user.id, req.params.id, req.ip, req.headers['user-agent']);
    if (!out.ok) return res.status(404).json({ error: out.reason });
    res.json(out);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * POST /api/id/sessions/revoke_all
 * Revoke all my sessions except current
 */
router.post('/api/id/sessions/revoke_all', requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentSessionId = req.session?.id || req.body.current_session_id;
    const out = await revokeAllButCurrent(
      req.user.id,
      req.user.id,
      currentSessionId,
      req.ip,
      req.headers['user-agent']
    );
    res.json(out);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * POST /api/id/sessions/heartbeat
 * Heartbeat to extend rolling expiration
 */
router.post('/api/id/sessions/heartbeat', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sessionId = req.session?.id || req.body.session_id;
    if (!sessionId) {
      return res.status(400).json({ error: 'Bad Request', message: 'session_id required' });
    }

    const out = await heartbeat(sessionId, req.ip, req.headers['user-agent']);
    if (!out.ok) return res.status(404).json({ error: out.reason });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// =============================================================================
// ADMIN ROUTES (ID domain only)
// =============================================================================

/**
 * GET /api/id/admin/sessions/user/:userId
 * Admin: List sessions for a specific user
 */
router.get(
  '/api/id/admin/sessions/user/:userId',
  [requireAuth, authzEnforce('id:admin')],
  async (req: AuthRequest, res) => {
    try {
      const sessions = await adminListByUser(req.params.userId);
      res.json({ sessions });
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }
);

/**
 * POST /api/id/admin/sessions/revoke
 * Admin: Revoke sessions by filter
 */
router.post(
  '/api/id/admin/sessions/revoke',
  [requireAuth, authzEnforce('id:admin')],
  async (req: AuthRequest, res) => {
    try {
      const out = await adminRevokeByFilter(
        req.user.id,
        req.body || {},
        req.ip,
        req.headers['user-agent']
      );
      res.json(out);
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }
);

/**
 * GET /api/id/admin/sessions/policies
 * Admin: Get session policies
 */
router.get(
  '/api/id/admin/sessions/policies',
  [requireAuth, authzEnforce('id:admin')],
  async (req: AuthRequest, res) => {
    try {
      const policies = await getSessionPolicies();
      res.json({ policies });
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }
);

/**
 * PUT /api/id/admin/sessions/policies
 * Admin: Update session policies
 */
router.put(
  '/api/id/admin/sessions/policies',
  [requireAuth, authzEnforce('id:admin')],
  async (req: AuthRequest, res) => {
    try {
      const out = await updateSessionPolicies(
        req.user.id,
        req.body,
        req.ip,
        req.headers['user-agent']
      );
      res.json(out);
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }
);

export default router;
