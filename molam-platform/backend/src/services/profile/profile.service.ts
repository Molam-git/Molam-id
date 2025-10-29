import { Pool } from "pg";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type UserID = string;

export class ProfileService {
    constructor(private db: Pool, private s3: S3Client, private bucket: string) { }

    async getMyProfile(userId: UserID) {
        const { rows } = await this.db.query(
            `SELECT u.id, u.email, u.phone, u.preferred_currency, u.preferred_language,
              p.display_name, p.bio, p.country_code, p.city, p.avatar_key, p.banner_key,
              pr.show_badges, pr.show_activity, pr.show_country, pr.show_display_name
       FROM molam_users u
       LEFT JOIN molam_user_profiles p ON p.user_id = u.id
       LEFT JOIN molam_user_privacy pr ON pr.user_id = u.id
       WHERE u.id = $1`, [userId]);
        return rows[0] ?? null;
    }

    async getPublicProfile(targetUserId: UserID) {
        const { rows } = await this.db.query(
            `SELECT p.display_name, 
              CASE WHEN pr.show_country THEN p.country_code ELSE NULL END AS country_code,
              CASE WHEN pr.show_display_name THEN p.display_name ELSE NULL END AS name_visible,
              p.avatar_key
       FROM molam_user_profiles p
       LEFT JOIN molam_user_privacy pr ON pr.user_id = p.user_id
       WHERE p.user_id = $1`, [targetUserId]);
        const profile = rows[0] ?? null;

        const badges = await this.db.query(
            `SELECT b.code, b.name, b.icon_key
       FROM molam_user_badges ub
       JOIN molam_badges b ON b.id = ub.badge_id
       LEFT JOIN molam_user_privacy pr ON pr.user_id = ub.user_id
       WHERE ub.user_id = $1 
         AND (pr.show_badges IS NULL OR pr.show_badges = TRUE)
         AND (ub.valid_to IS NULL OR ub.valid_to > NOW())`,
            [targetUserId]
        );
        return { profile, badges: badges.rows };
    }

    async updateProfile(userId: UserID, patch: {
        display_name?: string; bio?: string; country_code?: string; city?: string;
    }) {
        await this.db.query(
            `INSERT INTO molam_user_profiles (user_id, display_name, bio, country_code, city)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id) DO UPDATE
         SET display_name = COALESCE(EXCLUDED.display_name, molam_user_profiles.display_name),
             bio          = COALESCE(EXCLUDED.bio, molam_user_profiles.bio),
             country_code = COALESCE(EXCLUDED.country_code, molam_user_profiles.country_code),
             city         = COALESCE(EXCLUDED.city, molam_user_profiles.city)`,
            [userId, patch.display_name ?? null, patch.bio ?? null, patch.country_code ?? null, patch.city ?? null]
        );
        await this.db.query(
            `INSERT INTO molam_audit_logs (user_id, action, details)
       VALUES ($1,'profile.update', $2)`,
            [userId, patch]
        );
        return this.getMyProfile(userId);
    }

    async updatePrivacy(userId: UserID, patch: Partial<{ show_badges: boolean; show_activity: boolean; show_country: boolean; show_display_name: boolean; }>) {
        await this.db.query(
            `INSERT INTO molam_user_privacy (user_id, show_badges, show_activity, show_country, show_display_name)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id) DO UPDATE
         SET show_badges = COALESCE(EXCLUDED.show_badges, molam_user_privacy.show_badges),
             show_activity = COALESCE(EXCLUDED.show_activity, molam_user_privacy.show_activity),
             show_country = COALESCE(EXCLUDED.show_country, molam_user_privacy.show_country),
             show_display_name = COALESCE(EXCLUDED.show_display_name, molam_user_privacy.show_display_name),
             updated_at = NOW()`,
            [userId, patch.show_badges ?? null, patch.show_activity ?? null, patch.show_country ?? null, patch.show_display_name ?? null]
        );
        return true;
    }

    async createAvatarUploadUrl(userId: UserID, mime: string) {
        const ext = mime.split("/")[1] ?? "jpg";
        const key = `profiles/${userId}/avatar/original-${Date.now()}.${ext}`;
        const putCmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mime });
        const url = await getSignedUrl(this.s3, putCmd, { expiresIn: 60 * 5 });
        return { key, url };
    }

    async confirmAvatar(userId: UserID, key: string, etag?: string) {
        await this.db.query(
            `UPDATE molam_user_profiles SET avatar_key = $2, avatar_etag = $3 WHERE user_id = $1`,
            [userId, key, etag ?? null]
        );
        await this.db.query(
            `INSERT INTO molam_media_assets (owner_id, kind, storage_key, mime, size_bytes, status)
       VALUES ($1,'avatar',$2,'image/*',0,'uploaded')`,
            [userId, key]
        );
        return { ok: true };
    }

    async appendActivity(userId: UserID, module: string, action: string, refId?: string, metadata?: object, ip?: string, deviceId?: string) {
        await this.db.query(
            `INSERT INTO molam_user_activity (user_id, module, action, ref_id, metadata, ip, device_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [userId, module, action, refId ?? null, metadata ?? null, ip ?? null, deviceId ?? null]
        );
        return true;
    }

    async listActivity(requestorId: UserID | null, targetUserId: UserID, limit = 30, since?: string) {
        const { rows: p } = await this.db.query(`SELECT show_activity FROM molam_user_privacy WHERE user_id=$1`, [targetUserId]);
        const allowed = requestorId === targetUserId || (p[0]?.show_activity ?? false);
        if (!allowed) return [];
        const { rows } = await this.db.query(
            `SELECT module, action, ref_id, metadata, created_at
       FROM molam_user_activity
       WHERE user_id = $1 AND ($2::TIMESTAMPTZ IS NULL OR created_at > $2)
       ORDER BY created_at DESC LIMIT $3`,
            [targetUserId, since ?? null, limit]
        );
        return rows;
    }

    async createBadge(actorId: UserID, badge: { code: string; name: string; description?: string; icon_key?: string; owner_module: string; }) {
        await this.db.query(
            `INSERT INTO molam_badges (code, name, description, icon_key, owner_module, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
            [badge.code, badge.name, badge.description ?? null, badge.icon_key ?? null, badge.owner_module, actorId]
        );
        return true;
    }

    async assignBadge(actorId: UserID, userId: UserID, badgeCode: string, valid_to?: string, reason?: string) {
        const { rows: b } = await this.db.query(`SELECT id, owner_module FROM molam_badges WHERE code=$1 AND is_active=true`, [badgeCode]);
        if (!b.length) throw new Error("badge_not_found");
        await this.db.query(
            `INSERT INTO molam_user_badges (user_id, badge_id, granted_by, valid_to, reason)
       VALUES ($1,$2,$3,$4,$5)`,
            [userId, b[0].id, actorId, valid_to ?? null, reason ?? null]
        );
        await this.db.query(
            `INSERT INTO molam_audit_logs (user_id, action, details)
       VALUES ($1,'badge.assign', $2)`,
            [actorId, { to: userId, badge: badgeCode, valid_to, reason }]
        );
        return true;
    }
}