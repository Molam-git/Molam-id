# MolamID - iOS SDK

Official Swift SDK for Molam ID authentication on iOS and macOS.

## Requirements

- iOS 14.0+ / macOS 11.0+
- Xcode 14.0+
- Swift 5.9+

## Installation

### Swift Package Manager

Add the package to your Xcode project:

1. File → Add Packages...
2. Enter package URL: `https://github.com/molam/molam-id-ios` (à mettre à jour)
3. Select version
4. Add to your target

Or add to `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/molam/molam-id-ios", from: "1.0.0")
]
```

## Quick Start

```swift
import MolamID

// Initialize client
let client = MolamIdClient(baseUrl: "https://id.api.molam.com")

// Set callbacks
client.onAnomaly = { anomaly in
    print("Security anomaly detected:", anomaly.kind)
}

client.onTokenUpdate = { tokens in
    print("Tokens updated:", tokens != nil)
}

// Login
Task {
    do {
        let tokens = try await client.login(
            identifier: "user@example.com",
            password: "securePassword123"
        )
        print("Logged in successfully:", tokens.sessionId)
    } catch {
        print("Login failed:", error)
    }
}

// Get sessions
Task {
    let sessions = try await client.mySessions()
    print("Active sessions:", sessions.count)
}

// Logout
Task {
    await client.logout()
}
```

## API Reference

### MolamIdClient

#### Initialization

```swift
let client = MolamIdClient(
    baseUrl: "https://id.molam.com",
    heartbeatIntervalSec: 120  // Optional, default: 120 seconds
)
```

#### Authentication

```swift
// Login
let tokens = try await client.login(identifier: String, password: String)

// Signup
let result = try await client.signup(
    email: "user@example.com",
    phone: nil,
    password: "password",
    locale: "fr",
    country: "BJ"
)

// Refresh tokens
let newTokens = try await client.refresh()

// Logout
await client.logout(revokeAll: false)
```

#### Session Management

```swift
// List active sessions
let sessions: [SessionInfo] = try await client.mySessions()

// Revoke specific session
try await client.revokeSession("session-id")

// Revoke all sessions
try await client.revokeAllSessions()

// Manual heartbeat
try await client.heartbeat()
```

#### USSD

```swift
// Bind USSD session
try await client.ussdBind(
    msisdn: "+22379123456",
    countryCode: "BJ"
)
```

#### User Info

```swift
// Check authentication status
let isAuth = await client.isAuthenticated()

// Get metrics
let metrics = client.getMetrics()
print("Login attempts:", metrics["loginAttempts"] ?? 0)
```

### Callbacks

```swift
// Anomaly detection
client.onAnomaly = { event in
    switch event.kind {
    case "IMPOSSIBLE_TRAVEL":
        showAlert("Suspicious activity detected")
    case "FP_MISMATCH":
        requestReAuth()
    default:
        break
    }
}

// Token updates
client.onTokenUpdate = { tokens in
    if let tokens = tokens {
        print("Tokens refreshed, expires at:", tokens.expiresAt)
    } else {
        print("User logged out")
    }
}

// Error handling
client.onError = { error in
    print("SDK error:", error.localizedDescription)
}
```

## Features

- ✅ Login/Signup with email or phone
- ✅ Automatic JWT refresh
- ✅ Keychain-based secure storage
- ✅ Automatic session heartbeat
- ✅ Multi-session management
- ✅ USSD binding support
- ✅ Device fingerprinting (privacy-aware)
- ✅ Anomaly detection callbacks
- ✅ iOS & macOS support
- ✅ async/await API

## Security

- Tokens are stored securely in iOS Keychain
- Automatic token rotation on refresh
- Device fingerprinting without sensitive identifiers
- Support for Face ID / Touch ID (future)

## Examples

See [examples/ios/](../examples/ios/) for:
- SwiftUI login screen
- Session management view
- USSD binding
- Biometric authentication

## License

MIT © Molam
