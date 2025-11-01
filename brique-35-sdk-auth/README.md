# Brique 35 - SDK Auth (Multi-platform)

**Official SDKs for Molam ID Authentication**

Version: 1.0.0
Platforms: Web/Node.js, iOS, Android

## Overview

Brique 35 provides official SDK libraries for integrating Molam ID authentication across all platforms. These SDKs provide a unified, developer-friendly API for:

- Authentication (Login, Signup, Refresh, Logout)
- Session Management (List, Revoke, Heartbeat)
- USSD Binding (*131# and derivatives)
- Device Fingerprinting (privacy-aware)
- Anomaly Detection (impossible travel, fingerprint mismatch, bruteforce)
- RBAC Claims (external users + internal employees)

## SDK Packages

| Platform | Package | Language | Status |
|----------|---------|----------|--------|
| **Web/Node.js** | [@molam/id-sdk](web/) | TypeScript/JavaScript | ✅ Ready |
| **iOS** | [MolamID](ios/) | Swift | ✅ Ready |
| **Android** | [com.molam.id](android/) | Kotlin | ✅ Ready |

## Quick Start

### Web/Node.js

```bash
npm install @molam/id-sdk
```

```typescript
import { MolamIdClient, WebTokenStore } from '@molam/id-sdk';

const client = new MolamIdClient({
  baseUrl: 'https://id.api.molam.com',
  tokenStore: new WebTokenStore(),
});

const tokens = await client.login('user@example.com', 'password');
```

[Full Web Documentation](web/README.md)

### iOS

```swift
import MolamID

let client = MolamIdClient(baseUrl: "https://id.api.molam.com")

Task {
    let tokens = try await client.login(
        identifier: "user@example.com",
        password: "password"
    )
}
```

[Full iOS Documentation](ios/README.md)

### Android

```kotlin
val client = MolamIdClient(
    context = applicationContext,
    baseUrl = "https://id.api.molam.com"
)

lifecycleScope.launch {
    val tokens = client.login("user@example.com", "password")
}
```

[Full Android Documentation](android/README.md)

## Features

### Universal Features (All Platforms)

- ✅ **Login/Signup**: Email, phone, or username authentication
- ✅ **JWT Management**: Automatic token refresh with rotation
- ✅ **Session Management**: List, revoke sessions
- ✅ **Heartbeat**: Automatic session keep-alive
- ✅ **USSD Support**: Bind USSD sessions (*131#, 1311#, etc.)
- ✅ **Device Fingerprinting**: Privacy-aware device identification
- ✅ **Anomaly Detection**: Real-time security alerts
- ✅ **RBAC Claims**: External users + employee roles
- ✅ **Secure Storage**:
  - Web: localStorage (scoped to domain)
  - iOS: Keychain
  - Android: EncryptedSharedPreferences

### Platform-Specific Features

**Web/Node.js:**
- Browser and Node.js support
- localStorage, sessionStorage, or memory storage
- Geolocation API integration

**iOS:**
- Keychain secure storage
- Face ID / Touch ID support (coming soon)
- iOS 14+ and macOS 11+ support

**Android:**
- EncryptedSharedPreferences
- Biometric authentication (coming soon)
- WorkManager for background heartbeat

## Architecture

All SDKs consume the same backend endpoints:

```
Client SDK → API Gateway → Backend Briques
                │
                ├─ POST /api/id/auth/login
                ├─ POST /api/id/auth/refresh
                ├─ POST /api/id/auth/signup
                ├─ GET /api/id/sessions/me
                ├─ POST /api/id/sessions/{id}/revoke
                ├─ POST /api/id/sessions/revoke_all
                ├─ POST /api/id/sessions/heartbeat
                └─ POST /api/id/ussd/bind
```

## Security

### Token Storage
- **Web**: localStorage scoped to Molam domain
- **iOS**: Keychain with kSecAttrAccessibleWhenUnlockedThisDeviceOnly
- **Android**: EncryptedSharedPreferences with AES256-GCM

### Token Lifecycle
1. Login → Access Token (15 min) + Refresh Token (30 days)
2. Automatic refresh 30s before expiration
3. Token rotation on refresh
4. Revocation on logout

### Privacy
- Device fingerprinting: No IMEI, IDFV, or Android ID
- Minimal data: OS version, timezone, screen resolution
- Geolocation: Optional, requires user permission

### Rate Limiting
- Login: ≤ 5/min (client-side throttling)
- Heartbeat: ≥ 60s interval
- Enforced by backend + SDK

## Anomaly Detection

All SDKs support real-time anomaly callbacks:

```typescript
// Web
client.onAnomaly = (event) => {
  console.warn('Anomaly:', event.kind, event.severity);
};

// iOS
client.onAnomaly = { event in
    print("Anomaly: \(event.kind) (\(event.severity))")
}

// Android
client.onAnomaly = { kind, severity, details ->
    Log.w("Anomaly", "$kind ($severity)")
}
```

**Anomaly Types:**
- `IMPOSSIBLE_TRAVEL`: Geographic movement too fast
- `FP_MISMATCH`: Device fingerprint changed
- `BRUTEFORCE`: Too many failed auth attempts
- `UNUSUAL_CHANNEL`: Unexpected authentication channel
- `GEO_BLOCK`: Login from blocked country

## USSD Integration

All SDKs support USSD binding for feature phones:

```typescript
await client.ussdBind('+22379123456', 'BJ');
```

**USSD Codes:**
- `*131#` - Main USSD menu
- `*1311#` - Login
- `*1312#` - Check balance
- `*1313#` - Transfer
- `*13199#` - Logout

## Examples

See [examples/](examples/) directory for:
- React login component
- SwiftUI login screen
- Jetpack Compose login activity
- USSD binding flows
- Multi-session management

## API Endpoints

### Authentication
- `POST /api/id/auth/login`
- `POST /api/id/auth/signup`
- `POST /api/id/auth/refresh`

### Session Management
- `GET /api/id/sessions/me`
- `POST /api/id/sessions/{id}/revoke`
- `POST /api/id/sessions/revoke_all`
- `POST /api/id/sessions/heartbeat`

### USSD
- `POST /api/id/ussd/bind`

## Development

### Building SDKs

**Web:**
```bash
cd web
npm install
npm run build
npm test
```

**iOS:**
```bash
cd ios
swift build
swift test
```

**Android:**
```bash
cd android
./gradlew build
./gradlew test
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests
4. Submit pull request

## License

MIT © Molam

## Support

- **Documentation**: See platform-specific READMEs
- **Issues**: https://github.com/molam/id-sdk/issues
- **Email**: support@molam.com

---

**Related Briques:**
- Brique 1-5: Core Identity Services
- Brique 10: Device Fingerprinting
- Brique 34: Advanced Sessions Monitoring
