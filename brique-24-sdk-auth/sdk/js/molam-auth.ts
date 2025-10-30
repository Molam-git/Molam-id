/**
 * Molam Auth SDK - JavaScript/TypeScript
 * Universal authentication SDK for Molam ID
 *
 * @version 1.0.0
 * @author Molam
 */

export interface MolamAuthConfig {
  baseUrl: string;
  apiKey?: string;
  storage?: 'localStorage' | 'sessionStorage' | 'memory';
  autoRefresh?: boolean;
  onTokenRefresh?: (token: string) => void;
  onSessionExpired?: () => void;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  device_id?: string;
  device_type?: 'web' | 'mobile' | 'desktop' | 'api';
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
    email?: string;
    phone_e164?: string;
  };
}

export class MolamAuth {
  private config: MolamAuthConfig;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshTimer: any = null;

  constructor(config: MolamAuthConfig) {
    this.config = {
      storage: 'localStorage',
      autoRefresh: true,
      ...config,
    };
    this.loadTokens();
  }

  /**
   * Login with email/phone and password
   */
  async login(request: LoginRequest): Promise<AuthResponse> {
    const device_id = request.device_id || this.generateDeviceId();
    const device_type = request.device_type || 'web';

    const response = await this.request('/api/id/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: request.identifier,
        password: request.password,
        device_id,
        device_type,
      }),
    });

    const data: AuthResponse = await response.json();
    this.setTokens(data.access_token, data.refresh_token);

    if (this.config.autoRefresh) {
      this.scheduleRefresh(data.expires_in);
    }

    return data;
  }

  /**
   * Refresh access token
   */
  async refresh(): Promise<AuthResponse> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.request('/api/id/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({
        refresh_token: this.refreshToken,
      }),
    });

    if (!response.ok) {
      this.clearTokens();
      if (this.config.onSessionExpired) {
        this.config.onSessionExpired();
      }
      throw new Error('Failed to refresh token');
    }

    const data: AuthResponse = await response.json();
    this.setTokens(data.access_token, data.refresh_token);

    if (this.config.autoRefresh) {
      this.scheduleRefresh(data.expires_in);
    }

    return data;
  }

  /**
   * Logout
   */
  async logout(sessionId?: string): Promise<void> {
    try {
      await this.request('/api/id/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      this.clearTokens();
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }
    }
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /**
   * Make authenticated request
   */
  async authenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const headers = {
      ...options.headers,
      Authorization: `Bearer ${this.accessToken}`,
    };

    const response = await this.request(url, { ...options, headers });

    // Auto-refresh on 401
    if (response.status === 401 && this.config.autoRefresh) {
      await this.refresh();
      headers.Authorization = `Bearer ${this.accessToken}`;
      return this.request(url, { ...options, headers });
    }

    return response;
  }

  // Private methods

  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.config.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.config.apiKey && { 'X-API-Key': this.config.apiKey }),
      ...options.headers,
    };

    return fetch(url, { ...options, headers });
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.storeTokens();

    if (this.config.onTokenRefresh) {
      this.config.onTokenRefresh(accessToken);
    }
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.removeTokens();
  }

  private storeTokens(): void {
    if (this.config.storage === 'memory') {
      return;
    }

    const storage = this.config.storage === 'sessionStorage' ? sessionStorage : localStorage;
    if (this.accessToken) storage.setItem('molam_access_token', this.accessToken);
    if (this.refreshToken) storage.setItem('molam_refresh_token', this.refreshToken);
  }

  private loadTokens(): void {
    if (this.config.storage === 'memory') {
      return;
    }

    const storage = this.config.storage === 'sessionStorage' ? sessionStorage : localStorage;
    this.accessToken = storage.getItem('molam_access_token');
    this.refreshToken = storage.getItem('molam_refresh_token');
  }

  private removeTokens(): void {
    if (this.config.storage === 'memory') {
      return;
    }

    const storage = this.config.storage === 'sessionStorage' ? sessionStorage : localStorage;
    storage.removeItem('molam_access_token');
    storage.removeItem('molam_refresh_token');
  }

  private scheduleRefresh(expiresIn: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Refresh 1 minute before expiry
    const refreshIn = Math.max((expiresIn - 60) * 1000, 0);
    this.refreshTimer = setTimeout(() => {
      this.refresh().catch(console.error);
    }, refreshIn);
  }

  private generateDeviceId(): string {
    let deviceId = localStorage.getItem('molam_device_id');
    if (!deviceId) {
      deviceId = `web-${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('molam_device_id', deviceId);
    }
    return deviceId;
  }
}

// Export singleton instance
let defaultInstance: MolamAuth | null = null;

export function initMolamAuth(config: MolamAuthConfig): MolamAuth {
  defaultInstance = new MolamAuth(config);
  return defaultInstance;
}

export function getMolamAuth(): MolamAuth {
  if (!defaultInstance) {
    throw new Error('MolamAuth not initialized. Call initMolamAuth() first.');
  }
  return defaultInstance;
}

export default MolamAuth;
