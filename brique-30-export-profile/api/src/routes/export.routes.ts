// brique-30-export-profile/api/src/routes/export.routes.ts
// API routes for GDPR-compliant profile exports

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import rateLimit from 'express-rate-limit';
import { ExportService, ExportSection } from '../services/export/export.service';
import { z } from 'zod';

// =====================================================
// MIDDLEWARE
// =====================================================

// Rate limiting for export requests (very restrictive)
const exportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 exports per hour per user
  message: 'Too many export requests. Please wait before requesting another export.',
  standardHeaders: true,
  legacyHeaders: false
});

// Auth middleware (mock - would use JWT in production)
interface AuthRequest extends Request {
  userId?: string;
  userRoles?: string[];
}

const authenticate = (req: AuthRequest, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Mock JWT validation
  // In production: verify JWT, extract userId and roles
  const token = authHeader.replace('Bearer ', '');

  // For demo purposes, token format: "userid:role1,role2"
  const [userId, rolesStr] = token.split(':');
  req.userId = userId;
  req.userRoles = rolesStr ? rolesStr.split(',') : [];

  next();
};

// RBAC middleware
const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: Function) => {
    if (!req.userRoles || req.userRoles.length === 0) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const hasRole = allowedRoles.some((role) => req.userRoles?.includes(role));
    if (!hasRole) {
      return res.status(403).json({
        error: 'Forbidden',
        required_roles: allowedRoles
      });
    }

    next();
  };
};

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const RequestExportSchema = z.object({
  format: z.enum(['json', 'pdf']),
  include_sections: z.array(z.enum([
    'profile',
    'badges',
    'activity',
    'media',
    'privacy',
    'devices',
    'transactions_pay',
    'orders_eats',
    'orders_shop',
    'kyc'
  ])).optional().default(['profile', 'badges', 'activity'])
});

// =====================================================
// ROUTER SETUP
// =====================================================

