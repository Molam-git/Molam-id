/**
 * Molam ID Client SDK for Web and Node.js
 */
import { AuthTokens, LoginPayload, SignupPayload, UserProfile, SessionInfo, AnomalyEvent } from './types';
import { TokenStore } from './storage';
import { jwtDecode } from 'jwt-decode';
import fetch from 'cross-fetch';
import { buildFingerprint } from './fingerprint';

export type MolamIdClientOptions = {
  baseUrl: string;
  tokenStore: TokenStore;
  onAnomaly?: (event: AnomalyEvent) => void;
  onTokenUpdate?: (tokens: AuthTokens | null) => void;
  onError?: (error: Error) => void;
  heartbeatIntervalSec?: number;
  autoRefresh?: boolean;
};

export class MolamIdClient {
  private base: string;
  private store: TokenStore;
  private onAnomaly?: (event: AnomalyEvent) => void;
  private onTokenUpdate?: (tokens: AuthTokens | null) => void;
  private onError?: (error: Error) => void;
  private heartbeatTimer?: any;
  private heartbeatInterval: number;
  private autoRefresh: boolean;

  // Metrics
  private metrics = {
    loginAttempts: 0,
    refreshes: 0,
    heartbeatsSent: 0,
    revocations: 0,
  };

  constructor(options: MolamIdClientOptions) {
    this.base = options.baseUrl.replace(/\/+$/, '');
    this.store = options.tokenStore;
    this.onAnomaly = options.onAnomaly;
    this.onTokenUpdate = options.onTokenUpdate;
    this.onError = options.onError;
    this.heartbeatInterval = (options.heartbeatIntervalSec ?? 120) * 1000; // Default 2 minutes
    this.autoRefresh = options.autoRefresh ?? true;
  }

  // ============================================================================
  // AUTHENTICATION FLOWS
  // ============================================================================

