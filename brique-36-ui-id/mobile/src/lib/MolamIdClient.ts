/**
 * Molam ID Client pour React Native & Web
 * Client simplifié pour l'authentification avec le backend Molam-ID
 */

import { storage } from './storage';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface SignupData {
  phone: string;
  email?: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface ProfileData {
  sub: string;
  phone_number?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  [key: string]: any;
}

export class MolamIdClient {
  private apiUrl: string;
  private tokens: AuthTokens | null = null;

  constructor(config: { apiUrl: string }) {
    this.apiUrl = config.apiUrl;
  }

  /**
   * Inscription d'un nouvel utilisateur
   */
  async signup(data: SignupData): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/id/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: data.phone,
        email: data.email,
        password: data.password,
        profile: {
          given_name: data.firstName,
          family_name: data.lastName,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Signup failed');
    }

    const result = await response.json();
    await this.saveTokens(result);
  }

  /**
   * Connexion avec identifiant et mot de passe
   */
  async login(identifier: string, password: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/id/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const result = await response.json();
    await this.saveTokens(result);
  }

  /**
   * Récupérer le profil utilisateur
   */
  async getProfile(): Promise<ProfileData> {
    const tokens = await this.getTokens();
    if (!tokens) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.apiUrl}/api/id/profile`, {
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get profile');
    }

    return response.json();
  }

  /**
   * Déconnexion
   */
  async logout(): Promise<void> {
    const tokens = await this.getTokens();

    if (tokens) {
      try {
        await fetch(`${this.apiUrl}/api/id/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
          },
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    await this.clearTokens();
  }

  /**
   * Récupérer les tokens stockés
   */
  async getTokens(): Promise<AuthTokens | null> {
    if (this.tokens) {
      return this.tokens;
    }

    try {
      const stored = await storage.getItem('molam_tokens');
      if (stored) {
        this.tokens = JSON.parse(stored);
        return this.tokens;
      }
    } catch (error) {
      console.error('Failed to get tokens:', error);
    }

    return null;
  }

  /**
   * Sauvegarder les tokens
   */
  private async saveTokens(data: any): Promise<void> {
    const tokens: AuthTokens = {
      accessToken: data.access_token || data.accessToken,
      refreshToken: data.refresh_token || data.refreshToken,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };

    this.tokens = tokens;
    await storage.setItem('molam_tokens', JSON.stringify(tokens));
  }

  /**
   * Effacer les tokens
   */
  private async clearTokens(): Promise<void> {
    this.tokens = null;
    await storage.removeItem('molam_tokens');
  }
}
