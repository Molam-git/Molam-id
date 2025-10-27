import { encryptSecret, decryptSecret } from '../utils/kms.js';
import { generateTotpSecret } from '../utils/crypto.js';

export class CryptoService {
    static async encryptTotpSecret(): Promise<Buffer> {
        const secret = generateTotpSecret();
        return encryptSecret(secret);
    }

    static decryptTotpSecret(encrypted: Buffer): Buffer {
        return decryptSecret(encrypted);
    }

    static async encryptPushToken(token: string): Promise<Buffer> {
        return encryptSecret(Buffer.from(token, 'utf8'));
    }

    static decryptPushToken(encrypted: Buffer): string {
        return decryptSecret(encrypted).toString('utf8');
    }
}