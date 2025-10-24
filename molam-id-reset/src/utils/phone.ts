import { parsePhoneNumber } from 'libphonenumber-js';

export function normalizePhone(input: string) {
    const phone = parsePhoneNumber(input);
    if (!phone.isValid()) throw new Error('Invalid phone');
    return { e164: phone.number, country: phone.country };
}
