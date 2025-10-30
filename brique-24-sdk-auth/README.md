# Brique 24 — SDK Auth (JS, iOS, Android)

**Molam Auth SDK - Universal Authentication for All Platforms**

Version: 1.0.0

## Overview

The Molam Auth SDK provides a unified authentication solution across all platforms:

- **JavaScript/TypeScript** - Web, Node.js, React, Next.js
- **iOS (Swift)** - Native iOS apps
- **Android (Kotlin)** - Native Android apps

Features:
- **Drop-in authentication** - Simple API for signup, login, refresh, logout
- **Automatic token rotation** - Refresh tokens before expiration
- **Secure storage** - Keychain (iOS), EncryptedSharedPreferences (Android), localStorage/sessionStorage (Web)
- **Session management** - Track active sessions across devices
- **2FA support** - Ready for two-factor authentication
- **USSD/API fallback** - Works with non-smartphone integrations

## Installation

### JavaScript/TypeScript

```bash
npm install @molam/auth
# or
yarn add @molam/auth
```

### iOS (Swift)

Add to your `Podfile`:
```ruby
pod 'MolamAuth', '~> 1.0'
```

Or using Swift Package Manager:
```
https://github.com/molam/molam-auth-ios.git
```

### Android (Kotlin)

Add to your `build.gradle`:
```gradle
dependencies {
    implementation 'com.molam:auth:1.0.0'
}
```

## Quick Start

### JavaScript/TypeScript

```typescript
import { MolamAuth } from '@molam/auth';

// Initialize
const auth = new MolamAuth({
  baseUrl: 'https://api.molam.sn',
  apiKey: 'your-api-key', // optional
  autoRefresh: true,
  onSessionExpired: () => {
    console.log('Session expired, redirecting to login...');
    window.location.href = '/login';
  }
});

// Login
const response = await auth.login({
  identifier: '+221771234567',
  password: 'secure-password'
});

console.log('Logged in:', response.user);

// Make authenticated requests
const data = await auth.authenticatedRequest('/api/pay/balance', {
  method: 'GET'
});

// Logout
await auth.logout();
```

### iOS (Swift)

```swift
import MolamAuth

// Configure
let config = MolamAuthConfig(
    baseUrl: "https://api.molam.sn",
    apiKey: "your-api-key",
    autoRefresh: true
)
MolamAuth.shared.configure(config)

// Login
let request = LoginRequest(
    identifier: "+221771234567",
    password: "secure-password"
)

MolamAuth.shared.login(request) { result in
    switch result {
    case .success(let response):
        print("Logged in: \(response.user.id)")
    case .failure(let error):
        print("Login failed: \(error)")
    }
}

// Check authentication
if MolamAuth.shared.isAuthenticated() {
    print("User is authenticated")
}

// Logout
MolamAuth.shared.logout { success in
    print("Logged out")
}
```

### Android (Kotlin)

```kotlin
import com.molam.auth.*

// Initialize in Application class
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()

        val config = MolamAuthConfig(
            baseUrl = "https://api.molam.sn",
            apiKey = "your-api-key",
            autoRefresh = true
        )
        MolamAuth.init(this, config)
    }
}

// Login
lifecycleScope.launch {
    val request = LoginRequest(
        identifier = "+221771234567",
        password = "secure-password"
    )

    val result = MolamAuth.getInstance().login(request)

    result.fold(
        onSuccess = { response ->
            Log.d("Auth", "Logged in: ${response.user.id}")
        },
        onFailure = { error ->
            Log.e("Auth", "Login failed", error)
        }
    )
}

// Make authenticated request
lifecycleScope.launch {
    val json = JSONObject().apply {
        put("amount", 1000)
    }

    val result = MolamAuth.getInstance()
        .authenticatedRequest("/api/pay/transfer", json)

    result.fold(
        onSuccess = { response ->
            Log.d("Auth", "Transfer successful: $response")
        },
        onFailure = { error ->
            Log.e("Auth", "Transfer failed", error)
        }
    )
}

// Logout
lifecycleScope.launch {
    MolamAuth.getInstance().logout()
}
```

## API Reference

### JavaScript/TypeScript

#### `MolamAuth` Class

**Constructor**
```typescript
new MolamAuth(config: MolamAuthConfig)
```

**Configuration**
```typescript
interface MolamAuthConfig {
  baseUrl: string;
  apiKey?: string;
  storage?: 'localStorage' | 'sessionStorage' | 'memory';
  autoRefresh?: boolean;
  onTokenRefresh?: (token: string) => void;
  onSessionExpired?: () => void;
}
```

**Methods**

- `login(request: LoginRequest): Promise<AuthResponse>` - Authenticate user
- `refresh(): Promise<AuthResponse>` - Refresh access token
- `logout(sessionId?: string): Promise<void>` - End session
- `getAccessToken(): string | null` - Get current access token
- `isAuthenticated(): boolean` - Check if user is logged in
- `authenticatedRequest(url: string, options?: RequestInit): Promise<Response>` - Make authenticated API call

### iOS (Swift)

#### `MolamAuth` Class

**Singleton**
```swift
MolamAuth.shared
```

**Methods**