export function createExportRouter(
  pool: Pool,
  s3Client: S3Client,
  config: {
    exportSecret: string;
    s3Bucket: string;
  }
): Router {
  const router = Router();
  const exportService = new ExportService(pool, s3Client, config);

  // =====================================================
  // PUBLIC ROUTES (authenticated users)
  // =====================================================

  // Request new export
  router.post(
    '/api/profile/export',
    authenticate,
    exportRateLimit,
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.userId!;
        const body = RequestExportSchema.parse(req.body);

        const result = await exportService.requestExport({
          user_id: userId,
          format: body.format,
          include_sections: body.include_sections as ExportSection[],
          ip_address: req.ip,
          user_agent: req.get('user-agent')
        });

        res.status(202).json({
          export_id: result.export_id,
          status: result.status,
          message: `Export request accepted. Processing will complete in a few minutes.`,
          estimated_time: '2-5 minutes'
        });
      } catch (error: any) {
        console.error('Request export error:', error);

        if (error.message === 'export_rate_limit_exceeded') {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Please wait 5 minutes between export requests'
          });
        }

        res.status(400).json({
          error: error.message || 'Failed to request export'
        });
      }
    }
  );

  // Get export status
  router.get(
    '/api/profile/export/:exportId',
    authenticate,
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.userId!;
        const exportId = parseInt(req.params.exportId, 10);

        if (isNaN(exportId)) {
          return res.status(400).json({ error: 'Invalid export ID' });
        }

        const status = await exportService.getExportStatus(userId, exportId);

        if (!status) {
          return res.status(404).json({ error: 'Export not found' });
        }

        res.json(status);
      } catch (error: any) {
        console.error('Get export status error:', error);
        res.status(500).json({
          error: error.message || 'Failed to get export status'
        });
      }
    }
  );

  // Get download URL
  router.get(
    '/api/profile/export/:exportId/download',
    authenticate,
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.userId!;
        const exportId = parseInt(req.params.exportId, 10);

        if (isNaN(exportId)) {
          return res.status(400).json({ error: 'Invalid export ID' });
        }

        const download = await exportService.getDownloadUrl(userId, exportId);

        res.json({
          download_url: download.url,
          expires_at: download.expires_at,
          format: download.format,
          size_bytes: download.size,
          message: 'Download URL is valid for 1 hour'
        });
      } catch (error: any) {
        console.error('Get download URL error:', error);

        if (error.message === 'Export not found') {
          return res.status(404).json({ error: 'Export not found' });
        }

        if (error.message === 'Export has expired') {
          return res.status(410).json({
            error: 'Export has expired',
            message: 'Please request a new export'
          });
        }

        if (error.message.includes('not ready')) {
          return res.status(425).json({
            error: 'Export not ready',
            message: 'Export is still processing. Please try again in a few minutes.'
          });
        }

        res.status(500).json({
          error: error.message || 'Failed to get download URL'
        });
      }
    }
  );

  // List user exports
  router.get(
    '/api/profile/exports',
    authenticate,
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.userId!;
        const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

        const exports = await exportService.listUserExports(userId, limit);

        res.json({
          exports,
          count: exports.length
        });
      } catch (error: any) {
        console.error('List exports error:', error);
        res.status(500).json({
          error: error.message || 'Failed to list exports'
        });
      }
    }
  );

  // Get export statistics (own)
  router.get(
    '/api/profile/export/stats',
    authenticate,
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.userId!;
        const days = Math.min(parseInt(req.query.days as string) || 30, 365);

        const stats = await exportService.getExportStatistics(userId, days);

        res.json(stats);
      } catch (error: any) {
        console.error('Get export stats error:', error);
        res.status(500).json({
          error: error.message || 'Failed to get export statistics'
        });
      }
    }
  );

  // =====================================================
  // ADMIN ROUTES (RBAC required)
  // =====================================================

  // Request export for another user (admin/HR only)
  router.post(
    '/api/admin/profile/export/:userId',
    authenticate,
    requireRole('admin', 'hr_admin', 'compliance_officer'),
    async (req: AuthRequest, res: Response) => {
      try {
        const targetUserId = req.params.userId;
        const requestedBy = req.userId!;
        const body = RequestExportSchema.parse(req.body);

        const result = await exportService.requestExport({
          user_id: targetUserId,
          format: body.format,
          include_sections: body.include_sections as ExportSection[],
          requested_by: requestedBy,
          ip_address: req.ip,
          user_agent: req.get('user-agent')
        });

        res.status(202).json({
          export_id: result.export_id,
          status: result.status,
          user_id: targetUserId,
          requested_by: requestedBy,
          message: 'Export request accepted for target user'
        });
      } catch (error: any) {
        console.error('Admin request export error:', error);
        res.status(400).json({
          error: error.message || 'Failed to request export'
        });
      }
    }
  );

  // Get all export statistics (admin)
  router.get(
    '/api/admin/profile/export/stats',
    authenticate,
    requireRole('admin', 'compliance_officer'),
    async (req: AuthRequest, res: Response) => {
      try {
        const days = Math.min(parseInt(req.query.days as string) || 30, 365);

        const stats = await exportService.getExportStatistics(undefined, days);

        res.json(stats);
      } catch (error: any) {
        console.error('Get global export stats error:', error);
        res.status(500).json({
          error: error.message || 'Failed to get export statistics'
        });
      }
    }
  );

  // Cleanup expired exports (admin/maintenance)
  router.post(
    '/api/admin/profile/export/cleanup',
    authenticate,
    requireRole('admin', 'maintenance'),
    async (req: AuthRequest, res: Response) => {
      try {
        const count = await exportService.cleanupExpiredExports();

        res.json({
          message: `Cleaned up ${count} expired exports`,
          cleaned_count: count
        });
      } catch (error: any) {
        console.error('Cleanup exports error:', error);
        res.status(500).json({
          error: error.message || 'Failed to cleanup exports'
        });
      }
    }
  );

  // =====================================================
  // HEALTH CHECK
  // =====================================================

  router.get('/api/profile/export/health', async (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'export',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}

// =====================================================
// EXAMPLE USAGE
// =====================================================

/*
import express from 'express';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { createExportRouter } from './routes/export.routes';

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1'
});

app.use(express.json());
app.use(createExportRouter(pool, s3Client, {
  exportSecret: process.env.EXPORT_SECRET!,
  s3Bucket: process.env.EXPORT_BUCKET!
}));

app.listen(3000, () => {
  console.log('Export API listening on port 3000');
});
*/