  /**
   * Sign up a new user
   */
  async signup(payload: SignupPayload): Promise<any> {
    try {
      const res = await this.post('/api/id/auth/signup', payload);
      return res;
    } catch (error: any) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Login with email/phone and password
   */
  async login(identifier: string, password: string): Promise<AuthTokens> {
    try {
      this.metrics.loginAttempts++;

      const device = await this.buildDevicePayload();
      const body: LoginPayload = { identifier, password, device };

      const res = await this.post('/api/id/auth/login', body);
      const tokens = this.adaptTokens(res);

      await this.store.save(tokens);
      this.onTokenUpdate?.(tokens);
      this.startHeartbeat();

      return tokens;
    } catch (error: any) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refresh(): Promise<AuthTokens> {
    try {
      this.metrics.refreshes++;

      const currentTokens = await this.store.load();
      if (!currentTokens) {
        throw new Error('not_authenticated');
      }

      const res = await this.post('/api/id/auth/refresh', {
        refresh_token: currentTokens.refreshToken,
      });

      const newTokens = this.adaptTokens({
        ...res,
        session_id: currentTokens.sessionId,
      });

      await this.store.save(newTokens);
      this.onTokenUpdate?.(newTokens);

      return newTokens;
    } catch (error: any) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Logout and optionally revoke all sessions
   */
  async logout(revokeAll = false): Promise<void> {
    try {
      const tokens = await this.store.load();

      if (tokens) {
        try {
          if (revokeAll) {
            await this.postAuth('/api/id/sessions/revoke_all', {});
          } else {
            await this.postAuth(`/api/id/sessions/${tokens.sessionId}/revoke`, {});
          }
          this.metrics.revocations++;
        } catch (err) {
          // Ignore errors during logout
        }
      }

      this.stopHeartbeat();
      await this.store.save(null);
      this.onTokenUpdate?.(null);
    } catch (error: any) {
      this.handleError(error);
      throw error;
    }
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Get list of active sessions for current user
   */
  async mySessions(): Promise<{ sessions: SessionInfo[] }> {
    return this.getAuth('/api/id/sessions/me');
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.postAuth(`/api/id/sessions/${sessionId}/revoke`, {});
    this.metrics.revocations++;
  }

  /**
   * Revoke all sessions except current one
   */
  async revokeAllSessions(): Promise<void> {
    await this.postAuth('/api/id/sessions/revoke_all', {});
    this.metrics.revocations++;
  }

  // ============================================================================
  // HEARTBEAT
  // ============================================================================

  /**
   * Start automatic heartbeat
   */
  startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.heartbeat().catch((err) => this.handleError(err));
    }, this.heartbeatInterval);
  }

  /**
   * Stop automatic heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Send heartbeat to extend session
   */
  async heartbeat(): Promise<void> {
    try {
      const tokens = await this.ensureFreshToken();
      await this.postAuth('/api/id/sessions/heartbeat', {
        session_id: tokens.sessionId,
      });
      this.metrics.heartbeatsSent++;
    } catch (error: any) {
      this.handleError(error);
      throw error;
    }
  }

  // ============================================================================
  // USSD BINDING
  // ============================================================================

  /**
   * Bind USSD/MSISDN to current session
   */
  async ussdBind(msisdn: string, countryCode?: string): Promise<void> {
    await this.postAuth('/api/id/ussd/bind', {
      msisdn,
      country_code: countryCode || 'auto',
    });
  }

  // ============================================================================
  // USER PROFILE
  // ============================================================================

  /**
   * Get current user profile from JWT
   */
  async getCurrentUser(): Promise<UserProfile | null> {
    const tokens = await this.store.load();
    if (!tokens) return null;

    try {
      const decoded: any = jwtDecode(tokens.accessToken);
      return {
        id: decoded.sub || decoded.id,
        userType: decoded.userType || 'external',
        email: decoded.email,
        phone: decoded.phone,
        locale: decoded.locale,
        currency: decoded.currency,
        roles: decoded.roles || [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.store.load();
    if (!tokens) return false;

    // Check if token is expired
    if (Date.now() >= tokens.expiresAt) {
      if (this.autoRefresh) {
        try {
          await this.refresh();
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }

    return true;
  }

  // ============================================================================
  // METRICS
  // ============================================================================

  /**
   * Get SDK metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      loginAttempts: 0,
      refreshes: 0,
      heartbeatsSent: 0,
      revocations: 0,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private async buildDevicePayload(): Promise<any> {
    return {
      fingerprint: await buildFingerprint(),
      channel: this.detectChannel(),
    };
  }

  private detectChannel(): string {
    if (typeof window !== 'undefined') return 'web';
    if (typeof process !== 'undefined' && process.versions?.node) return 'api';
    return 'unknown';
  }

  private adaptTokens(res: any): AuthTokens {
    const now = Date.now();
    const expiresIn = (res.expires_in || 900) * 1000; // Default 15 minutes

    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt: now + expiresIn,
      sessionId: res.session_id,
    };
  }

  private async ensureFreshToken(): Promise<AuthTokens> {
    let tokens = await this.store.load();
    if (!tokens) {
      throw new Error('not_authenticated');
    }

    // Refresh if token expires in less than 30 seconds
    const skew = 30_000;
    if (Date.now() >= tokens.expiresAt - skew) {
      if (this.autoRefresh) {
        tokens = await this.refresh();
      } else {
        throw new Error('token_expired');
      }
    }

    return tokens;
  }

  private async getAuth(path: string): Promise<any> {
    const tokens = await this.ensureFreshToken();
    const response = await fetch(this.base + path, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });
    return this.handleResponse(response);
  }

  private async post(path: string, body: any): Promise<any> {
    const response = await fetch(this.base + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  private async postAuth(path: string, body: any): Promise<any> {
    const tokens = await this.ensureFreshToken();
    const response = await fetch(this.base + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  private async handleResponse(response: Response): Promise<any> {
    // Check for rate limiting
    if (response.status === 429) {
      throw new Error('rate_limited');
    }

    // Check for anomaly header
    if (this.onAnomaly && response.headers.get('x-molam-anomaly')) {
      try {
        const anomaly = JSON.parse(response.headers.get('x-molam-anomaly')!);
        this.onAnomaly(anomaly);
      } catch {
        // Ignore parse errors
      }
    }

    // Handle success
    if (response.ok) {
      const text = await response.text();
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch {
        return {};
      }
    }

    // Handle authentication errors
    const errorText = await response.text();
    if (response.status === 401 && /revoked|expired/.test(errorText)) {
      await this.store.save(null);
      this.onTokenUpdate?.(null);
      this.stopHeartbeat();
    }

    throw new Error(`http_${response.status}: ${errorText}`);
  }

  private handleError(error: Error): void {
    if (this.onError) {
      this.onError(error);
    }
  }
}
