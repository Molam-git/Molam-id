import crypto from 'crypto';
import { cfg } from '../config/index.js';

// Placeholder pour KMS/Vault - À remplacer par l'implémentation réelle
const LOCAL_ENC_KEY = Buffer.from(
    (process.env.LOCAL_ENC_KEY || '').padEnd(32, '0').slice(0, 32)
);

export function encryptSecret(plain: Buffer): Buffer {
    if (cfg.kmsKeyId) {
        // Implémentation réelle avec KMS/Vault
        throw new Error('KMS non implémenté');
    }

    // Chiffrement local pour le développement
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', LOCAL_ENC_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]);
}

export function decryptSecret(blob: Buffer): Buffer {
    if (cfg.kmsKeyId) {
        // Implémentation réelle avec KMS/Vault
        throw new Error('KMS non implémenté');
    }

    // Déchiffrement local pour le développement
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(12, 28);
    const encrypted = blob.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', LOCAL_ENC_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}