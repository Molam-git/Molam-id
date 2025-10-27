import { cfg } from '../config/index.js';
import { pool } from '../utils/repos.js';
import crypto from 'crypto';

export interface WebAuthnCredential {
    id: string;
    publicKey: string;
    signCount: number;
    transports?: string[];
}

export class WebAuthnService {
    static async generateRegistrationOptions(userId: string, username: string, displayName?: string) {
        // Implementation simplifiée pour le moment
        return {
            challenge: crypto.randomBytes(32).toString('base64url'),
            rp: {
                name: cfg.rpName,
                id: cfg.rpId
            },
            user: {
                id: userId,
                name: username,
                displayName: displayName || username
            },
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 }, // ES256
                { type: 'public-key', alg: -257 } // RS256
            ],
            timeout: 60000,
            attestation: 'none'
        };
    }

    static async verifyRegistrationResponse(options: any, response: any) {
        // Implementation simplifiée - retourne un objet mocké
        return {
            verified: true,
            registrationInfo: {
                credential: {
                    id: response.id,
                    publicKey: 'mock-public-key',
                    counter: 0
                }
            }
        };
    }

    static async generateAuthenticationOptions(userId?: string) {
        return {
            challenge: crypto.randomBytes(32).toString('base64url'),
            rpId: cfg.rpId,
            timeout: 60000,
            userVerification: 'preferred'
        };
    }

    static async verifyAuthenticationResponse(options: any, response: any, credential: any) {
        // Implementation simplifiée
        return {
            verified: true,
            authenticationInfo: {
                newCounter: (credential.signCount || 0) + 1
            }
        };
    }

    static async saveCredential(userId: string, factorId: string, credential: any, verification: any) {
        await pool.query(
            `INSERT INTO molam_mfa_webauthn_credentials 
       (id, user_id, factor_id, credential_id, public_key, sign_count, transports) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                crypto.randomUUID(),
                userId,
                factorId,
                credential.id,
                'mock-public-key-base64',
                0,
                credential.transports || []
            ]
        );

        await pool.query(
            'UPDATE molam_mfa_factors SET is_active = true WHERE id = $1',
            [factorId]
        );
    }

    static async updateSignCount(credentialId: string, newSignCount: number) {
        await pool.query(
            'UPDATE molam_mfa_webauthn_credentials SET sign_count = $1 WHERE credential_id = $2',
            [newSignCount, credentialId]
        );
    }

    static async getCredentialById(credentialId: string): Promise<WebAuthnCredential | null> {
        const result = await pool.query(
            `SELECT credential_id, public_key, sign_count, transports 
       FROM molam_mfa_webauthn_credentials 
       WHERE credential_id = $1`,
            [credentialId]
        );

        if (result.rows.length === 0) return null;

        return {
            id: result.rows[0].credential_id,
            publicKey: result.rows[0].public_key,
            signCount: result.rows[0].sign_count,
            transports: result.rows[0].transports
        };
    }
}