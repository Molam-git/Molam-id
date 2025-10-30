export type ModuleScope = 'id' | 'pay' | 'eats' | 'talk' | 'ads' | 'shop' | 'free';
export type DeviceType = 'ios' | 'android' | 'web' | 'desktop' | 'ussd' | 'api';
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SessionRecord {
  id: string;
  user_id: string;
  tenant_id: string;
  module_scope: ModuleScope;
  device_id: string;
  device_type: DeviceType;
  os_version: string | null;
  app_version: string | null;
  ip_address: string;
  geo_country: string | null;
  geo_city: string | null;
  user_agent: string | null;
  created_at: Date;
  last_seen: Date;
  is_active: boolean;
  terminated_reason: string | null;
  risk_score: number;
}

export interface AnomalyRecord {
  id: string;
  session_id: string;
  user_id: string;
  anomaly_type: string;
  details: any;
  severity: AnomalySeverity;
  created_at: Date;
}

export interface SessionCreateDTO {
  user_id: string;
  tenant_id: string;
  module_scope: ModuleScope;
  device_id: string;
  device_type: DeviceType;
  os_version?: string;
  app_version?: string;
  ip_address: string;
  geo_country?: string;
  geo_city?: string;
  user_agent?: string;
}

export interface TerminateBulkDTO {
  user_id?: string;
  tenant_id?: string;
  module_scope?: ModuleScope;
  all?: boolean;
}

export class ServiceError extends Error {
  constructor(message: string, public status: number = 500, public code?: string) {
    super(message);
    this.name = 'ServiceError';
  }
}
