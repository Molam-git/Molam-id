export type MfaFactor =
    | 'sms_otp'
    | 'email_otp'
    | 'totp'
    | 'webauthn'
    | 'recovery_code'
    | 'push'
    | 'ussd_pin';

export interface UserJWT {
    sub: string;
    scopes: string[];
    role: string;
    filiale?: string;
}

export interface MfaFactorRecord {
    id: string;
    user_id: string;
    factor_type: MfaFactor;
    label: string | null;
    secret_enc: Buffer | null;
    public_data: any;
    is_primary: boolean;
    is_active: boolean;
}

export interface EnrollRequest {
    type: MfaFactor;
    channel?: string;
    address?: string;
    label?: string;
    ussd_pin?: string;
}

export interface ChallengeRequest {
    type: 'sms_otp' | 'email_otp' | 'push';
    factor_id?: string;
    address?: string;
}

export interface VerifyRequest {
    kind: MfaFactor;
    challenge_id?: string;
    code?: string;
    totp?: string;
    webauthn_assertion?: any;
    recovery_code?: string;
    ussd_pin?: string;
    device_trust?: 'high' | 'medium' | 'low' | 'unknown';
}

export interface PolicyCheckRequest {
    scope: string;
    amount?: number;
    currency?: string;
    role?: string;
    device_trust?: string;
    country?: string;
}

export interface PolicyRule {
    min_factors?: number;
    require_webauthn_for_roles?: string[];
    thresholds?: Record<string, number>;
    allowed_countries?: string[];
    blocked_countries?: string[];
}