import { authenticator, totp } from 'otplib';
import { cfg } from '../config/index.js';
import { CryptoService } from './crypto-service.js';
import { generateTotpSecret } from '../utils/crypto.js';
import { decryptSecret, encryptSecret } from '../utils/kms.js';

// Configuration TOTP RFC6238
totp.options = {
    step: cfg.totp.step,
    digits: cfg.totp.digits,
    algorithm: cfg.totp.algo as any
};

export class TotpService {
    static generateSecret(): { encrypted: Buffer; uri: string } {
        const secret = generateTotpSecret();
        const encrypted = encryptSecret(secret);
        const uri = authenticator.keyuri('user', 'Molam', secret.toString('hex'));

        return { encrypted, uri };
    }

    static verify(encryptedSecret: Buffer, token: string): boolean {
        try {
            const secret = decryptSecret(encryptedSecret).toString('hex');
            return totp.verify({ token, secret });
        } catch {
            return false;
        }
    }

    static generateQrCodeData(userId: string, issuer: string = 'Molam'): string {
        // Générer l'URI pour les applications d'authentification
        return `otpauth://totp/${issuer}:${userId}?secret=PLACEHOLDER&issuer=${issuer}&algorithm=${cfg.totp.algo}&digits=${cfg.totp.digits}&period=${cfg.totp.step}`;
    }
}