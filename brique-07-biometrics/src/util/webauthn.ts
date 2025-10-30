// src/util/webauthn.ts
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  GenerateRegistrationOptionsOpts,
  VerifiedRegistrationResponse,
  GenerateAuthenticationOptionsOpts,
  VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import { config } from "../config/index.js";

/**
 * Generate WebAuthn registration options (enrollment)
 */
export function startRegistration(
  username: string,
  userId: string,
  excludeCredentialIds: Buffer[]
) {
  const opts: GenerateRegistrationOptionsOpts = {
    rpName: config.webauthn.rpName,
    rpID: config.webauthn.rpID,
    userID: userId,
    userName: username,
    timeout: config.webauthn.timeout,
    attestationType: "none", // Can be 'direct' for full attestation
    excludeCredentials: excludeCredentialIds.map(id => ({
      id,
      type: "public-key" as const,
      transports: ["internal", "usb", "nfc", "ble", "hybrid"] as any,
    })),
    authenticatorSelection: {
      authenticatorAttachment: "platform", // Prefer platform authenticators (Face ID, Touch ID, Windows Hello)
      requireResidentKey: false,
      residentKey: "preferred",
      userVerification: "required", // Biometric or PIN required
    },
    supportedAlgorithmIDs: [-7, -257], // ES256, RS256
  };

  return generateRegistrationOptions(opts);
}

/**
 * Verify WebAuthn registration response
 */
export async function finishRegistration(
  expectedChallenge: string,
  response: any
): Promise<VerifiedRegistrationResponse> {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.webauthn.origin,
    expectedRPID: config.webauthn.rpID,
    requireUserVerification: true,
  });

  return verification;
}

/**
 * Generate WebAuthn authentication options (assertion)
 */
export function startAuthentication(
  allowCredentialIds: Buffer[]
) {
  const opts: GenerateAuthenticationOptionsOpts = {
    timeout: config.webauthn.timeout,
    rpID: config.webauthn.rpID,
    allowCredentials: allowCredentialIds.map(id => ({
      id,
      type: "public-key" as const,
      transports: ["internal", "usb", "nfc", "ble", "hybrid"] as any,
    })),
    userVerification: "required",
  };

  return generateAuthenticationOptions(opts);
}

/**
 * Verify WebAuthn authentication response
 */
export async function finishAuthentication(
  expectedChallenge: string,
  response: any,
  credentialPublicKey: Buffer,
  credentialCounter: number
): Promise<VerifiedAuthenticationResponse> {
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.webauthn.origin,
    expectedRPID: config.webauthn.rpID,
    authenticator: {
      credentialPublicKey,
      credentialID: response.id,
      counter: credentialCounter,
    },
    requireUserVerification: true,
  });

  return verification;
}
