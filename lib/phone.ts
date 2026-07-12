/**
 * Phone normalization utilities for Ghana and international WhatsApp contacts.
 */

const GHANA_LOCAL_LENGTH = 10;
const GHANA_INTL_LENGTH = 12;
const GHANA_COUNTRY_CODE = '233';

/** Strip to digits only. */
export function phoneDigitsOnly(phone: string): string {
    return phone.replace(/\D/g, '');
}

/**
 * Normalize to international Ghana format: +233XXXXXXXXX
 * Also accepts 9-digit local numbers (missing leading 0).
 */
export function formatGhanaPhoneInternational(phone: string): string | null {
    if (!phone || typeof phone !== 'string') return null;

    let digits = phoneDigitsOnly(phone);
    if (!digits) return null;

    if (digits.startsWith('00')) {
        digits = digits.slice(2);
    }

    if (digits.startsWith('0') && digits.length === GHANA_LOCAL_LENGTH) {
        digits = GHANA_COUNTRY_CODE + digits.slice(1);
    } else if (digits.length === 9 && !digits.startsWith(GHANA_COUNTRY_CODE)) {
        digits = GHANA_COUNTRY_CODE + digits;
    }

    if (digits.startsWith(GHANA_COUNTRY_CODE) && digits.length === GHANA_INTL_LENGTH) {
        return `+${digits}`;
    }

    // International numbers (e.g. diaspora WhatsApp contacts)
    if (digits.length >= 10 && digits.length <= 15) {
        return `+${digits}`;
    }

    return null;
}

/** Compare two phone numbers after normalization. */
export function phonesMatch(a: string, b: string): boolean {
    const da = phoneDigitsOnly(formatGhanaPhoneInternational(a) || a);
    const db = phoneDigitsOnly(formatGhanaPhoneInternational(b) || b);
    if (!da || !db) return false;
    return da === db;
}

/** Key used for deduplication maps. */
export function phoneDedupKey(phone: string): string | null {
    const formatted = formatGhanaPhoneInternational(phone);
    if (!formatted) return null;
    return phoneDigitsOnly(formatted);
}

export function isImportablePhone(phone: string): boolean {
    return formatGhanaPhoneInternational(phone) !== null;
}
