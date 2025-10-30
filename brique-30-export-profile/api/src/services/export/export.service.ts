// brique-30-export-profile/api/src/services/export/export.service.ts
// GDPR-compliant profile export service with JSON and PDF generation

import { Pool } from 'pg';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

// =====================================================
// TYPES
// =====================================================

export type ExportFormat = 'json' | 'pdf';
export type ExportStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'expired';
export type ExportSection = 'profile' | 'badges' | 'activity' | 'media' | 'privacy' | 'devices' | 'transactions_pay' | 'orders_eats' | 'orders_shop' | 'kyc';

export interface ExportRequest {
  user_id: string;
  format: ExportFormat;
  include_sections?: ExportSection[];
  requested_by?: string;  // For admin requests
  ip_address?: string;
  user_agent?: string;
}

export interface Export {
  export_id: number;
  user_id: string;
  format: ExportFormat;
  status: ExportStatus;
  storage_key?: string;
  storage_size?: number;
  checksum_sha256?: string;
  signature_hmac?: string;
  requested_at: Date;
  completed_at?: Date;
  expires_at?: Date;
  error_message?: string;
  downloaded_count: number;
}

export interface ProfileData {
  user: {
    user_id: string;
    email: string;
    phone_e164?: string;
    first_name?: string;
    last_name?: string;
    preferred_language: string;
    preferred_currency: string;
    created_at: Date;
  };
  profile?: {
    display_name?: string;
    bio?: string;
    country_code?: string;
    city?: string;
    avatar_url?: string;
    banner_url?: string;
    badge_count: number;
    activity_count: number;
  };
  badges: Array<{
    badge_key: string;
    badge_name: string;
    description?: string;
    assigned_at: Date;
  }>;
  activity: Array<{
    activity_type: string;
    activity_title: string;
    subsidiary_id?: string;
    created_at: Date;
  }>;
  privacy?: {
    visibility_display_name: string;
    visibility_bio: string;
    visibility_location: string;
    allow_activity_tracking: boolean;
    allow_profile_indexing: boolean;
  };
  devices?: Array<{
    device_type: string;
    device_name?: string;
    last_seen: Date;
    is_trusted: boolean;
  }>;
  media?: Array<{
    file_name: string;
    mime_type: string;
    file_size: number;
    created_at: Date;
  }>;
}

// =====================================================
// EXPORT SERVICE
// =====================================================

export class ExportService {
  private readonly EXPORT_SECRET: string;
  private readonly S3_BUCKET: string;
  private readonly EXPORT_EXPIRY_DAYS: number = 7;
  private readonly SIGNED_URL_TTL: number = 3600; // 1 hour

  constructor(
    private pool: Pool,
    private s3Client: S3Client,
    config: {
      exportSecret: string;
      s3Bucket: string;
      expiryDays?: number;
    }
  ) {
    this.EXPORT_SECRET = config.exportSecret;
    this.S3_BUCKET = config.s3Bucket;
    if (config.expiryDays) this.EXPORT_EXPIRY_DAYS = config.expiryDays;
  }

  // =====================================================
  // REQUEST EXPORT
  // =====================================================

  async requestExport(request: ExportRequest): Promise<{ export_id: number; status: string }> {
    const sections = request.include_sections || ['profile', 'badges', 'activity'];

    const result = await this.pool.query(
      `SELECT request_profile_export($1, $2, $3, $4, $5, $6) AS export_id`,
      [
        request.user_id,
        request.format,
        JSON.stringify(sections),
        request.requested_by || request.user_id,
        request.ip_address || null,
        request.user_agent || null
      ]
    );

    const exportId = result.rows[0].export_id;

    console.log(`[ExportService] Export requested: ${exportId} (user: ${request.user_id}, format: ${request.format})`);

    return {
      export_id: exportId,
      status: 'pending'
    };
  }

  // =====================================================
  // PROCESS EXPORT (called by worker)
  // =====================================================

