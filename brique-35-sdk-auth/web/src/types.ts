/**
 * Type definitions for Molam ID SDK
 */

export type RoleClaim = {
  module: "id" | "pay" | "eats" | "shop" | "free" | "talk" | "ads";
  role: string;
};

export type UserType = "external" | "employee";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  sessionId: string;
};

export type UserProfile = {
  id: string;
  userType: UserType;
  email?: string;
  phone?: string;
  locale?: string;
  currency?: string;
  roles: RoleClaim[];
};

export type LoginPayload = {
  identifier: string;
  password: string;
  device?: any;
};

export type SignupPayload = {
  email?: string;
  phone?: string;
  password: string;
  locale?: string;
  country?: string;
  firstName?: string;
  lastName?: string;
};

export type SessionInfo = {
  id: string;
  channel: string;
  device_id?: string;
  ip?: string;
  user_agent?: string;
  geo_country?: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  is_active: boolean;
};

export type AnomalyEvent = {
  kind: "IMPOSSIBLE_TRAVEL" | "FP_MISMATCH" | "BRUTEFORCE" | "UNUSUAL_CHANNEL" | "GEO_BLOCK";
  severity: "low" | "medium" | "high" | "critical";
  details: any;
  detected_at: string;
};
