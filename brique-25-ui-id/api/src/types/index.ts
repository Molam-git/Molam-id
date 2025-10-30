// api/src/types/index.ts
// TypeScript type definitions for Molam ID UI Management

export interface UserProfile {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  user_type: 'external' | 'internal';
  kyc_level: number;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  language_code: string;
  currency_code: string;
  country_code: string;
  time_zone: string;
  theme: 'system' | 'light' | 'dark';
  accessibility: {
    voice_mode?: boolean;
    large_text?: boolean;
    high_contrast?: boolean;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface UpdateSettingsDTO {
  language_code?: string;
  currency_code?: string;
  country_code?: string;
  time_zone?: string;
  theme?: 'system' | 'light' | 'dark';
  accessibility?: Record<string, any>;
}

export interface UserDevice {
  id: string;
  user_id: string;
  device_id: string;
  device_type: 'ios' | 'android' | 'web' | 'desktop' | 'harmony' | 'ussd' | 'api';
  device_name: string | null;
  os_version: string | null;
  app_version: string | null;
  ip: string | null;
  user_agent: string | null;
  is_trusted: boolean;
  registered_at: string;
  last_seen_at: string;
  revoked_at: string | null;
}

export interface SessionInfo {
  id: string;
  user_id: string;
  device_id: string | null;
  device_type: string | null;
  device_name: string | null;
  ip_address: string | null;
  geo_country: string | null;
  created_at: string;
  last_seen: string;
  revoked_at: string | null;
  is_active: boolean;
}

export interface UserNotification {
  id: string;
  user_id: string;
  category: 'security' | 'product' | 'legal' | 'system';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  action_url: string | null;
  action_label: string | null;
  metadata: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  context: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface UserRole {
  module: string;
  role: string;
  trusted_level: number;
  scope: string;
  granted_at: string;
  expires_at: string | null;
}

export interface ChangePasswordDTO {
  current_password: string;
  new_password: string;
}

export interface Setup2FADTO {
  method: 'totp' | 'sms' | 'app';
}

export interface Verify2FADTO {
  method: 'totp' | 'sms' | 'app';
  code: string;
}

export interface TrustDeviceDTO {
  device_id: string;
  trust: boolean;
}

export interface ExportRequestDTO {
  format: 'json' | 'pdf';
  modules?: string[];
}

export interface DeleteAccountDTO {
  reason?: string;
  password: string;
}

// Express Request extension
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        sub: string;
        email?: string;
        user_type: 'external' | 'internal';
        roles?: string[];
        permissions?: string[];
      };
    }
  }
}

export interface ServiceError extends Error {
  statusCode?: number;
  code?: string;
}
