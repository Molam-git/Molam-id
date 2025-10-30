// brique-29-user-profile/api/src/services/profile/profile.service.ts
// Profile service with S3 integration, badge management, activity tracking

import { Pool } from 'pg';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// =====================================================
// TYPES
// =====================================================

export type Language = 'fr' | 'en' | 'wo' | 'ar' | 'es';
export type Currency = 'XOF' | 'USD' | 'EUR' | 'GNF' | 'CHF' | string;
export type VisibilityLevel = 'public' | 'contacts' | 'private';
export type MediaType = 'avatar' | 'banner' | 'attachment';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ModerationStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  profile_id: string;
  user_id: string;
  display_name?: string;
  bio?: string;
  country_code?: string;
  city?: string;
  avatar_url?: string;
  banner_url?: string;
  avatar_asset_id?: string;
  banner_asset_id?: string;
  preferred_language: Language;
  preferred_currency: Currency;
  visibility_level: VisibilityLevel;
  badge_count: number;
  activity_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateProfileDTO {
  display_name?: string;
  bio?: string;
  country_code?: string;
  city?: string;
  preferred_language?: Language;
  preferred_currency?: Currency;
  visibility_level?: VisibilityLevel;
}

export interface MediaAsset {
  asset_id: string;
  user_id: string;
  s3_bucket: string;
  s3_key: string;
  s3_region?: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  media_type: MediaType;
  processing_status: ProcessingStatus;
  processing_error?: string;
  variants: Record<string, any>;
  moderation_status: ModerationStatus;
  moderation_reason?: string;
  moderated_by?: string;
  moderated_at?: Date;
  signed_url?: string;
  signed_url_expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UploadMediaDTO {
  file: Buffer;
  fileName: string;
  mimeType: string;
  mediaType: MediaType;
}

export interface Badge {
  badge_id: string;
  badge_key: string;
  badge_name: string;
  description?: string;
  icon_url?: string;
  color?: string;
  subsidiary_id?: string;
  required_role?: string;
  is_revokable: boolean;
  max_count?: number;
  created_at: Date;
  is_active: boolean;
}

export interface UserBadge {
  user_badge_id: string;
  user_id: string;
  badge_id: string;
  assigned_by: string;
  assigned_at: Date;
  assigned_reason?: string;
  revoked_at?: Date;
  revoked_by?: string;
  revoked_reason?: string;
  is_visible: boolean;
  metadata: Record<string, any>;
}

export interface Activity {
  activity_id: string;
  user_id: string;
  activity_type: string;
  subsidiary_id?: string;
  activity_title: string;
  activity_subtitle?: string;
  activity_data: Record<string, any>;
  reference_type?: string;
  reference_id?: string;
  visibility: VisibilityLevel;
  created_at: Date;
}

export interface PrivacySettings {
  privacy_id: string;
  user_id: string;
  visibility_display_name: VisibilityLevel;
  visibility_bio: VisibilityLevel;
  visibility_location: VisibilityLevel;
  visibility_avatar: VisibilityLevel;
  visibility_banner: VisibilityLevel;
  visibility_badges: VisibilityLevel;
  visibility_activity: VisibilityLevel;
  allow_activity_tracking: boolean;
  allow_profile_indexing: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UpdatePrivacyDTO {
  visibility_display_name?: VisibilityLevel;
  visibility_bio?: VisibilityLevel;
  visibility_location?: VisibilityLevel;
  visibility_avatar?: VisibilityLevel;
  visibility_banner?: VisibilityLevel;
  visibility_badges?: VisibilityLevel;
  visibility_activity?: VisibilityLevel;
  allow_activity_tracking?: boolean;
  allow_profile_indexing?: boolean;
}

// =====================================================
// S3 CONFIGURATION
// =====================================================

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const S3_BUCKET = process.env.S3_BUCKET || 'molam-user-media';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';
const SIGNED_URL_TTL = 3600; // 1 hour

// =====================================================
// PROFILE SERVICE
// =====================================================

export class ProfileService {
  constructor(private pool: Pool) {}

