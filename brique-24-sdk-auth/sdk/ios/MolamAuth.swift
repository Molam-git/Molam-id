/**
 * Molam Auth SDK - iOS (Swift)
 * Universal authentication SDK for Molam ID
 *
 * Version: 1.0.0
 * Author: Molam
 */

import Foundation
import Security

public struct MolamAuthConfig {
    let baseUrl: String
    let apiKey: String?
    let autoRefresh: Bool

    public init(baseUrl: String, apiKey: String? = nil, autoRefresh: Bool = true) {
        self.baseUrl = baseUrl
        self.apiKey = apiKey
        self.autoRefresh = autoRefresh
    }
}

public struct LoginRequest {
    let identifier: String
    let password: String
    let deviceId: String?
    let deviceType: String

    public init(identifier: String, password: String, deviceId: String? = nil, deviceType: String = "ios") {
        self.identifier = identifier
        self.password = password
        self.deviceId = deviceId
        self.deviceType = deviceType
    }
}

public struct AuthResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let tokenType: String
    let user: User

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case tokenType = "token_type"
        case user
    }

    public struct User: Codable {
        let id: String
        let email: String?
        let phoneE164: String?

        enum CodingKeys: String, CodingKey {
            case id
            case email
            case phoneE164 = "phone_e164"
        }
    }
}

public class MolamAuth {
    public static let shared = MolamAuth()

    private var config: MolamAuthConfig?
    private var accessToken: String?
    private var refreshToken: String?
    private var refreshTimer: Timer?

    private init() {}

    /// Initialize SDK with configuration
    public func configure(_ config: MolamAuthConfig) {
        self.config = config
        loadTokensFromKeychain()
    }

    /// Login with credentials
    public func login(_ request: LoginRequest, completion: @escaping (Result<AuthResponse, Error>) -> Void) {
        guard let config = config else {
            completion(.failure(NSError(domain: "MolamAuth", code: -1, userInfo: [NSLocalizedDescriptionKey: "SDK not configured"])))
            return
        }

        let deviceId = request.deviceId ?? getOrCreateDeviceId()
        let url = URL(string: "\(config.baseUrl)/api/id/auth/login")!

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let apiKey = config.apiKey {
            urlRequest.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }

        let body: [String: Any] = [
            "identifier": request.identifier,
            "password": request.password,
            "device_id": deviceId,
            "device_type": request.deviceType
        ]

        urlRequest.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: urlRequest) { [weak self] data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let data = data else {
                completion(.failure(NSError(domain: "MolamAuth", code: -2, userInfo: [NSLocalizedDescriptionKey: "No data received"])))
                return
            }

            do {
                let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
                self?.setTokens(accessToken: authResponse.accessToken, refreshToken: authResponse.refreshToken)

                if config.autoRefresh {
                    self?.scheduleRefresh(expiresIn: authResponse.expiresIn)
                }

                completion(.success(authResponse))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }

    /// Refresh access token
    public func refresh(completion: @escaping (Result<AuthResponse, Error>) -> Void) {
        guard let config = config else {
            completion(.failure(NSError(domain: "MolamAuth", code: -1, userInfo: [NSLocalizedDescriptionKey: "SDK not configured"])))
            return
        }

        guard let refreshToken = refreshToken else {
            completion(.failure(NSError(domain: "MolamAuth", code: -3, userInfo: [NSLocalizedDescriptionKey: "No refresh token"])))
            return
        }

        let url = URL(string: "\(config.baseUrl)/api/id/auth/refresh")!

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = ["refresh_token": refreshToken]
        urlRequest.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: urlRequest) { [weak self] data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let data = data else {
                completion(.failure(NSError(domain: "MolamAuth", code: -2, userInfo: [NSLocalizedDescriptionKey: "No data received"])))
                return
            }

            do {
                let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
                self?.setTokens(accessToken: authResponse.accessToken, refreshToken: authResponse.refreshToken)

                if config.autoRefresh {
                    self?.scheduleRefresh(expiresIn: authResponse.expiresIn)
                }

                completion(.success(authResponse))
            } catch {
                self?.clearTokens()
                completion(.failure(error))
            }
        }.resume()
    }

    /// Logout
    public func logout(sessionId: String? = nil, completion: @escaping (Bool) -> Void) {
        guard let config = config, let accessToken = accessToken else {
            clearTokens()
            completion(true)
            return
        }

        let url = URL(string: "\(config.baseUrl)/api/id/auth/logout")!

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let sessionId = sessionId {
            let body: [String: Any] = ["session_id": sessionId]
            urlRequest.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }

        URLSession.shared.dataTask(with: urlRequest) { [weak self] _, _, _ in
            self?.clearTokens()
            self?.refreshTimer?.invalidate()
            self?.refreshTimer = nil
            completion(true)
        }.resume()
    }

    /// Get current access token
    public func getAccessToken() -> String? {
        return accessToken
    }

    /// Check if authenticated
    public func isAuthenticated() -> Bool {
        return accessToken != nil
    }

    // MARK: - Private Methods

    private func setTokens(accessToken: String, refreshToken: String) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        saveTokensToKeychain()
    }

    private func clearTokens() {
        self.accessToken = nil
        self.refreshToken = nil
        removeTokensFromKeychain()
    }

    private func scheduleRefresh(expiresIn: Int) {
        refreshTimer?.invalidate()

        let refreshIn = max(TimeInterval(expiresIn - 60), 0)
        refreshTimer = Timer.scheduledTimer(withTimeInterval: refreshIn, repeats: false) { [weak self] _ in
            self?.refresh { _ in }
        }
    }

    private func getOrCreateDeviceId() -> String {
        let key = "molam_device_id"
        if let deviceId = UserDefaults.standard.string(forKey: key) {
            return deviceId
        }

        let deviceId = "ios-\(UUID().uuidString)"
        UserDefaults.standard.set(deviceId, forKey: key)
        return deviceId
    }

    // MARK: - Keychain Methods

    private func saveTokensToKeychain() {
        if let accessToken = accessToken {
            saveToKeychain(key: "molam_access_token", value: accessToken)
        }
        if let refreshToken = refreshToken {
            saveToKeychain(key: "molam_refresh_token", value: refreshToken)
        }
    }

    private func loadTokensFromKeychain() {
        accessToken = loadFromKeychain(key: "molam_access_token")
        refreshToken = loadFromKeychain(key: "molam_refresh_token")
    }

    private func removeTokensFromKeychain() {
        deleteFromKeychain(key: "molam_access_token")
        deleteFromKeychain(key: "molam_refresh_token")
    }

    private func saveToKeychain(key: String, value: String) {
        let data = value.data(using: .utf8)!
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]

        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    private func loadFromKeychain(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            return nil
        }

        return string
    }

    private func deleteFromKeychain(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]

        SecItemDelete(query as CFDictionary)
    }
}
