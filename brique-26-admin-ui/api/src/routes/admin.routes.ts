// api/src/routes/admin.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { authzEnforce } from '../middleware/authz';
import * as ctrl from '../controllers/admin.controller';

const router = Router();

// Employees
router.get('/api/id/admin/employees', requireAuth, authzEnforce('id:admin:employees:read'), ctrl.listEmployees);
router.get('/api/id/admin/employees/:id', requireAuth, authzEnforce('id:admin:employees:read'), ctrl.getEmployee);
router.post('/api/id/admin/employees', requireAuth, authzEnforce('id:admin:employees:create'), ctrl.createEmployee);
router.patch('/api/id/admin/employees/:id', requireAuth, authzEnforce('id:admin:employees:update'), ctrl.updateEmployee);
router.post('/api/id/admin/employees/:id/deactivate', requireAuth, authzEnforce('id:admin:employees:deactivate'), ctrl.deactivateEmployee);

// Roles
router.get('/api/id/admin/roles', requireAuth, authzEnforce('id:admin:roles:read'), ctrl.listRoles);
router.post('/api/id/admin/roles/assign', requireAuth, authzEnforce('id:admin:roles:assign'), ctrl.assignRole);
router.post('/api/id/admin/roles/revoke', requireAuth, authzEnforce('id:admin:roles:revoke'), ctrl.revokeRole);

// Sessions
router.get('/api/id/admin/sessions', requireAuth, authzEnforce('id:admin:sessions:read'), ctrl.listSessions);
router.post('/api/id/admin/sessions/:id/revoke', requireAuth, authzEnforce('id:admin:sessions:revoke'), ctrl.revokeSession);

// Audit
router.get('/api/id/admin/audit', requireAuth, authzEnforce('id:admin:audit:read'), ctrl.listAudit);

// Statistics
router.get('/api/id/admin/stats', requireAuth, authzEnforce('id:admin:stats:read'), ctrl.getStats);

export default router;