  // =====================================================
  // PROFILE OPERATIONS
  // =====================================================

  async getProfile(userId: string, viewerId?: string): Promise<UserProfile | null> {
    const result = await this.pool.query(
      'SELECT * FROM get_user_profile($1, $2)',
      [userId, viewerId || null]
    );

    return result.rows[0] || null;
  }

  async updateProfile(userId: string, dto: UpdateProfileDTO): Promise<UserProfile> {
    const fields: string[] = [];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (dto.display_name !== undefined) {
      fields.push(`display_name = $${paramIndex++}`);
      values.push(dto.display_name);
    }
    if (dto.bio !== undefined) {
      fields.push(`bio = $${paramIndex++}`);
      values.push(dto.bio);
    }
    if (dto.country_code !== undefined) {
      fields.push(`country_code = $${paramIndex++}`);
      values.push(dto.country_code);
    }
    if (dto.city !== undefined) {
      fields.push(`city = $${paramIndex++}`);
      values.push(dto.city);
    }
    if (dto.preferred_language !== undefined) {
      fields.push(`preferred_language = $${paramIndex++}`);
      values.push(dto.preferred_language);
    }
    if (dto.preferred_currency !== undefined) {
      fields.push(`preferred_currency = $${paramIndex++}`);
      values.push(dto.preferred_currency);
    }
    if (dto.visibility_level !== undefined) {
      fields.push(`visibility_level = $${paramIndex++}`);
      values.push(dto.visibility_level);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
      UPDATE molam_user_profiles
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async deleteProfile(userId: string): Promise<boolean> {
    // Use GDPR deletion function
    const result = await this.pool.query(
      'SELECT delete_all_user_data($1)',
      [userId]
    );

    return result.rows[0].delete_all_user_data;
  }

  async exportUserData(userId: string): Promise<Record<string, any>> {
    const result = await this.pool.query(
      'SELECT get_all_user_data($1) AS data',
      [userId]
    );

    return result.rows[0].data;
  }

  // =====================================================
  // MEDIA OPERATIONS (S3)
  // =====================================================

  async uploadMedia(userId: string, dto: UploadMediaDTO): Promise<MediaAsset> {
    const assetId = uuidv4();
    const fileExtension = dto.fileName.split('.').pop();
    const s3Key = `users/${userId}/${dto.mediaType}/${assetId}.${fileExtension}`;

    try {
      // Upload to S3
      const uploadCommand = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: dto.file,
        ContentType: dto.mimeType,
        Metadata: {
          userId,
          assetId,
          originalFileName: dto.fileName
        }
      });

      await s3Client.send(uploadCommand);

      // Insert into database
      const result = await this.pool.query(
        `INSERT INTO molam_media_assets (
          asset_id, user_id, s3_bucket, s3_key, s3_region,
          file_name, file_size, mime_type, media_type,
          processing_status, moderation_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', 'pending')
        RETURNING *`,
        [
          assetId,
          userId,
          S3_BUCKET,
          s3Key,
          S3_REGION,
          dto.fileName,
          dto.file.length,
          dto.mimeType,
          dto.mediaType
        ]
      );

      const asset = result.rows[0];

      // Enqueue for async processing (would use SQS/RabbitMQ in production)
      await this.enqueueMediaProcessing(asset);

      return asset;
    } catch (error) {
      console.error('Failed to upload media:', error);
      throw new Error('Media upload failed');
    }
  }

  async getMediaAsset(assetId: string): Promise<MediaAsset | null> {
    const result = await this.pool.query(
      'SELECT * FROM molam_media_assets WHERE asset_id = $1 AND deleted_at IS NULL',
      [assetId]
    );

    return result.rows[0] || null;
  }

