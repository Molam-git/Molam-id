// api/src/services/ui.service.ts
// Business logic for Molam ID UI Management

import { Pool } from 'pg';
import type {
  UserProfile,
  UserSettings,
  UpdateSettingsDTO,
  UserDevice,
  SessionInfo,
  UserNotification,
  AuditLogEntry,
  UserRole,
  ChangePasswordDTO,
  Setup2FADTO,
  Verify2FADTO,
  TrustDeviceDTO,
  ExportRequestDTO,
  DeleteAccountDTO,
  ServiceError
} from '../types';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// ============================================================================
// PROFILE & SETTINGS
// ============================================================================

export async function getUserProfile(userId: string): Promise<UserProfile & { settings: UserSettings }> {
  const result = await pool.query(`
    SELECT
      u.id, u.display_name, u.email, u.phone, u.user_type, u.kyc_level, u.created_at,
      s.language_code, s.currency_code, s.country_code, s.time_zone, s.theme, s.accessibility
    FROM molam_users u
    LEFT JOIN molam_user_settings s ON s.user_id = u.id
    WHERE u.id = $1
  `, [userId]);

  if (result.rows.length === 0) {
    const error: ServiceError = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    display_name: row.display_name,
    email: row.email,
    phone: row.phone,
    user_type: row.user_type,
    kyc_level: row.kyc_level,
    created_at: row.created_at,
    settings: {
      user_id: row.id,
      language_code: row.language_code || 'fr',
      currency_code: row.currency_code || 'XOF',
      country_code: row.country_code || 'SN',
      time_zone: row.time_zone || 'Africa/Dakar',
      theme: row.theme || 'system',
      accessibility: row.accessibility || {},
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  };
}

export async function updateUserSettings(userId: string, dto: UpdateSettingsDTO): Promise<UserSettings> {
  const fields: string[] = [];
  const values: any[] = [userId];
  let paramIndex = 2;

  if (dto.language_code !== undefined) {
    fields.push(`language_code = $${paramIndex++}`);
    values.push(dto.language_code);
  }
  if (dto.currency_code !== undefined) {
    fields.push(`currency_code = $${paramIndex++}`);
    values.push(dto.currency_code);
  }
  if (dto.country_code !== undefined) {
    fields.push(`country_code = $${paramIndex++}`);
    values.push(dto.country_code);
  }
  if (dto.time_zone !== undefined) {
    fields.push(`time_zone = $${paramIndex++}`);
    values.push(dto.time_zone);
  }
  if (dto.theme !== undefined) {
    fields.push(`theme = $${paramIndex++}`);
    values.push(dto.theme);
  }
  if (dto.accessibility !== undefined) {
    fields.push(`accessibility = $${paramIndex++}`);
    values.push(JSON.stringify(dto.accessibility));
  }

  if (fields.length === 0) {
    const error: ServiceError = new Error('No fields to update');
    error.statusCode = 400;
    throw error;
  }

  fields.push(`updated_at = NOW()`);

  const query = `
    INSERT INTO molam_user_settings(user_id, ${Object.keys(dto).join(', ')})
    VALUES($1, ${values.slice(1).map((_, i) => `$${i + 2}`).join(', ')})
    ON CONFLICT(user_id) DO UPDATE SET ${fields.join(', ')}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
}

// ============================================================================
// SECURITY - SESSIONS
// ============================================================================

export async function getUserSessions(userId: string): Promise<SessionInfo[]> {
  const result = await pool.query(`
    SELECT
      id, user_id, device_id, device_type, device_name,
      ip_address, geo_country, created_at, last_seen,
      revoked_at, is_active
    FROM molam_sessions_active
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 50
  `, [userId]);

  return result.rows;
}

export async function revokeUserSession(userId: string, sessionId: string): Promise<void> {
  const result = await pool.query(`
    UPDATE molam_sessions_active
    SET revoked_at = NOW(), is_active = FALSE
    WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
  `, [sessionId, userId]);

  if (result.rowCount === 0) {
    const error: ServiceError = new Error('Session not found or already revoked');
    error.statusCode = 404;
    throw error;
  }

  // Create security notification
  await pool.query(`
    SELECT create_security_notification(
      $1::UUID,
      'Session Revoked',
      'You have revoked a session.',
      'info'
    )
  `, [userId]);
}

// ============================================================================
// SECURITY - DEVICES
// ============================================================================

export async function getUserDevices(userId: string): Promise<UserDevice[]> {
  const result = await pool.query(`
    SELECT *
    FROM molam_user_devices
    WHERE user_id = $1 AND revoked_at IS NULL
    ORDER BY last_seen_at DESC
  `, [userId]);

  return result.rows;
}

export async function trustDevice(userId: string, dto: TrustDeviceDTO): Promise<void> {
  const result = await pool.query(`
    UPDATE molam_user_devices
    SET is_trusted = $1
    WHERE device_id = $2 AND user_id = $3 AND revoked_at IS NULL
  `, [dto.trust, dto.device_id, userId]);

  if (result.rowCount === 0) {
    const error: ServiceError = new Error('Device not found');
    error.statusCode = 404;
    throw error;
  }
}

export async function revokeDevice(userId: string, deviceId: string): Promise<void> {
  const result = await pool.query(`
    UPDATE molam_user_devices
    SET revoked_at = NOW()
    WHERE device_id = $1 AND user_id = $2 AND revoked_at IS NULL
  `, [deviceId, userId]);

  if (result.rowCount === 0) {
    const error: ServiceError = new Error('Device not found or already revoked');
    error.statusCode = 404;
    throw error;
  }

  // Also revoke all sessions from this device
  await pool.query(`
    UPDATE molam_sessions_active
    SET revoked_at = NOW(), is_active = FALSE
    WHERE device_id = $1 AND user_id = $2 AND revoked_at IS NULL
  `, [deviceId, userId]);

  // Create security notification
  await pool.query(`
    SELECT create_security_notification(
      $1::UUID,
      'Device Revoked',
      'You have revoked a device and all its active sessions.',
      'warning',
      '/security/devices',
      'View Devices'
    )
  `, [userId]);
}

// ============================================================================
// SECURITY - 2FA
// ============================================================================

export async function setup2FA(userId: string, dto: Setup2FADTO): Promise<{ secret?: string; qr?: string }> {
  // This is a stub - actual implementation would integrate with Brique 11 (2FA/MFA)
  // For now, return mock data
  if (dto.method === 'totp') {
    return {
      secret: 'JBSWY3DPEHPK3PXP', // Mock TOTP secret
      qr: 'data:image/png;base64,...' // Mock QR code
    };
  }
  return {};
}

export async function verify2FA(userId: string, dto: Verify2FADTO): Promise<boolean> {
  // This is a stub - actual implementation would integrate with Brique 11 (2FA/MFA)
  // For now, just return true if code is 6 digits
  return dto.code.length === 6;
}

// ============================================================================
// SECURITY - PASSWORD
// ============================================================================

export async function changePassword(userId: string, dto: ChangePasswordDTO): Promise<void> {
  // This is a stub - actual implementation would integrate with password service
  // Should verify current password, hash new password with Argon2id, update DB

  // Create security notification
  await pool.query(`
    SELECT create_security_notification(
      $1::UUID,
      'Password Changed',
      'Your password has been successfully changed.',
      'info'
    )
  `, [userId]);
}

// ============================================================================
// ROLES
// ============================================================================

export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const result = await pool.query(`
    SELECT
      rg.module_scope AS module,
      r.name AS role,
      r.trusted_level,
      rg.scope,
      rg.granted_at,
      rg.expires_at
    FROM molam_role_grants rg
    JOIN molam_roles_v2 r ON r.id = rg.role_id
    WHERE rg.user_id = $1
      AND (rg.expires_at IS NULL OR rg.expires_at > NOW())
      AND rg.revoked_at IS NULL
    ORDER BY rg.module_scope, r.trusted_level DESC
  `, [userId]);

  return result.rows;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export async function getUserNotifications(userId: string, limit: number = 50): Promise<UserNotification[]> {
  const result = await pool.query(`
    SELECT *
    FROM molam_user_notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [userId, limit]);

  return result.rows;
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const result = await pool.query(`
    SELECT mark_notification_read($1::UUID, $2::UUID)
  `, [notificationId, userId]);

  if (!result.rows[0].mark_notification_read) {
    const error: ServiceError = new Error('Notification not found or already read');
    error.statusCode = 404;
    throw error;
  }
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const result = await pool.query(`
    SELECT get_unread_notification_count($1::UUID) AS count
  `, [userId]);

  return result.rows[0].count;
}

