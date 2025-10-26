import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function normalizeIdentity(input: string): { type: 'email' | 'phone', value: string, country?: string } {
    if (input.includes('@')) return { type: 'email', value: input.trim().toLowerCase() };

    const p = parsePhoneNumberFromString(input);
    if (!p || !p.isValid()) throw new Error('INVALID_PHONE');

    // Ici on ne met la propriété que si elle existe
    const result: { type: 'phone'; value: string; country?: string } = {
        type: 'phone',
        value: p.number
    };
    if (p.country) result.country = p.country;  // ← seulement si défini

    return result;
}