  async getSignedMediaUrl(assetId: string, expiresIn: number = SIGNED_URL_TTL): Promise<string> {
    const asset = await this.getMediaAsset(assetId);
    if (!asset) {
      throw new Error('Media asset not found');
    }

    // Check if cached signed URL is still valid
    if (asset.signed_url && asset.signed_url_expires_at) {
      const now = new Date();
      if (asset.signed_url_expires_at > now) {
        return asset.signed_url;
      }
    }

    // Generate new signed URL
    const command = new GetObjectCommand({
      Bucket: asset.s3_bucket,
      Key: asset.s3_key
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Cache signed URL in database
    await this.pool.query(
      'UPDATE molam_media_assets SET signed_url = $1, signed_url_expires_at = $2 WHERE asset_id = $3',
      [signedUrl, expiresAt, assetId]
    );

    return signedUrl;
  }

  async deleteMedia(assetId: string, userId: string): Promise<boolean> {
    const asset = await this.getMediaAsset(assetId);
    if (!asset || asset.user_id !== userId) {
      throw new Error('Media asset not found or unauthorized');
    }

    // Delete from S3
    const deleteCommand = new DeleteObjectCommand({
      Bucket: asset.s3_bucket,
      Key: asset.s3_key
    });

    await s3Client.send(deleteCommand);

    // Soft delete in database
    await this.pool.query(
      'UPDATE molam_media_assets SET deleted_at = NOW() WHERE asset_id = $1',
      [assetId]
    );

    return true;
  }

  async updateMediaProcessingStatus(
    assetId: string,
    status: ProcessingStatus,
    error?: string,
    variants?: Record<string, any>
  ): Promise<void> {
    const fields: string[] = ['processing_status = $2'];
    const values: any[] = [assetId, status];
    let paramIndex = 3;

    if (error !== undefined) {
      fields.push(`processing_error = $${paramIndex++}`);
      values.push(error);
    }

    if (variants !== undefined) {
      fields.push(`variants = $${paramIndex++}`);
      values.push(JSON.stringify(variants));
    }

    await this.pool.query(
      `UPDATE molam_media_assets SET ${fields.join(', ')}, updated_at = NOW() WHERE asset_id = $1`,
      values
    );
  }

  async moderateMedia(
    assetId: string,
    moderatorId: string,
    status: ModerationStatus,
    reason?: string
  ): Promise<void> {
    await this.pool.query(
      `UPDATE molam_media_assets
       SET moderation_status = $2, moderation_reason = $3, moderated_by = $4, moderated_at = NOW()
       WHERE asset_id = $1`,
      [assetId, status, reason, moderatorId]
    );
  }

  private async enqueueMediaProcessing(asset: MediaAsset): Promise<void> {
    // In production, this would publish to SQS/RabbitMQ for async worker processing
    // For now, just log
    console.log(`[MediaProcessing] Enqueued asset ${asset.asset_id} for processing`);
  }

  // =====================================================
  // BADGE OPERATIONS
  // =====================================================

  async getBadges(filters?: { subsidiaryId?: string; isActive?: boolean }): Promise<Badge[]> {
    let query = 'SELECT * FROM molam_badges WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.subsidiaryId !== undefined) {
      query += ` AND subsidiary_id = $${paramIndex++}`;
      values.push(filters.subsidiaryId);
    }

    if (filters?.isActive !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      values.push(filters.isActive);
    }

    query += ' ORDER BY badge_name';

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async getUserBadges(userId: string): Promise<Array<Badge & { assigned_at: Date }>> {
    const result = await this.pool.query(
      'SELECT * FROM get_user_badges($1)',
      [userId]
    );

    return result.rows;
  }

  async assignBadge(
    userId: string,
    badgeId: string,
    assignedBy: string,
    reason?: string
  ): Promise<string> {
    const result = await this.pool.query(
      'SELECT assign_badge($1, $2, $3, $4) AS user_badge_id',
      [userId, badgeId, assignedBy, reason]
    );

    return result.rows[0].user_badge_id;
  }

  async revokeBadge(
    userBadgeId: string,
    revokedBy: string,
    reason?: string
  ): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT revoke_badge($1, $2, $3) AS success',
      [userBadgeId, revokedBy, reason]
    );

    return result.rows[0].success;
  }