- `configure(_ config: MolamAuthConfig)` - Initialize SDK
- `login(_ request: LoginRequest, completion: @escaping (Result<AuthResponse, Error>) -> Void)` - Authenticate user
- `refresh(completion: @escaping (Result<AuthResponse, Error>) -> Void)` - Refresh access token
- `logout(sessionId: String?, completion: @escaping (Bool) -> Void)` - End session
- `getAccessToken() -> String?` - Get current access token
- `isAuthenticated() -> Bool` - Check if user is logged in

### Android (Kotlin)

#### `MolamAuth` Class

**Initialization**
```kotlin
MolamAuth.init(context: Context, config: MolamAuthConfig): MolamAuth
```

**Singleton**
```kotlin
MolamAuth.getInstance()
```

**Methods**

- `suspend fun login(request: LoginRequest): Result<AuthResponse>` - Authenticate user
- `suspend fun refresh(): Result<AuthResponse>` - Refresh access token
- `suspend fun logout(sessionId: String? = null): Result<Unit>` - End session
- `fun getAccessToken(): String?` - Get current access token
- `fun isAuthenticated(): Boolean` - Check if user is logged in
- `suspend fun authenticatedRequest(path: String, json: JSONObject, method: String = "POST"): Result<String>` - Make authenticated API call

## Security

### Token Storage

- **Web**: localStorage (default) or sessionStorage with secure flags
- **iOS**: Keychain Services for secure credential storage
- **Android**: EncryptedSharedPreferences with AES256-GCM encryption

### Token Rotation

Tokens are automatically refreshed 1 minute before expiration when `autoRefresh: true`:

- **Access token**: 15 minutes TTL
- **Refresh token**: 7-30 days TTL

### Best Practices

1. **Always use HTTPS** in production
2. **Store API keys securely** - Use environment variables, not hardcoded
3. **Handle session expiration** - Implement `onSessionExpired` callback
4. **Logout on app closure** - Clear tokens when appropriate
5. **Use device fingerprinting** - Unique device IDs for session tracking

## Integration Examples

### React Web App

```typescript
// auth.ts
import { MolamAuth } from '@molam/auth';

export const auth = new MolamAuth({
  baseUrl: process.env.REACT_APP_API_URL,
  autoRefresh: true,
  onSessionExpired: () => {
    window.location.href = '/login';
  }
});

// LoginPage.tsx
import { useState } from 'react';
import { auth } from './auth';

function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await auth.login({ identifier, password });
      console.log('Logged in:', response.user);
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        placeholder="Phone or email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit">Login</button>
    </form>
  );
}
```

### SwiftUI iOS App

```swift
import SwiftUI
import MolamAuth

struct LoginView: View {
    @State private var identifier = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 20) {
            TextField("Phone or email", text: $identifier)
                .textFieldStyle(RoundedBorderTextFieldStyle())

            SecureField("Password", text: $password)
                .textFieldStyle(RoundedBorderTextFieldStyle())

            if let error = errorMessage {
                Text(error)
                    .foregroundColor(.red)
            }

            Button("Login") {
                handleLogin()
            }
            .disabled(isLoading)
        }
        .padding()
    }

    func handleLogin() {
        isLoading = true
        errorMessage = nil

        let request = LoginRequest(
            identifier: identifier,
            password: password
        )

        MolamAuth.shared.login(request) { result in
            DispatchQueue.main.async {
                isLoading = false

                switch result {
                case .success(let response):
                    print("Logged in: \(response.user.id)")
                    // Navigate to dashboard
                case .failure(let error):
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
}
```

### Jetpack Compose Android App

```kotlin
import androidx.compose.runtime.*
import androidx.lifecycle.viewmodel.compose.viewModel
import com.molam.auth.*

@Composable
fun LoginScreen() {
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center
    ) {
        OutlinedTextField(
            value = identifier,
            onValueChange = { identifier = it },
            label = { Text("Phone or email") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )

        errorMessage?.let {
            Text(
                text = it,
                color = MaterialTheme.colors.error,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = {
                isLoading = true
                errorMessage = null

                scope.launch {
                    val request = LoginRequest(
                        identifier = identifier,
                        password = password
                    )

                    val result = MolamAuth.getInstance().login(request)

                    result.fold(
                        onSuccess = { response ->
                            Log.d("Login", "Success: ${response.user.id}")
                            // Navigate to dashboard
                        },
                        onFailure = { error ->
                            errorMessage = error.message
                        }
                    )

                    isLoading = false
                }
            },
            enabled = !isLoading,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (isLoading) {
                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
            } else {
                Text("Login")
            }
        }
    }
}
```

## Database Schema

```sql
-- SDK client registrations
CREATE TABLE molam_sdk_clients (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  secret_key TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refresh tokens
CREATE TABLE molam_refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL
);
```

## Testing

See `tests/` directory for unit tests for each platform.

```bash
# JavaScript
npm test

# iOS
xcodebuild test -scheme MolamAuth

# Android
./gradlew test
```

## Support

- Documentation: https://docs.molam.sn/sdk/auth
- Issues: https://github.com/molam/molam-auth/issues
- Email: developers@molam.sn

## License

Proprietary - Molam Corporation

---

**Made with ❤️ by the Molam Team**
