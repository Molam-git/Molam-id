# @molam/id-sdk - Web/Node.js SDK

Official TypeScript/JavaScript SDK for Molam ID authentication.

## Installation

```bash
npm install @molam/id-sdk
# or
yarn add @molam/id-sdk
# or
pnpm add @molam/id-sdk
```

## Quick Start

### Web Browser

```typescript
import { MolamIdClient, WebTokenStore } from '@molam/id-sdk';

const client = new MolamIdClient({
  baseUrl: 'https://id.api.molam.com',
  tokenStore: new WebTokenStore(),
  onAnomaly: (event) => {
    console.warn('Security anomaly detected:', event);
  },
  onTokenUpdate: (tokens) => {
    console.log('Tokens updated:', !!tokens);
  },
});

// Login
const tokens = await client.login('user@example.com', 'password123');

// Get current user
const user = await client.getCurrentUser();
console.log('Logged in as:', user);

// List sessions
const { sessions } = await client.mySessions();
console.log('Active sessions:', sessions);

// Logout
await client.logout();
```

### Node.js

```typescript
import { MolamIdClient, MemoryTokenStore } from '@molam/id-sdk';

const client = new MolamIdClient({
  baseUrl: 'https://id.api.molam.com',
  tokenStore: new MemoryTokenStore(), // Use MemoryTokenStore for Node.js
  heartbeatIntervalSec: 120, // 2 minutes
});

await client.login('+22379123456', 'securePassword');
```

## API Reference

### MolamIdClient

#### Constructor Options

```typescript
type MolamIdClientOptions = {
  baseUrl: string; // Base URL of Molam ID API
  tokenStore: TokenStore; // Token storage implementation
  onAnomaly?: (event: AnomalyEvent) => void; // Anomaly callback
  onTokenUpdate?: (tokens: AuthTokens | null) => void; // Token update callback
  onError?: (error: Error) => void; // Error callback
  heartbeatIntervalSec?: number; // Heartbeat interval (default: 120s)
  autoRefresh?: boolean; // Auto-refresh tokens (default: true)
};
```

#### Methods

**Authentication:**
- `signup(payload: SignupPayload): Promise<any>`
- `login(identifier: string, password: string): Promise<AuthTokens>`
- `refresh(): Promise<AuthTokens>`
- `logout(revokeAll?: boolean): Promise<void>`

**Session Management:**
- `mySessions(): Promise<{ sessions: SessionInfo[] }>`
- `revokeSession(sessionId: string): Promise<void>`
- `revokeAllSessions(): Promise<void>`

**Heartbeat:**
- `startHeartbeat(): void`
- `stopHeartbeat(): void`
- `heartbeat(): Promise<void>`

**USSD:**
- `ussdBind(msisdn: string, countryCode?: string): Promise<void>`

**User Info:**
- `getCurrentUser(): Promise<UserProfile | null>`
- `isAuthenticated(): Promise<boolean>`

**Metrics:**
- `getMetrics(): object`
- `resetMetrics(): void`

### Token Stores

#### WebTokenStore (Browser)
Uses `localStorage` to persist tokens across browser sessions.

```typescript
import { WebTokenStore } from '@molam/id-sdk/storage';
const store = new WebTokenStore();
```

#### SessionTokenStore (Browser)
Uses `sessionStorage` for single-tab sessions (cleared when tab closes).

```typescript
import { SessionTokenStore } from '@molam/id-sdk/storage';
const store = new SessionTokenStore();
```

#### MemoryTokenStore (Node.js)
In-memory storage (not persisted).

```typescript
import { MemoryTokenStore } from '@molam/id-sdk/storage';
const store = new MemoryTokenStore();
```

#### Custom Token Store
Implement the `TokenStore` interface:

```typescript
interface TokenStore {
  load(): Promise<AuthTokens | null>;
  save(t: AuthTokens | null): Promise<void>;
}
```

## Features

- ✅ **Login/Signup**: Email, phone, or username authentication
- ✅ **JWT Management**: Automatic token refresh with rotation
- ✅ **Session Management**: List, revoke sessions
- ✅ **Heartbeat**: Automatic session keep-alive
- ✅ **USSD Support**: Bind USSD sessions (*131#)
- ✅ **Device Fingerprinting**: Privacy-aware device identification
- ✅ **Anomaly Detection**: Real-time security alerts
- ✅ **TypeScript**: Full type safety
- ✅ **Universal**: Works in browser and Node.js

## Security

- Tokens are stored securely:
  - **Browser**: localStorage scoped to Molam domain
  - **Node.js**: In-memory (implement custom store for persistence)
- Automatic token rotation on refresh
- Rate limiting protection
- Anomaly detection callbacks

## Examples

See [examples/](../examples/) directory for:
- React integration
- Vue integration
- Node.js server
- USSD binding
- Multi-session management

## License

MIT © Molam
