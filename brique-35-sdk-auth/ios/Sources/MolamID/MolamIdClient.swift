import Foundation
#if canImport(UIKit)
import UIKit
#endif
#if canImport(AppKit)
import AppKit
#endif

public final class MolamIdClient {
    private let baseURL: URL
    private let store: TokenStore
    private var heartbeatTimer: Timer?
    private let heartbeatInterval: TimeInterval

    // Callbacks
    public var onAnomaly: ((AnomalyEvent) -> Void)?
    public var onTokenUpdate: ((Tokens?) -> Void)?
    public var onError: ((Error) -> Void)?

    // Metrics
    private var metrics = Metrics()

    struct Metrics {
        var loginAttempts = 0
        var refreshes = 0
        var heartbeatsSent = 0
        var revocations = 0
    }

    // MARK: - Initialization

    public init(baseUrl: String, heartbeatIntervalSec: TimeInterval = 120) {
        self.baseURL = URL(string: baseUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")))!
        self.store = KeychainTokenStore()
        self.heartbeatInterval = heartbeatIntervalSec
    }

    // MARK: - Authentication

    public func login(identifier: String, password: String) async throws -> Tokens {
        metrics.loginAttempts += 1

        let body: [String: Any] = [
            "identifier": identifier,
            "password": password,
            "device": devicePayload()
        ]

        let response = try await post("/api/id/auth/login", body: body)
        let tokens = adaptTokens(response)

        store.save(tokens)
        onTokenUpdate?(tokens)
        startHeartbeat()

        return tokens
    }

    public func signup(email: String?, phone: String?, password: String, locale: String? = nil, country: String? = nil) async throws -> [String: Any] {
        var body: [String: Any] = ["password": password]
        if let email = email { body["email"] = email }
        if let phone = phone { body["phone"] = phone }
        if let locale = locale { body["locale"] = locale }
        if let country = country { body["country"] = country }

        return try await post("/api/id/auth/signup", body: body)
    }

    public func refresh() async throws -> Tokens {
        metrics.refreshes += 1

        guard let currentTokens = store.load() else {
            throw MolamIdError.notAuthenticated
        }

        let body: [String: Any] = ["refresh_token": currentTokens.refreshToken]
        let response = try await post("/api/id/auth/refresh", body: body)
        let newTokens = adaptTokens(response, sessionId: currentTokens.sessionId)

        store.save(newTokens)
        onTokenUpdate?(newTokens)

        return newTokens
    }

    public func logout(revokeAll: Bool = false) async {
        guard let tokens = store.load() else { return }

        let path = revokeAll ? "/api/id/sessions/revoke_all" : "/api/id/sessions/\(tokens.sessionId)/revoke"
        _ = try? await postAuth(path, body: [:])

        metrics.revocations += 1
        stopHeartbeat()
        store.save(nil)
        onTokenUpdate?(nil)
    }

    // MARK: - Session Management

    public func mySessions() async throws -> [SessionInfo] {
        let response = try await getAuth("/api/id/sessions/me")
        guard let sessionsDict = response["sessions"] as? [[String: Any]] else {
            return []
        }

        return sessionsDict.compactMap { dict in
            guard let data = try? JSONSerialization.data(withJSONObject: dict),
                  let session = try? JSONDecoder().decode(SessionInfo.self, from: data) else {
                return nil
            }
            return session
        }
    }

    public func revokeSession(_ sessionId: String) async throws {
        _ = try await postAuth("/api/id/sessions/\(sessionId)/revoke", body: [:])
        metrics.revocations += 1
    }

    public func revokeAllSessions() async throws {
        _ = try await postAuth("/api/id/sessions/revoke_all", body: [:])
        metrics.revocations += 1
    }

    // MARK: - Heartbeat

    private func startHeartbeat() {
        stopHeartbeat()
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: heartbeatInterval, repeats: true) { [weak self] _ in
            Task {
                try? await self?.heartbeat()
            }
        }
    }

