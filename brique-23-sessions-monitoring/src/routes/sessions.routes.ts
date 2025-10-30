import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { listUserSessions, terminateSession, terminateBulk } from '../sessions/repo';
import { authMiddleware } from '../middleware/auth';
import { checkPermission } from '../util/rbac';

const router = Router();

router.use(authMiddleware);

// User endpoints
router.get('/sessions/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await listUserSessions(req.user!.sub);
    res.json({ sessions, count: sessions.length });
  } catch (err) {
    next(err);
  }
});

router.post('/sessions/:id/terminate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await terminateSession(req.params.id, req.user!.sub, 'user_request');
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ status: 'terminated', session_id: session.id });
  } catch (err) {
    next(err);
  }
});

// Admin endpoints
router.get('/admin/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hasPermission = await checkPermission(req.user!.sub, 'id.admin.session.read');
    if (!hasPermission) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const userId = req.query.user_id as string;
    if (!userId) {
      res.status(400).json({ error: 'user_id required' });
      return;
    }

    const sessions = await listUserSessions(userId);
    res.json({ sessions, count: sessions.length });
  } catch (err) {
    next(err);
  }
});

const terminateBulkSchema = z.object({
  user_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  module_scope: z.enum(['id', 'pay', 'eats', 'talk', 'ads', 'shop', 'free']).optional(),
  all: z.boolean().optional(),
});

router.post('/admin/sessions/terminate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hasPermission = await checkPermission(req.user!.sub, 'id.admin.session.terminate');
    if (!hasPermission) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const dto = terminateBulkSchema.parse(req.body);
    const count = await terminateBulk(dto, req.user!.sub);
    res.json({ terminated: count });
  } catch (err) {
    next(err);
  }
});

export default router;