  async getBadgeStatistics(): Promise<any[]> {
    const result = await this.pool.query('SELECT * FROM v_badge_statistics ORDER BY badge_name');
    return result.rows;
  }

  // =====================================================
  // ACTIVITY OPERATIONS
  // =====================================================

  async logActivity(
    userId: string,
    activityType: string,
    activityTitle: string,
    options?: {
      activitySubtitle?: string;
      subsidiaryId?: string;
      activityData?: Record<string, any>;
      referenceType?: string;
      referenceId?: string;
      visibility?: VisibilityLevel;
    }
  ): Promise<string | null> {
    const result = await this.pool.query(
      `SELECT log_user_activity($1, $2, $3, $4, $5, $6, $7, $8, $9) AS activity_id`,
      [
        userId,
        activityType,
        activityTitle,
        options?.activitySubtitle || null,
        options?.subsidiaryId || null,
        JSON.stringify(options?.activityData || {}),
        options?.referenceType || null,
        options?.referenceId || null,
        options?.visibility || 'contacts'
      ]
    );

    return result.rows[0].activity_id;
  }

  async getUserActivity(
    userId: string,
    viewerId?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<Activity[]> {
    const result = await this.pool.query(
      'SELECT * FROM get_user_activity_feed($1, $2, $3, $4)',
      [userId, viewerId || null, limit, offset]
    );

    return result.rows;
  }

  async deleteActivity(activityId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM molam_user_activity WHERE activity_id = $1 AND user_id = $2',
      [activityId, userId]
    );

    return result.rowCount ? result.rowCount > 0 : false;
  }

  // =====================================================
  // PRIVACY OPERATIONS
  // =====================================================

  async getPrivacySettings(userId: string): Promise<PrivacySettings | null> {
    const result = await this.pool.query(
      'SELECT * FROM molam_user_privacy WHERE user_id = $1',
      [userId]
    );

    return result.rows[0] || null;
  }

  async updatePrivacySettings(userId: string, dto: UpdatePrivacyDTO): Promise<PrivacySettings> {
    const fields: string[] = [];
    const values: any[] = [userId];
    let paramIndex = 2;

    const validFields: Array<keyof UpdatePrivacyDTO> = [
      'visibility_display_name',
      'visibility_bio',
      'visibility_location',
      'visibility_avatar',
      'visibility_banner',
      'visibility_badges',
      'visibility_activity',
      'allow_activity_tracking',
      'allow_profile_indexing'
    ];

    for (const field of validFields) {
      if (dto[field] !== undefined) {
        fields.push(`${field} = $${paramIndex++}`);
        values.push(dto[field]);
      }
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
      UPDATE molam_user_privacy
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // =====================================================
  // STATISTICS
  // =====================================================

  async getProfileStatistics(): Promise<{
    total_profiles: number;
    profiles_with_avatar: number;
    profiles_with_banner: number;
    profiles_with_bio: number;
    total_badges_assigned: number;
    total_activities: number;
    media_storage_bytes: number;
  }> {
    const result = await this.pool.query(`
      SELECT
        (SELECT COUNT(*) FROM molam_user_profiles) AS total_profiles,
        (SELECT COUNT(*) FROM molam_user_profiles WHERE avatar_url IS NOT NULL) AS profiles_with_avatar,
        (SELECT COUNT(*) FROM molam_user_profiles WHERE banner_url IS NOT NULL) AS profiles_with_banner,
        (SELECT COUNT(*) FROM molam_user_profiles WHERE bio IS NOT NULL) AS profiles_with_bio,
        (SELECT COUNT(*) FROM molam_user_badges WHERE revoked_at IS NULL) AS total_badges_assigned,
        (SELECT COUNT(*) FROM molam_user_activity) AS total_activities,
        (SELECT COALESCE(SUM(file_size), 0) FROM molam_media_assets WHERE deleted_at IS NULL) AS media_storage_bytes
    `);

    return result.rows[0];
  }
}
