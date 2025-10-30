// web/src/utils/webauthn.ts
// Web frontend utilities for WebAuthn biometrics

/**
 * Convert Base64URL to ArrayBuffer
 */
export function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to Base64URL
 */
export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Start enrollment (registration)
 */
export async function enrollBegin(platform: string = "web"): Promise<{
  options: PublicKeyCredentialCreationOptions;
  deviceId: string;
}> {
  const response = await fetch("/v1/biometrics/enroll/begin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({ platform }),
  });

  if (!response.ok) {
    throw new Error(`Enrollment begin failed: ${response.status}`);
  }

  const data = await response.json();

  // Convert challenge and user.id from base64url to ArrayBuffer
  const options = {
    ...data.options,
    challenge: base64urlToBuffer(data.options.challenge),
    user: {
      ...data.options.user,
      id: base64urlToBuffer(data.options.user.id),
    },
    excludeCredentials: data.options.excludeCredentials?.map((cred: any) => ({
      ...cred,
      id: base64urlToBuffer(cred.id),
    })),
  };

  return { options, deviceId: data.deviceId };
}

/**
 * Finish enrollment
 */
export async function enrollFinish(
  deviceId: string,
  credential: PublicKeyCredential
): Promise<void> {
  const response = credential.response as AuthenticatorAttestationResponse;

  const clientResponse = {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
    },
  };

  const res = await fetch("/v1/biometrics/enroll/finish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({ deviceId, clientResponse }),
  });

  if (!res.ok) {
    throw new Error(`Enrollment finish failed: ${res.status}`);
  }
}

/**
 * Start assertion (authentication/verification)
 */
export async function assertBegin(): Promise<PublicKeyCredentialRequestOptions> {
  const response = await fetch("/v1/biometrics/assert/begin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Assertion begin failed: ${response.status}`);
  }

  const data = await response.json();

  // Convert challenge and allowCredentials from base64url to ArrayBuffer
  const options = {
    ...data.options,
    challenge: base64urlToBuffer(data.options.challenge),
    allowCredentials: data.options.allowCredentials?.map((cred: any) => ({
      ...cred,
      id: base64urlToBuffer(cred.id),
    })),
  };

  return options;
}

/**
 * Finish assertion
 */
export async function assertFinish(credential: PublicKeyCredential): Promise<void> {
  const response = credential.response as AuthenticatorAssertionResponse;

  const clientResponse = {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle
        ? bufferToBase64url(response.userHandle)
        : null,
    },
  };

  const res = await fetch("/v1/biometrics/assert/finish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({ clientResponse }),
  });

  if (!res.ok) {
    throw new Error(`Assertion finish failed: ${res.status}`);
  }
}

/**
 * Helper to get auth token (implement based on your auth system)
 */
function getAuthToken(): string {
  // Retrieve JWT from localStorage, cookie, or state management
  return localStorage.getItem("auth_token") || "";
}
