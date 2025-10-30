// mobile/ios/BiometricsManager.swift
// iOS implementation using Secure Enclave + Face ID / Touch ID

import Foundation
import LocalAuthentication
import Security

class BiometricsManager {

    private let keyTag = "com.molam.biometric.key"
    private let serverURL = "https://api.molam.com"

    /**
     * Enroll biometrics
     * Creates EC key in Secure Enclave, requires Face ID/Touch ID to access
     */
    func enrollBiometrics(completion: @escaping (Result<Void, Error>) -> Void) {
        // Step 1: Request enrollment options from server
        requestEnrollmentOptions { result in
            switch result {
            case .success(let (options, deviceId)):
                // Step 2: Create Secure Enclave key
                self.createSecureEnclaveKey { keyResult in
                    switch keyResult {
                    case .success(let publicKey):
                        // Step 3: Send public key to server
                        self.finishEnrollment(deviceId: deviceId, publicKey: publicKey, completion: completion)
                    case .failure(let error):
                        completion(.failure(error))
                    }
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    /**
     * Verify biometrics (step-up authentication)
     */
    func verifyBiometrics(completion: @escaping (Result<Void, Error>) -> Void) {
        // Step 1: Request assertion options from server
        requestAssertionOptions { result in
            switch result {
            case .success(let challenge):
                // Step 2: Sign challenge with Secure Enclave key
                self.signChallenge(challenge: challenge) { signResult in
                    switch signResult {
                    case .success(let signature):
                        // Step 3: Send signature to server
                        self.finishAssertion(signature: signature, completion: completion)
                    case .failure(let error):
                        completion(.failure(error))
                    }
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    // MARK: - Private Methods

    private func createSecureEnclaveKey(completion: @escaping (Result<Data, Error>) -> Void) {
        let context = LAContext()

        // Check if biometrics are available
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            completion(.failure(error ?? NSError(domain: "BiometricsManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Biometrics not available"])))
            return
        }

        // Create access control for Secure Enclave key
        let access = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            [.privateKeyUsage, .biometryCurrentSet],
            nil
        )!

        // Key attributes
        let attributes: [String: Any] = [
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: keyTag.data(using: .utf8)!,
                kSecAttrAccessControl as String: access
            ]
        ]

        // Generate key pair
        var error: Unmanaged<CFError>?
        guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            completion(.failure(error!.takeRetainedValue() as Error))
            return
        }

        // Get public key
        guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
            completion(.failure(NSError(domain: "BiometricsManager", code: -2, userInfo: [NSLocalizedDescriptionKey: "Failed to get public key"])))
            return
        }

        // Export public key
        var exportError: Unmanaged<CFError>?
        guard let publicKeyData = SecKeyCopyExternalRepresentation(publicKey, &exportError) as Data? else {
            completion(.failure(exportError!.takeRetainedValue() as Error))
            return
        }

        completion(.success(publicKeyData))
    }

    private func signChallenge(challenge: Data, completion: @escaping (Result<Data, Error>) -> Void) {
        let context = LAContext()
        context.localizedReason = "Verify your identity"

        // Retrieve private key from Keychain
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keyTag.data(using: .utf8)!,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true,
            kSecUseOperationPrompt as String: "Authenticate to sign",
            kSecUseAuthenticationContext as String: context
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        guard status == errSecSuccess else {
            completion(.failure(NSError(domain: "BiometricsManager", code: -3, userInfo: [NSLocalizedDescriptionKey: "Key not found"])))
            return
        }

        let privateKey = item as! SecKey

        // Sign challenge
        var error: Unmanaged<CFError>?
        guard let signature = SecKeyCreateSignature(
            privateKey,
            .ecdsaSignatureMessageX962SHA256,
            challenge as CFData,
            &error
        ) as Data? else {
            completion(.failure(error!.takeRetainedValue() as Error))
            return
        }

        completion(.success(signature))
    }

    private func requestEnrollmentOptions(completion: @escaping (Result<(options: [String: Any], deviceId: String), Error>) -> Void) {
        guard let url = URL(string: "\(serverURL)/v1/biometrics/enroll/begin") else {
            completion(.failure(NSError(domain: "BiometricsManager", code: -4, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue("Bearer \(getAuthToken())", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["platform": "ios"])

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let options = json["options"] as? [String: Any],
                  let deviceId = json["deviceId"] as? String else {
                completion(.failure(NSError(domain: "BiometricsManager", code: -5, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])))
                return
            }

            completion(.success((options, deviceId)))
        }.resume()
    }

    private func finishEnrollment(deviceId: String, publicKey: Data, completion: @escaping (Result<Void, Error>) -> Void) {
        guard let url = URL(string: "\(serverURL)/v1/biometrics/enroll/finish") else {
            completion(.failure(NSError(domain: "BiometricsManager", code: -4, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])))
            return
        }

        let body: [String: Any] = [
            "deviceId": deviceId,
            "publicKey": publicKey.base64EncodedString()
        ]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue("Bearer \(getAuthToken())", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            completion(.success(()))
        }.resume()
    }

    private func requestAssertionOptions(completion: @escaping (Result<Data, Error>) -> Void) {
        // Implementation similar to enrollment
        // Returns challenge from server
        completion(.success(Data())) // Placeholder
    }

    private func finishAssertion(signature: Data, completion: @escaping (Result<Void, Error>) -> Void) {
        // Implementation similar to enrollment finish
        completion(.success(())) // Placeholder
    }

    private func getAuthToken() -> String {
        // Retrieve JWT from Keychain or UserDefaults
        return ""
    }
}