    private func stopHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }

    public func heartbeat() async throws {
        guard let tokens = try await ensureFreshToken() else { return }

        let body: [String: Any] = ["session_id": tokens.sessionId]
        _ = try await postAuth("/api/id/sessions/heartbeat", body: body)

        metrics.heartbeatsSent += 1
    }

    // MARK: - USSD

    public func ussdBind(msisdn: String, countryCode: String? = nil) async throws {
        let body: [String: Any] = [
            "msisdn": msisdn,
            "country_code": countryCode ?? "auto"
        ]
        _ = try await postAuth("/api/id/ussd/bind", body: body)
    }

    // MARK: - User Info

    public func isAuthenticated() async -> Bool {
        guard let tokens = store.load() else { return false }

        if tokens.isExpired {
            do {
                _ = try await refresh()
                return true
            } catch {
                return false
            }
        }

        return true
    }

    public func getMetrics() -> [String: Int] {
        return [
            "loginAttempts": metrics.loginAttempts,
            "refreshes": metrics.refreshes,
            "heartbeatsSent": metrics.heartbeatsSent,
            "revocations": metrics.revocations
        ]
    }

    // MARK: - Helpers

    private func adaptTokens(_ response: [String: Any], sessionId: String? = nil) -> Tokens {
        let expiresIn = (response["expires_in"] as? TimeInterval) ?? 900
        let now = Date().timeIntervalSince1970 * 1000

        return Tokens(
            accessToken: response["access_token"] as! String,
            refreshToken: response["refresh_token"] as! String,
            expiresAt: now + (expiresIn * 1000),
            sessionId: sessionId ?? (response["session_id"] as! String)
        )
    }

    private func ensureFreshToken() async throws -> Tokens? {
        guard var tokens = store.load() else { return nil }

        let skew: TimeInterval = 30_000 // 30 seconds
        if Date().timeIntervalSince1970 * 1000 >= tokens.expiresAt - skew {
            tokens = try await refresh()
        }

        return tokens
    }

    private func devicePayload() -> [String: Any] {
        var fingerprint: [String: Any] = [:]

        #if canImport(UIKit)
        let device = UIDevice.current
        fingerprint["model"] = device.model
        fingerprint["systemName"] = device.systemName
        fingerprint["systemVersion"] = device.systemVersion
        #elseif canImport(AppKit)
        fingerprint["model"] = "Mac"
        fingerprint["systemName"] = "macOS"
        #endif

        fingerprint["tz"] = TimeZone.current.identifier

        return ["fingerprint": fingerprint]
    }

    // MARK: - HTTP Methods

    private func getAuth(_ path: String) async throws -> [String: Any] {
        guard let tokens = try await ensureFreshToken() else {
            throw MolamIdError.notAuthenticated
        }

        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.setValue("Bearer \(tokens.accessToken)", forHTTPHeaderField: "Authorization")

        return try await execute(request)
    }

    private func post(_ path: String, body: [String: Any]) async throws -> [String: Any] {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        return try await execute(request)
    }

    private func postAuth(_ path: String, body: [String: Any]) async throws -> [String: Any] {
        guard let tokens = try await ensureFreshToken() else {
            throw MolamIdError.notAuthenticated
        }

        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(tokens.accessToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        return try await execute(request)
    }

    private func execute(_ request: URLRequest) async throws -> [String: Any] {
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw MolamIdError.invalidResponse
        }

        // Handle rate limiting
        if httpResponse.statusCode == 429 {
            throw MolamIdError.rateLimited
        }

        // Handle anomaly header
        if let anomalyHeader = httpResponse.value(forHTTPHeaderField: "x-molam-anomaly"),
           let anomalyData = anomalyHeader.data(using: .utf8),
           let anomaly = try? JSONDecoder().decode(AnomalyEvent.self, from: anomalyData) {
            onAnomaly?(anomaly)
        }

        // Check for success
        guard (200..<300).contains(httpResponse.statusCode) else {
            // Handle auth errors
            if httpResponse.statusCode == 401 {
                store.save(nil)
                onTokenUpdate?(nil)
                stopHeartbeat()
                throw MolamIdError.unauthorized
            }

            throw MolamIdError.httpError(httpResponse.statusCode)
        }

        if data.isEmpty {
            return [:]
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return [:]
        }

        return json
    }
}

// MARK: - Errors

public enum MolamIdError: Error {
    case notAuthenticated
    case invalidResponse
    case rateLimited
    case unauthorized
    case httpError(Int)
}
