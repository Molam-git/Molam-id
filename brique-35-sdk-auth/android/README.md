# MolamID - Android SDK

Official Kotlin SDK for Molam ID authentication on Android.

## Requirements

- Android SDK 24+ (Android 7.0+)
- Kotlin 1.9+
- AndroidX

## Installation

### Gradle

Add to your `build.gradle` (module):

```groovy
dependencies {
    implementation 'com.molam:id-sdk:1.0.0'
}
```

Or using Kotlin DSL:

```kotlin
dependencies {
    implementation("com.molam:id-sdk:1.0.0")
}
```

## Quick Start

```kotlin
import com.molam.id.MolamIdClient

// Initialize client
val client = MolamIdClient(
    context = applicationContext,
    baseUrl = "https://id.api.molam.com",
    heartbeatIntervalMin = 15
)

// Set callbacks
client.onAnomaly = { kind, severity, details ->
    Log.w("MolamID", "Security anomaly: $kind ($severity)")
}

client.onTokenUpdate = { tokens ->
    Log.i("MolamID", "Tokens updated: ${tokens != null}")
}

// Login
lifecycleScope.launch {
    try {
        val tokens = client.login("user@example.com", "password123")
        Log.i("MolamID", "Logged in: ${tokens.sessionId}")
    } catch (e: Exception) {
        Log.e("MolamID", "Login failed", e)
    }
}

// Get sessions
lifecycleScope.launch {
    val sessions = client.mySessions()
    Log.i("MolamID", "Active sessions: ${sessions.size}")
}

// Logout
lifecycleScope.launch {
    client.logout()
}
```

## API Reference

### MolamIdClient

#### Initialization

```kotlin
val client = MolamIdClient(
    context: Context,
    baseUrl: String,
    heartbeatIntervalMin: Long = 15  // Background heartbeat interval
)
```

#### Authentication

```kotlin
// Signup
val result: JSONObject = client.signup(
    email = "user@example.com",
    phone = "+22379123456",
    password = "securePassword",
    locale = "fr",
    country = "BJ"
)

// Login
val tokens: Tokens = client.login(
    identifier = "user@example.com",
    password = "password123"
)

// Refresh tokens
val newTokens: Tokens = client.refresh()

// Logout
client.logout(revokeAll = false)
```

#### Session Management

```kotlin
// List active sessions
val sessions: List<JSONObject> = client.mySessions()

// Revoke specific session
client.revokeSession("session-id")

// Revoke all sessions
client.revokeAllSessions()

// Manual heartbeat
client.heartbeat()
```

#### USSD

```kotlin
// Bind USSD session
client.ussdBind(
    msisdn = "+22379123456",
    countryCode = "BJ"
)
```

#### User Info

```kotlin
// Check authentication status
val isAuth: Boolean = client.isAuthenticated()

// Get metrics
val metrics: Map<String, Int> = client.getMetrics()
println("Login attempts: ${metrics["loginAttempts"]}")
```

### Callbacks

```kotlin
// Anomaly detection
client.onAnomaly = { kind, severity, details ->
    when (kind) {
        "IMPOSSIBLE_TRAVEL" -> showAlert("Suspicious activity detected")
        "FP_MISMATCH" -> requestReAuth()
    }
}

// Token updates
client.onTokenUpdate = { tokens ->
    if (tokens != null) {
        println("Tokens refreshed")
    } else {
        println("User logged out")
    }
}

// Error handling
client.onError = { error ->
    Log.e("MolamID", "SDK error", error)
}
```

## Features

- ✅ Login/Signup with email or phone
- ✅ Automatic JWT refresh
- ✅ EncryptedSharedPreferences for secure storage
- ✅ Automatic background heartbeat (WorkManager)
- ✅ Multi-session management
- ✅ USSD binding support
- ✅ Device fingerprinting (privacy-aware)
- ✅ Anomaly detection callbacks
- ✅ Kotlin Coroutines support
- ✅ Android 7.0+ support

## Security

- Tokens are stored securely using EncryptedSharedPreferences
- Automatic token rotation on refresh
- Device fingerprinting without sensitive identifiers
- Background heartbeat using WorkManager
- Support for biometric authentication (future)

## Permissions

Add to your `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

## Examples

See [examples/android/](../examples/android/) for:
- Jetpack Compose login screen
- Session management activity
- USSD binding
- Biometric authentication

## License

MIT © Molam
