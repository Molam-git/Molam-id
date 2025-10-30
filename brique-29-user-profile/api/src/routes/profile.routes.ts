// brique-29-user-profile/api/src/routes/profile.routes.ts
// API routes for user profiles with RBAC and rate limiting

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import {
  ProfileService,
  UpdateProfileDTO,
  UpdatePrivacyDTO,
  VisibilityLevel,
  MediaType,
  ModerationStatus
} from '../services/profile/profile.service';

// =====================================================
// MIDDLEWARE
// =====================================================

// Rate limiters
const publicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP'
});

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // Higher limit for authenticated users
  message: 'Too many requests'
});

const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: 'Upload limit exceeded'
});

// Multer for file uploads (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  },
  fileFilter: (req, file, cb) => {
    // Allow images only
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
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
// ROUTER SETUP
// =====================================================

export function createProfileRouter(pool: Pool): Router {
  const router = Router();
  const profileService = new ProfileService(pool);

  // =====================================================
  // PUBLIC ROUTES
  // =====================================================

  // Get user profile (privacy-filtered)
  router.get('/profile/:userId', publicRateLimit, async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const viewerId = req.userId; // May be undefined for public access

      const profile = await profileService.getProfile(userId, viewerId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      res.json(profile);
    } catch (error: any) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: error.message || 'Failed to get profile' });
    }
  });

  // Get user badges
  router.get('/profile/:userId/badges', publicRateLimit, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const badges = await profileService.getUserBadges(userId);
      res.json({ badges });
    } catch (error: any) {
      console.error('Get badges error:', error);
      res.status(500).json({ error: error.message || 'Failed to get badges' });
    }
  });

  // Get user activity feed
  router.get('/profile/:userId/activity', publicRateLimit, async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const viewerId = req.userId;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const activities = await profileService.getUserActivity(userId, viewerId, limit, offset);
      res.json({
        activities,
        pagination: {
          limit,
          offset,
          count: activities.length
        }
      });
    } catch (error: any) {
      console.error('Get activity error:', error);
      res.status(500).json({ error: error.message || 'Failed to get activity' });
    }
  });

  // =====================================================
  // AUTHENTICATED ROUTES (Own Profile)
  // =====================================================

  // Update own profile
  router.put('/profile', authenticate, authRateLimit, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const dto: UpdateProfileDTO = req.body;

      const profile = await profileService.updateProfile(userId, dto);
      res.json(profile);
    } catch (error: any) {
      console.error('Update profile error:', error);
      res.status(400).json({ error: error.message || 'Failed to update profile' });
    }
  });

  // Upload media (avatar, banner)
  router.post(
    '/profile/media',
    authenticate,
    uploadRateLimit,
    upload.single('file'),
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.userId!;
        const file = req.file;

        if (!file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const mediaType = (req.body.media_type || 'attachment') as MediaType;
        if (!['avatar', 'banner', 'attachment'].includes(mediaType)) {
          return res.status(400).json({ error: 'Invalid media_type' });
        }

        const asset = await profileService.uploadMedia(userId, {
          file: file.buffer,
          fileName: file.originalname,
          mimeType: file.mimetype,
          mediaType
        });

        // Update profile with new media URL
        if (mediaType === 'avatar' || mediaType === 'banner') {
          const signedUrl = await profileService.getSignedMediaUrl(asset.asset_id);
          const updateField = mediaType === 'avatar' ? 'avatar_url' : 'banner_url';
          const assetIdField = mediaType === 'avatar' ? 'avatar_asset_id' : 'banner_asset_id';

          await profileService.updateProfile(userId, {
            [updateField]: signedUrl,
            [assetIdField]: asset.asset_id
          } as any);
        }

        res.status(201).json({
          asset,
          message: 'Media uploaded successfully. Processing in background.'
        });
      } catch (error: any) {
        console.error('Upload media error:', error);
        res.status(500).json({ error: error.message || 'Failed to upload media' });
      }
    }
  );

  // Get signed URL for media
  router.get('/profile/media/:assetId/signed-url', authenticate, authRateLimit, async (req: AuthRequest, res: Response) => {
    try {
      const { assetId } = req.params;
      const expiresIn = Math.min(parseInt(req.query.expires_in as string) || 3600, 86400); // Max 24h

      const signedUrl = await profileService.getSignedMediaUrl(assetId, expiresIn);
      res.json({ signed_url: signedUrl, expires_in: expiresIn });
    } catch (error: any) {
      console.error('Get signed URL error:', error);
      res.status(500).json({ error: error.message || 'Failed to get signed URL' });
    }
  });

  // Delete media
  router.delete('/profile/media/:assetId', authenticate, authRateLimit, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { assetId } = req.params;

      await profileService.deleteMedia(assetId, userId);
      res.json({ message: 'Media deleted successfully' });
    } catch (error: any) {
      console.error('Delete media error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete media' });
    }
  });

  // Get privacy settings
  router.get('/profile/privacy', authenticate, authRateLimit, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const privacy = await profileService.getPrivacySettings(userId);
      if (!privacy) {
        return res.status(404).json({ error: 'Privacy settings not found' });
      }

      res.json(privacy);
    } catch (error: any) {
      console.error('Get privacy error:', error);
      res.status(500).json({ error: error.message || 'Failed to get privacy settings' });
    }
  });

  // Update privacy settings
  router.put('/profile/privacy', authenticate, authRateLimit, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const dto: UpdatePrivacyDTO = req.body;

      const privacy = await profileService.updatePrivacySettings(userId, dto);
      res.json(privacy);
    } catch (error: any) {
      console.error('Update privacy error:', error);
      res.status(400).json({ error: error.message || 'Failed to update privacy settings' });
    }
  });

  // Delete activity
  router.delete('/profile/activity/:activityId', authenticate, authRateLimit, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { activityId } = req.params;

      const deleted = await profileService.deleteActivity(activityId, userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Activity not found or unauthorized' });
      }

      res.json({ message: 'Activity deleted successfully' });
    } catch (error: any) {
      console.error('Delete activity error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete activity' });
    }
  });

  // Export user data (GDPR)
  router.get('/profile/export', authenticate, authRateLimit, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const data = await profileService.exportUserData(userId);
      res.json({
        user_id: userId,
        exported_at: new Date().toISOString(),
        data
      });
    } catch (error: any) {
      console.error('Export data error:', error);
      res.status(500).json({ error: error.message || 'Failed to export data' });
    }
  });

  // =====================================================
  // ADMIN ROUTES (RBAC Required)
  // =====================================================

  // List all badges (admin)
  router.get('/admin/profile/badges', authenticate, authRateLimit, requireRole('admin', 'moderator'), async (req: Request, res: Response) => {
    try {
      const subsidiaryId = req.query.subsidiary_id as string | undefined;
      const isActive = req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined;

      const badges = await profileService.getBadges({ subsidiaryId, isActive });
      res.json({ badges });
    } catch (error: any) {
      console.error('Get badges error:', error);
      res.status(500).json({ error: error.message || 'Failed to get badges' });
    }
  });

  // Assign badge (RBAC: requires subsidiary role)
  router.post('/admin/profile/badges/assign', authenticate, authRateLimit, requireRole('admin', 'moderator'), async (req: AuthRequest, res: Response) => {
    try {
      const assignedBy = req.userId!;
      const { user_id, badge_id, reason } = req.body;

      if (!user_id || !badge_id) {
        return res.status(400).json({ error: 'user_id and badge_id are required' });
      }

      // TODO: Verify assignedBy has required_role for this badge (check molam_badges.required_role)

      const userBadgeId = await profileService.assignBadge(user_id, badge_id, assignedBy, reason);
      res.status(201).json({
        user_badge_id: userBadgeId,
        message: 'Badge assigned successfully'
      });
    } catch (error: any) {
      console.error('Assign badge error:', error);
      res.status(400).json({ error: error.message || 'Failed to assign badge' });
    }
  });

  // Revoke badge
  router.post('/admin/profile/badges/revoke', authenticate, authRateLimit, requireRole('admin', 'moderator'), async (req: AuthRequest, res: Response) => {
    try {
      const revokedBy = req.userId!;
      const { user_badge_id, reason } = req.body;

      if (!user_badge_id) {
        return res.status(400).json({ error: 'user_badge_id is required' });
      }

      const success = await profileService.revokeBadge(user_badge_id, revokedBy, reason);
      res.json({
        success,
        message: 'Badge revoked successfully'
      });
    } catch (error: any) {
      console.error('Revoke badge error:', error);
      res.status(400).json({ error: error.message || 'Failed to revoke badge' });
    }
  });

  // Badge statistics
  router.get('/admin/profile/badges/statistics', authenticate, authRateLimit, requireRole('admin', 'moderator'), async (req: Request, res: Response) => {
    try {
      const statistics = await profileService.getBadgeStatistics();
      res.json({ statistics });
    } catch (error: any) {
      console.error('Get badge statistics error:', error);
      res.status(500).json({ error: error.message || 'Failed to get statistics' });
    }
  });

  // Moderate media
  router.post('/admin/profile/media/:assetId/moderate', authenticate, authRateLimit, requireRole('admin', 'moderator'), async (req: AuthRequest, res: Response) => {
    try {
      const moderatorId = req.userId!;
      const { assetId } = req.params;
      const { status, reason } = req.body;

      if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be "approved" or "rejected"' });
      }

      await profileService.moderateMedia(assetId, moderatorId, status as ModerationStatus, reason);
      res.json({ message: 'Media moderated successfully' });
    } catch (error: any) {
      console.error('Moderate media error:', error);
      res.status(500).json({ error: error.message || 'Failed to moderate media' });
    }
  });

  // Profile statistics
  router.get('/admin/profile/statistics', authenticate, authRateLimit, requireRole('admin'), async (req: Request, res: Response) => {
    try {
      const statistics = await profileService.getProfileStatistics();
      res.json(statistics);
    } catch (error: any) {
      console.error('Get profile statistics error:', error);
      res.status(500).json({ error: error.message || 'Failed to get statistics' });
    }
  });

  // Delete user profile (GDPR - admin only)
  router.delete('/admin/profile/:userId', authenticate, authRateLimit, requireRole('admin'), async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const success = await profileService.deleteProfile(userId);
      if (!success) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      res.json({ message: 'Profile deleted successfully (GDPR)' });
    } catch (error: any) {
      console.error('Delete profile error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete profile' });
    }
  });

  return router;
}

// =====================================================
// EXAMPLE USAGE
// =====================================================

/*
import express from 'express';
import { Pool } from 'pg';
import { createProfileRouter } from './routes/profile.routes';

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(express.json());
app.use('/api', createProfileRouter(pool));

app.listen(3000, () => {
  console.log('Profile API listening on port 3000');
});
*/
