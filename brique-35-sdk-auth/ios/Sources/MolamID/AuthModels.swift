import Foundation

// MARK: - Role Claim
public struct RoleClaim: Codable, Equatable {
    public let module: String
    public let role: String

    public init(module: String, role: String) {
        self.module = module
        self.role = role
    }
}

// MARK: - User Profile
public struct UserProfile: Codable {
    public let id: String
    public let userType: String
    public let email: String?
    public let phone: String?
    public let locale: String?
    public let currency: String?
    public let roles: [RoleClaim]

    public init(id: String, userType: String, email: String? = nil, phone: String? = nil,
                locale: String? = nil, currency: String? = nil, roles: [RoleClaim] = []) {
        self.id = id
        self.userType = userType
        self.email = email
        self.phone = phone
        self.locale = locale
        self.currency = currency
        self.roles = roles
    }
}

// MARK: - Auth Tokens
public struct Tokens: Codable {
    public let accessToken: String
    public let refreshToken: String
    public let expiresAt: TimeInterval
    public let sessionId: String

    public init(accessToken: String, refreshToken: String, expiresAt: TimeInterval, sessionId: String) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
        self.sessionId = sessionId
    }

    public var isExpired: Bool {
        return Date().timeIntervalSince1970 * 1000 >= expiresAt
    }
}

// MARK: - Session Info
public struct SessionInfo: Codable {
    public let id: String
    public let channel: String
    public let deviceId: String?
    public let ip: String?
    public let userAgent: String?
    public let geoCountry: String?
    public let createdAt: String
    public let lastSeenAt: String
    public let expiresAt: String
    public let isActive: Bool

    enum CodingKeys: String, CodingKey {
        case id, channel, ip, isActive
        case deviceId = "device_id"
        case userAgent = "user_agent"
        case geoCountry = "geo_country"
        case createdAt = "created_at"
        case lastSeenAt = "last_seen_at"
        case expiresAt = "expires_at"
    }
}

// MARK: - Anomaly Event
public struct AnomalyEvent: Codable {
    public let kind: String
    public let severity: String
    public let details: [String: Any]?
    public let detectedAt: String

    enum CodingKeys: String, CodingKey {
        case kind, severity, details
        case detectedAt = "detected_at"
    }
}
