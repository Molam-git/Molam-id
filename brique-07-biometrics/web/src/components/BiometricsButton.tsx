// web/src/components/BiometricsButton.tsx
import React, { useState } from "react";
import { enrollBegin, enrollFinish, assertBegin, assertFinish } from "../utils/webauthn";

export function BiometricsButton() {
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  /**
   * Enroll biometrics (Face ID, Touch ID, Windows Hello, etc.)
   */
  const handleEnroll = async () => {
    try {
      setLoading(true);
      setStatus("Starting enrollment...");

      // Step 1: Get enrollment options from server
      const { options, deviceId } = await enrollBegin("web");

      setStatus("Waiting for biometric...");

      // Step 2: Create credential using WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: options,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error("Credential creation failed");
      }

      setStatus("Finishing enrollment...");

      // Step 3: Send credential to server
      await enrollFinish(deviceId, credential);

      setStatus("✅ Biometrics enrolled successfully!");
    } catch (err: any) {
      console.error("Enrollment error:", err);
      setStatus(`❌ Enrollment failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verify biometrics (step-up authentication)
   */
  const handleVerify = async () => {
    try {
      setLoading(true);
      setStatus("Starting verification...");

      // Step 1: Get assertion options from server
      const options = await assertBegin();

      setStatus("Waiting for biometric...");

      // Step 2: Get assertion using WebAuthn API
      const assertion = await navigator.credentials.get({
        publicKey: options,
      }) as PublicKeyCredential;

      if (!assertion) {
        throw new Error("Assertion failed");
      }

      setStatus("Verifying...");

      // Step 3: Send assertion to server
      await assertFinish(assertion);

      setStatus("✅ Biometric verified successfully!");
    } catch (err: any) {
      console.error("Verification error:", err);
      setStatus(`❌ Verification failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="biometrics-container">
      <h2>Biometric Authentication</h2>

      <div className="button-group">
        <button
          onClick={handleEnroll}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? "Processing..." : "Enable Biometrics"}
        </button>

        <button
          onClick={handleVerify}
          disabled={loading}
          className="btn-secondary"
        >
          {loading ? "Processing..." : "Verify with Biometrics"}
        </button>
      </div>

      {status && (
        <div className={`status ${status.includes("✅") ? "success" : status.includes("❌") ? "error" : "info"}`}>
          {status}
        </div>
      )}

      <div className="info">
        <h3>Supported Methods:</h3>
        <ul>
          <li>Face ID / Touch ID (iOS/macOS)</li>
          <li>Fingerprint / Face Unlock (Android)</li>
          <li>Windows Hello (Windows)</li>
          <li>Security Keys (YubiKey, etc.)</li>
        </ul>
      </div>
    </div>
  );
}
