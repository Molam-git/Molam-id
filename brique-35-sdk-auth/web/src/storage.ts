/**
 * Token storage implementations for different environments
 */
import { AuthTokens } from './types';

export interface TokenStore {
  load(): Promise<AuthTokens | null>;
  save(t: AuthTokens | null): Promise<void>;
}

/**
 * Web browser localStorage-based token store
 * Scoped to the Molam domain
 */
export class WebTokenStore implements TokenStore {
  private key = 'molam.id.tokens';

  async load(): Promise<AuthTokens | null> {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(this.key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async save(t: AuthTokens | null): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    if (!t) {
      localStorage.removeItem(this.key);
    } else {
      localStorage.setItem(this.key, JSON.stringify(t));
    }
  }
}

/**
 * In-memory token store (for Node.js or testing)
 */
export class MemoryTokenStore implements TokenStore {
  private value: AuthTokens | null = null;

  async load(): Promise<AuthTokens | null> {
    return this.value;
  }

  async save(t: AuthTokens | null): Promise<void> {
    this.value = t;
  }
}

/**
 * SessionStorage-based token store (for single-tab sessions)
 */
export class SessionTokenStore implements TokenStore {
  private key = 'molam.id.tokens';

  async load(): Promise<AuthTokens | null> {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(this.key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async save(t: AuthTokens | null): Promise<void> {
    if (typeof sessionStorage === 'undefined') return;
    if (!t) {
      sessionStorage.removeItem(this.key);
    } else {
      sessionStorage.setItem(this.key, JSON.stringify(t));
    }
  }
}