  async processExport(exportId: number): Promise<void> {
    try {
      console.log(`[ExportService] Processing export ${exportId}`);

      // Get export details
      const exportResult = await this.pool.query(
        `SELECT export_id, user_id, format, include_sections
         FROM molam_profile_exports
         WHERE export_id = $1 AND status = 'pending'`,
        [exportId]
      );

      if (exportResult.rows.length === 0) {
        console.log(`[ExportService] Export ${exportId} not found or not pending`);
        return;
      }

      const exportData = exportResult.rows[0];
      const { user_id, format, include_sections } = exportData;

      // Mark as processing
      await this.updateExportStatus(exportId, 'processing');

      // Gather user data
      const profileData = await this.gatherProfileData(user_id, include_sections);

      // Generate export file
      let buffer: Buffer;
      let signature: string | null = null;

      if (format === 'json') {
        const result = await this.generateJSON(profileData);
        buffer = result.buffer;
        signature = result.signature;
      } else {
        buffer = await this.generatePDF(profileData);
      }

      // Upload to S3
      const storageKey = `exports/${user_id}/${exportId}.${format}`;
      await this.uploadToS3(storageKey, buffer, format);

      // Calculate checksum
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

      // Update export status
      await this.pool.query(
        `SELECT update_export_status($1, 'ready', $2, $3, $4, $5, NULL)`,
        [exportId, storageKey, buffer.length, checksum, signature]
      );

      console.log(`[ExportService] Export ${exportId} completed successfully`);
    } catch (error: any) {
      console.error(`[ExportService] Failed to process export ${exportId}:`, error);

      await this.pool.query(
        `SELECT update_export_status($1, 'failed', NULL, NULL, NULL, NULL, $2)`,
        [exportId, error.message]
      );
    }
  }

  // =====================================================
  // GET DOWNLOAD URL
  // =====================================================

  async getDownloadUrl(userId: string, exportId: number): Promise<{ url: string; expires_at: Date; format: string; size: number }> {
    const result = await this.pool.query(
      `SELECT * FROM get_export_status($1, $2)`,
      [exportId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Export not found');
    }

    const exp = result.rows[0];

    if (exp.status !== 'ready') {
      throw new Error(`Export not ready (status: ${exp.status})`);
    }

    if (new Date(exp.expires_at) < new Date()) {
      throw new Error('Export has expired');
    }

    // Get storage key
    const keyResult = await this.pool.query(
      `SELECT storage_key, format, storage_size FROM molam_profile_exports WHERE export_id = $1`,
      [exportId]
    );

    const { storage_key, format, storage_size } = keyResult.rows[0];

    // Generate signed URL
    const command = new GetObjectCommand({
      Bucket: this.S3_BUCKET,
      Key: storage_key
    });

    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn: this.SIGNED_URL_TTL
    });

    // Mark as downloaded
    await this.pool.query(
      `SELECT mark_export_downloaded($1, $2)`,
      [exportId, userId]
    );