// ============================================================================
// AUDIT
// ============================================================================

export async function getUserAuditLogs(userId: string, limit: number = 100): Promise<AuditLogEntry[]> {
  const result = await pool.query(`
    SELECT id, user_id, action, context, ip_address, user_agent, created_at
    FROM molam_user_audit_view
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [userId, limit]);

  return result.rows;
}

// ============================================================================
// COMPLIANCE - EXPORT
// ============================================================================

export async function requestDataExport(userId: string, dto: ExportRequestDTO): Promise<{ request_id: string }> {
  // This is a stub - actual implementation would:
  // 1. Create export request in DB
  // 2. Queue background job to generate export
  // 3. Notify user when ready
  // Integration with Brique 19 (GDPR export)

  const requestId = `export-${Date.now()}-${userId.slice(0, 8)}`;

  // Create notification
  await pool.query(`
    SELECT create_security_notification(
      $1::UUID,
      'Data Export Requested',
      'Your data export request has been queued. You will be notified when ready.',
      'info'
    )
  `, [userId]);

  return { request_id: requestId };
}

// ============================================================================
// COMPLIANCE - DELETE
// ============================================================================

export async function requestAccountDeletion(userId: string, dto: DeleteAccountDTO): Promise<{ request_id: string }> {
  // This is a stub - actual implementation would:
  // 1. Verify password
  // 2. Create deletion request with 30-day grace period
  // 3. Schedule deletion job
  // 4. Notify user

  const requestId = `delete-${Date.now()}-${userId.slice(0, 8)}`;

  // Create critical notification
  await pool.query(`
    SELECT create_security_notification(
      $1::UUID,
      'Account Deletion Requested',
      'Your account deletion has been requested. You have 30 days to cancel before permanent deletion.',
      'critical',
      '/account/delete/cancel',
      'Cancel Deletion'
    )
  `, [userId]);

  return { request_id: requestId };
}

// ============================================================================
// AUDIT HELPER
// ============================================================================

export async function createAuditLog(
  userId: string,
  action: string,
  context: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await pool.query(`
    INSERT INTO molam_audit_logs(user_id, action, context, ip_address, user_agent)
    VALUES($1, $2, $3, $4, $5)
  `, [userId, action, JSON.stringify(context), ipAddress, userAgent]);
}

export default {
  getUserProfile,
  updateUserSettings,
  getUserSessions,
  revokeUserSession,
  getUserDevices,
  trustDevice,
  revokeDevice,
  setup2FA,
  verify2FA,
  changePassword,
  getUserRoles,
  getUserNotifications,
  markNotificationRead,
  getUnreadNotificationCount,
  getUserAuditLogs,
  requestDataExport,
  requestAccountDeletion,
  createAuditLog
};
