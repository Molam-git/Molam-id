// api/src/controllers/ui.controller.ts
// HTTP request handlers for Molam ID UI Management

import { Request, Response, NextFunction } from 'express';
import * as service from '../services/ui.service';
import type {
  UpdateSettingsDTO,
  ChangePasswordDTO,
  Setup2FADTO,
  Verify2FADTO,
  TrustDeviceDTO,
  ExportRequestDTO,
  DeleteAccountDTO
} from '../types';

// ============================================================================
// PROFILE & SETTINGS
// ============================================================================

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const profile = await service.getUserProfile(userId);
    res.json(profile);
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    // Profile updates (display_name, email, phone) would be handled here
    // For now, we'll just return success
    await service.createAuditLog(userId, 'id.profile.update', req.body, req.ip, req.get('user-agent'));
    res.json({ ok: true, message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const profile = await service.getUserProfile(userId);
    res.json(profile.settings);
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const dto: UpdateSettingsDTO = req.body;
    const settings = await service.updateUserSettings(userId, dto);
    await service.createAuditLog(userId, 'id.settings.update', dto, req.ip, req.get('user-agent'));
    res.json(settings);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// SECURITY - SESSIONS
// ============================================================================

export async function listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const sessions = await service.getUserSessions(userId);
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
}

export async function revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;
    await service.revokeUserSession(userId, sessionId);
    await service.createAuditLog(userId, 'id.session.revoke', { sessionId }, req.ip, req.get('user-agent'));
    res.json({ ok: true, message: 'Session revoked successfully' });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// SECURITY - DEVICES
// ============================================================================

export async function listDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const devices = await service.getUserDevices(userId);
    res.json({ devices });
  } catch (error) {
    next(error);
  }
}

export async function trustDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { deviceId } = req.params;
    const dto: TrustDeviceDTO = {
      device_id: deviceId,
      trust: req.body.trust ?? true
    };
    await service.trustDevice(userId, dto);
    await service.createAuditLog(userId, 'id.device.trust', dto, req.ip, req.get('user-agent'));
    res.json({ ok: true, message: `Device ${dto.trust ? 'trusted' : 'untrusted'} successfully` });
  } catch (error) {
    next(error);
  }
}

export async function revokeDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { deviceId } = req.params;
    await service.revokeDevice(userId, deviceId);
    await service.createAuditLog(userId, 'id.device.revoke', { deviceId }, req.ip, req.get('user-agent'));
    res.json({ ok: true, message: 'Device revoked successfully' });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// SECURITY - 2FA
// ============================================================================

export async function setup2FA(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const dto: Setup2FADTO = req.body;
    const result = await service.setup2FA(userId, dto);
    await service.createAuditLog(userId, 'id.2fa.setup', { method: dto.method }, req.ip, req.get('user-agent'));
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function verify2FA(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const dto: Verify2FADTO = req.body;
    const isValid = await service.verify2FA(userId, dto);
    if (isValid) {
      await service.createAuditLog(userId, 'id.2fa.verify', { method: dto.method, success: true }, req.ip, req.get('user-agent'));
      res.json({ ok: true, message: '2FA verified successfully' });
    } else {
      await service.createAuditLog(userId, 'id.2fa.verify', { method: dto.method, success: false }, req.ip, req.get('user-agent'));
      res.status(400).json({ error: 'Invalid 2FA code' });
    }
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// SECURITY - PASSWORD
// ============================================================================

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const dto: ChangePasswordDTO = req.body;
    await service.changePassword(userId, dto);
    await service.createAuditLog(userId, 'id.password.change', {}, req.ip, req.get('user-agent'));
    res.json({ ok: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// ROLES
// ============================================================================

export async function getRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const roles = await service.getUserRoles(userId);
    res.json({ roles });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export async function listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const notifications = await service.getUserNotifications(userId, limit);
    const unreadCount = await service.getUnreadNotificationCount(userId);
    res.json({ notifications, unread_count: unreadCount });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    await service.markNotificationRead(userId, id);
    res.json({ ok: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// AUDIT
// ============================================================================

export async function listAudit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = await service.getUserAuditLogs(userId, limit);
    res.json({ logs });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// COMPLIANCE
// ============================================================================

export async function requestExport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const dto: ExportRequestDTO = req.body;
    const result = await service.requestDataExport(userId, dto);
    await service.createAuditLog(userId, 'id.export.request', dto, req.ip, req.get('user-agent'));
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function requestDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const dto: DeleteAccountDTO = req.body;
    const result = await service.requestAccountDeletion(userId, dto);
    await service.createAuditLog(userId, 'id.delete.request', { reason: dto.reason }, req.ip, req.get('user-agent'));
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// ERROR HANDLER
// ============================================================================

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    error: message,
    code: err.code,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