    return {
      url,
      expires_at: exp.expires_at,
      format,
      size: storage_size
    };
  }

  // =====================================================
  // GET EXPORT STATUS
  // =====================================================

  async getExportStatus(userId: string, exportId: number): Promise<Export | null> {
    const result = await this.pool.query(
      `SELECT * FROM get_export_status($1, $2)`,
      [exportId, userId]
    );

    return result.rows[0] || null;
  }

  // =====================================================
  // LIST USER EXPORTS
  // =====================================================

  async listUserExports(userId: string, limit: number = 10): Promise<Export[]> {
    const result = await this.pool.query(
      `SELECT export_id, user_id, format, status, requested_at, completed_at, expires_at,
              storage_size, downloaded_count, error_message
       FROM molam_profile_exports
       WHERE user_id = $1
       ORDER BY requested_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  // =====================================================
  // GET EXPORT STATISTICS
  // =====================================================

  async getExportStatistics(userId?: string, days: number = 30): Promise<any> {
    const result = await this.pool.query(
      `SELECT * FROM get_export_statistics($1, $2)`,
      [userId || null, days]
    );

    return result.rows[0];
  }

  // =====================================================
  // CLEANUP EXPIRED EXPORTS
  // =====================================================

  async cleanupExpiredExports(): Promise<number> {
    // Mark expired
    const result = await this.pool.query(
      `SELECT * FROM cleanup_expired_exports()`
    );

    const count = result.rows[0].deleted_count;

    if (count > 0) {
      console.log(`[ExportService] Marked ${count} exports as expired`);
    }

    // Delete S3 files for expired exports
    const expiredResult = await this.pool.query(
      `SELECT storage_key FROM molam_profile_exports
       WHERE status = 'expired' AND storage_key IS NOT NULL
       AND expires_at < NOW() - INTERVAL '1 day'
       LIMIT 100`
    );

    for (const row of expiredResult.rows) {
      try {
        await this.deleteFromS3(row.storage_key);
        console.log(`[ExportService] Deleted expired export from S3: ${row.storage_key}`);
      } catch (error) {
        console.error(`[ExportService] Failed to delete S3 file ${row.storage_key}:`, error);
      }
    }

    return count;
  }

  // =====================================================
  // PRIVATE: GATHER PROFILE DATA
  // =====================================================

  private async gatherProfileData(userId: string, sections: string[]): Promise<ProfileData> {
    const data: ProfileData = {
      user: {} as any,
      badges: [],
      activity: []
    };

    // Always include user basic info
    const userResult = await this.pool.query(
      `SELECT user_id, email, phone_e164, first_name, last_name,
              preferred_language, preferred_currency, created_at
       FROM molam_users
       WHERE user_id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    data.user = userResult.rows[0];

    // Profile section
    if (sections.includes('profile')) {
      const profileResult = await this.pool.query(
        `SELECT display_name, bio, country_code, city, avatar_url, banner_url,
                badge_count, activity_count
         FROM molam_user_profiles
         WHERE user_id = $1`,
        [userId]
      );

      if (profileResult.rows.length > 0) {
        data.profile = profileResult.rows[0];
      }
    }

    // Badges section
    if (sections.includes('badges')) {
      const badgesResult = await this.pool.query(
        `SELECT b.badge_key, b.badge_name, b.description, ub.assigned_at
         FROM molam_user_badges ub
         JOIN molam_badges b ON ub.badge_id = b.badge_id
         WHERE ub.user_id = $1 AND ub.revoked_at IS NULL
         ORDER BY ub.assigned_at DESC`,
        [userId]
      );

      data.badges = badgesResult.rows;
    }

    // Activity section (last 90 days, anonymized)
    if (sections.includes('activity')) {
      const activityResult = await this.pool.query(
        `SELECT activity_type, activity_title, subsidiary_id, created_at
         FROM molam_user_activity
         WHERE user_id = $1
           AND created_at > NOW() - INTERVAL '90 days'
         ORDER BY created_at DESC
         LIMIT 100`,
        [userId]
      );

      data.activity = activityResult.rows;
    }

    // Privacy section
    if (sections.includes('privacy')) {
      const privacyResult = await this.pool.query(
        `SELECT visibility_display_name, visibility_bio, visibility_location,
                allow_activity_tracking, allow_profile_indexing
         FROM molam_user_privacy
         WHERE user_id = $1`,
        [userId]
      );

      if (privacyResult.rows.length > 0) {
        data.privacy = privacyResult.rows[0];
      }
    }

    // Devices section
    if (sections.includes('devices')) {
      const devicesResult = await this.pool.query(
        `SELECT device_type, device_name, last_seen, is_trusted
         FROM molam_user_devices
         WHERE user_id = $1
         ORDER BY last_seen DESC
         LIMIT 20`,
        [userId]
      );

      data.devices = devicesResult.rows;
    }

    // Media section
    if (sections.includes('media')) {
      const mediaResult = await this.pool.query(
        `SELECT file_name, mime_type, file_size, created_at
         FROM molam_media_assets
         WHERE user_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      );

      data.media = mediaResult.rows;
    }

    return data;
  }

  // =====================================================
  // PRIVATE: GENERATE JSON
  // =====================================================

  private async generateJSON(data: ProfileData): Promise<{ buffer: Buffer; signature: string }> {
    const jsonData = JSON.stringify(
      {
        export_metadata: {
          generated_at: new Date().toISOString(),
          export_version: '1.0',
          data_compliance: 'GDPR, CCPA, BCEAO',
          source: 'Molam ID Platform'
        },
        data
      },
      null,
      2
    );

    // Generate HMAC signature
    const signature = crypto
      .createHmac('sha256', this.EXPORT_SECRET)
      .update(jsonData)
      .digest('hex');

    const finalJson = JSON.stringify(
      {
        export_metadata: {
          generated_at: new Date().toISOString(),
          export_version: '1.0',
          data_compliance: 'GDPR, CCPA, BCEAO',
          source: 'Molam ID Platform',
          signature_hmac_sha256: signature
        },
        data,
        signature: signature
      },
      null,
      2
    );

    return {
      buffer: Buffer.from(finalJson, 'utf-8'),
      signature
    };
  }

  // =====================================================
  // PRIVATE: GENERATE PDF
  // =====================================================

  private async generatePDF(data: ProfileData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header with Molam branding
      doc.fontSize(24).fillColor('#10B981').text('Molam', { align: 'center' });
      doc.fontSize(16).fillColor('#000000').text('Personal Data Export', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#6B7280').text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(2);

      // Watermark
      doc.fontSize(8).fillColor('#E5E7EB').text('Molam Confidential - GDPR Export', { align: 'center' });
      doc.moveDown(1);

      // User Information
      doc.fontSize(16).fillColor('#000000').text('User Information', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('#374151');
      doc.text(`User ID: ${data.user.user_id}`);
      doc.text(`Email: ${data.user.email}`);
      if (data.user.phone_e164) doc.text(`Phone: ${data.user.phone_e164}`);
      if (data.user.first_name) doc.text(`Name: ${data.user.first_name} ${data.user.last_name || ''}`);
      doc.text(`Preferred Language: ${data.user.preferred_language.toUpperCase()}`);
      doc.text(`Preferred Currency: ${data.user.preferred_currency}`);
      doc.text(`Account Created: ${new Date(data.user.created_at).toLocaleDateString()}`);
      doc.moveDown(2);

      // Profile Information
      if (data.profile) {
        doc.fontSize(16).fillColor('#000000').text('Profile', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#374151');
        if (data.profile.display_name) doc.text(`Display Name: ${data.profile.display_name}`);
        if (data.profile.bio) doc.text(`Bio: ${data.profile.bio}`);
        if (data.profile.country_code) doc.text(`Location: ${data.profile.city || ''}, ${data.profile.country_code}`);
        doc.text(`Badges: ${data.profile.badge_count}`);
        doc.text(`Activities: ${data.profile.activity_count}`);
        doc.moveDown(2);
      }

      // Badges
      if (data.badges.length > 0) {
        doc.fontSize(16).fillColor('#000000').text('Badges & Achievements', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#374151');
        data.badges.forEach((badge) => {
          doc.text(`• ${badge.badge_name} (${badge.badge_key})`);
          if (badge.description) doc.fontSize(10).fillColor('#6B7280').text(`  ${badge.description}`);
          doc.fontSize(12).fillColor('#374151');
          doc.text(`  Earned: ${new Date(badge.assigned_at).toLocaleDateString()}`);
        });
        doc.moveDown(2);
      }

      // Activity History
      if (data.activity.length > 0) {
        doc.fontSize(16).fillColor('#000000').text('Activity History (Last 90 Days)', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#374151');
        data.activity.slice(0, 20).forEach((activity) => {
          doc.text(`• ${activity.activity_title} - ${new Date(activity.created_at).toLocaleDateString()}`);
        });
        if (data.activity.length > 20) {
          doc.moveDown(0.5);
          doc.text(`... and ${data.activity.length - 20} more activities`);
        }
        doc.moveDown(2);
      }

      // Privacy Settings
      if (data.privacy) {
        doc.fontSize(16).fillColor('#000000').text('Privacy Settings', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#374151');
        doc.text(`Display Name Visibility: ${data.privacy.visibility_display_name}`);
        doc.text(`Bio Visibility: ${data.privacy.visibility_bio}`);
        doc.text(`Location Visibility: ${data.privacy.visibility_location}`);
        doc.text(`Activity Tracking: ${data.privacy.allow_activity_tracking ? 'Enabled' : 'Disabled'}`);
        doc.text(`Profile Indexing: ${data.privacy.allow_profile_indexing ? 'Enabled' : 'Disabled'}`);
        doc.moveDown(2);
      }

      // Footer
      doc.fontSize(8).fillColor('#9CA3AF');
      doc.text('This export contains your personal data as stored in the Molam platform.', { align: 'center' });
      doc.text('Generated in compliance with GDPR, CCPA, and BCEAO regulations.', { align: 'center' });
      doc.text('For questions, contact: privacy@molam.com', { align: 'center' });

      doc.end();
    });
  }

  // =====================================================
  // PRIVATE: S3 OPERATIONS
  // =====================================================

  private async uploadToS3(key: string, buffer: Buffer, format: ExportFormat): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: format === 'json' ? 'application/json' : 'application/pdf',
      ServerSideEncryption: 'AES256',
      Metadata: {
        'generated-at': new Date().toISOString(),
        'export-version': '1.0'
      }
    });

    await this.s3Client.send(command);
  }

  private async deleteFromS3(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.S3_BUCKET,
      Key: key
    });

    await this.s3Client.send(command);
  }

  // =====================================================
  // PRIVATE: HELPERS
  // =====================================================

  private async updateExportStatus(exportId: number, status: ExportStatus): Promise<void> {
    await this.pool.query(
      `SELECT update_export_status($1, $2, NULL, NULL, NULL, NULL, NULL)`,
      [exportId, status]
    );
  }
}
