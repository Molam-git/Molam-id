import Foundation
import AVFoundation

/**
 * Voice Authentication Manager for iOS
 *
 * Usage:
 * let voiceAuth = VoiceAuthManager(baseURL: "https://api.molam.com", token: token)
 * voiceAuth.enroll(locale: "fr_SN") { result in ... }
 * voiceAuth.verify(locale: "fr_SN") { result in ... }
 */

class VoiceAuthManager: NSObject {
    private let baseURL: String
    private let token: String
    private var audioRecorder: AVAudioRecorder?
    private var recordingURL: URL?

    init(baseURL: String, token: String) {
        self.baseURL = baseURL
        self.token = token
        super.init()
    }

    // MARK: - Enrollment

    func enroll(locale: String = "fr_SN", completion: @escaping (Result<Void, Error>) -> Void) {
        // Step 1: Begin enrollment
        beginEnroll(locale: locale) { result in
            switch result {
            case .success(let data):
                let phrase = data.phrase
                let reqId = data.reqId

                print("Please say: \"\(phrase)\"")

                // Step 2: Record audio
                self.recordAudio(duration: 5.0) { audioResult in
                    switch audioResult {
                    case .success(let audioData):
                        // Step 3: Upload
                        self.uploadAudio(reqId: reqId, audioData: audioData) { uploadResult in
                            switch uploadResult {
                            case .success(let key):
                                // Step 4: Finish
                                self.finishEnroll(reqId: reqId, key: key, locale: locale, phrase: phrase, completion: completion)
                            case .failure(let error):
                                completion(.failure(error))
                            }
                        }
                    case .failure(let error):
                        completion(.failure(error))
                    }
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    private func beginEnroll(locale: String, completion: @escaping (Result<(phrase: String, reqId: String), Error>) -> Void) {
        guard let url = URL(string: "\(baseURL)/v1/voice/enroll/begin") else {
            completion(.failure(NSError(domain: "Invalid URL", code: -1, userInfo: nil)))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["locale": locale])

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let phrase = json["phrase"] as? String,
                  let reqId = json["reqId"] as? String else {
                completion(.failure(NSError(domain: "Invalid response", code: -1, userInfo: nil)))
                return
            }

            completion(.success((phrase, reqId)))
        }.resume()
    }

    private func finishEnroll(reqId: String, key: String, locale: String, phrase: String, completion: @escaping (Result<Void, Error>) -> Void) {
        guard let url = URL(string: "\(baseURL)/v1/voice/enroll/finish") else {
            completion(.failure(NSError(domain: "Invalid URL", code: -1, userInfo: nil)))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "reqId": reqId,
            "key": key,
            "locale": locale,
            "channel": "mobile_app",
            "phrase": phrase
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                completion(.failure(NSError(domain: "Enrollment failed", code: -1, userInfo: nil)))
                return
            }

            print("✅ Voice enrolled successfully!")
            completion(.success(()))
        }.resume()
    }

    // MARK: - Verification

    func verify(locale: String = "fr_SN", completion: @escaping (Result<(similarity: Double, spoofing: Double), Error>) -> Void) {
        // Step 1: Begin verification
        beginVerify(locale: locale) { result in
            switch result {
            case .success(let data):
                let phrase = data.phrase
                let reqId = data.reqId

                print("Please say: \"\(phrase)\"")

                // Step 2: Record audio
                self.recordAudio(duration: 5.0) { audioResult in
                    switch audioResult {
                    case .success(let audioData):
                        // Step 3: Upload
                        self.uploadAudio(reqId: reqId, audioData: audioData) { uploadResult in
                            switch uploadResult {
                            case .success(let key):
                                // Step 4: Finish
                                self.finishVerify(reqId: reqId, key: key, completion: completion)
                            case .failure(let error):
                                completion(.failure(error))
                            }
                        }
                    case .failure(let error):
                        completion(.failure(error))
                    }
                }
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    private func beginVerify(locale: String, completion: @escaping (Result<(phrase: String, reqId: String), Error>) -> Void) {
        guard let url = URL(string: "\(baseURL)/v1/voice/assert/begin") else {
            completion(.failure(NSError(domain: "Invalid URL", code: -1, userInfo: nil)))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["locale": locale])

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let phrase = json["phrase"] as? String,
                  let reqId = json["reqId"] as? String else {
                completion(.failure(NSError(domain: "Invalid response", code: -1, userInfo: nil)))
                return
            }

            completion(.success((phrase, reqId)))
        }.resume()
    }

    private func finishVerify(reqId: String, key: String, completion: @escaping (Result<(similarity: Double, spoofing: Double), Error>) -> Void) {
        guard let url = URL(string: "\(baseURL)/v1/voice/assert/finish") else {
            completion(.failure(NSError(domain: "Invalid URL", code: -1, userInfo: nil)))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "reqId": reqId,
            "key": key,
            "channel": "mobile_app"
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let similarity = json["similarity"] as? Double,
                  let spoofing = json["spoofing"] as? Double else {
                completion(.failure(NSError(domain: "Verification failed", code: -1, userInfo: nil)))
                return
            }

            print("✅ Voice verified! Similarity: \(similarity), Spoofing: \(spoofing)")
            completion(.success((similarity, spoofing)))
        }.resume()
    }

    // MARK: - Audio Recording

    private func recordAudio(duration: TimeInterval, completion: @escaping (Result<Data, Error>) -> Void) {
        let audioSession = AVAudioSession.sharedInstance()

        do {
            try audioSession.setCategory(.record, mode: .measurement)
            try audioSession.setActive(true)

            let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let audioFilename = documentsPath.appendingPathComponent("voice_\(UUID().uuidString).wav")

            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatLinearPCM),
                AVSampleRateKey: 16000.0,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
            ]

            self.audioRecorder = try AVAudioRecorder(url: audioFilename, settings: settings)
            self.audioRecorder?.record()
            self.recordingURL = audioFilename

            DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
                self.audioRecorder?.stop()

                // Read recorded file
                if let url = self.recordingURL,
                   let audioData = try? Data(contentsOf: url) {
                    completion(.success(audioData))

                    // Clean up
                    try? FileManager.default.removeItem(at: url)
                } else {
                    completion(.failure(NSError(domain: "Failed to read audio", code: -1, userInfo: nil)))
                }
            }

        } catch {
            completion(.failure(error))
        }
    }

    // MARK: - Upload

    private func uploadAudio(reqId: String, audioData: Data, completion: @escaping (Result<String, Error>) -> Void) {
        guard let url = URL(string: "\(baseURL)/v1/voice/upload") else {
            completion(.failure(NSError(domain: "Invalid URL", code: -1, userInfo: nil)))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")

        let base64 = audioData.base64EncodedString()
        let body: [String: Any] = [
            "reqId": reqId,
            "base64": base64,
            "mime": "audio/wav"
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let key = json["key"] as? String else {
                completion(.failure(NSError(domain: "Upload failed", code: -1, userInfo: nil)))
                return
            }

            completion(.success(key))
        }.resume()
    }
}
