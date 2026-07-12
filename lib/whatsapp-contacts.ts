import { formatGhanaPhoneInternational, isImportablePhone, phoneDedupKey } from './phone';
import { isValidEmail } from './sanitize';

export type ContactImportSource = 'vcard' | 'csv' | 'text' | 'manual';

export interface ParsedWhatsAppContact {
    fullName: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    source: ContactImportSource;
    /** Stable id for UI selection within a preview batch */
    previewId: string;
}

export interface ParseContactsResult {
    contacts: ParsedWhatsAppContact[];
    invalid: Array<{ raw: string; reason: string }>;
    format: ContactImportSource;
}

const IMPORT_EMAIL_DOMAIN = 'import.faithlinegh.local';

export function isPlaceholderImportEmail(email: string): boolean {
    return email.endsWith(`@${IMPORT_EMAIL_DOMAIN}`);
}

export function placeholderEmailFromPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return `wa+${digits}@${IMPORT_EMAIL_DOMAIN}`;
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
    const trimmed = fullName.trim().replace(/\s+/g, ' ');
    if (!trimmed) return { firstName: '', lastName: '' };

    const parts = trimmed.split(' ');
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
    }

    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
    };
}

function makePreviewId(name: string, phone: string, index: number): string {
    return `${phoneDedupKey(phone) || 'row'}-${index}`;
}

function finalizeContact(
    raw: { fullName: string; phone: string; email?: string },
    source: ContactImportSource,
    index: number
): ParsedWhatsAppContact | null {
    const formattedPhone = formatGhanaPhoneInternational(raw.phone);
    if (!formattedPhone || !isImportablePhone(raw.phone)) {
        return null;
    }

    const fullName = raw.fullName.trim() || formattedPhone;
    const { firstName, lastName } = splitFullName(fullName);
    const email = raw.email && isValidEmail(raw.email) ? raw.email.trim().toLowerCase() : undefined;

    return {
        fullName,
        firstName,
        lastName,
        phone: formattedPhone,
        email,
        source,
        previewId: makePreviewId(fullName, formattedPhone, index),
    };
}

function dedupeContacts(contacts: ParsedWhatsAppContact[]): ParsedWhatsAppContact[] {
    const seen = new Map<string, ParsedWhatsAppContact>();

    for (const contact of contacts) {
        const key = phoneDedupKey(contact.phone);
        if (!key) continue;

        const existing = seen.get(key);
        if (!existing) {
            seen.set(key, contact);
            continue;
        }

        // Prefer entry with a real name over phone-only label
        const existingHasName = existing.fullName !== existing.phone;
        const incomingHasName = contact.fullName !== contact.phone;
        if (!existingHasName && incomingHasName) {
            seen.set(key, contact);
        }
    }

    return Array.from(seen.values());
}

/** Unfold vCard line continuations (lines starting with space/tab). */
function unfoldVCard(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function extractPhonesFromVCardBlock(block: string): string[] {
    const phones: string[] = [];
    const telRegex = /^TEL[^:]*:(.+)$/gim;
    let match: RegExpExecArray | null;

    while ((match = telRegex.exec(block)) !== null) {
        const value = match[1].trim();
        const waidMatch = value.match(/waid=(\d+)/i);
        if (waidMatch) {
            phones.push(waidMatch[1]);
        }
        const colonParts = value.split(':');
        const lastPart = colonParts[colonParts.length - 1].trim();
        if (lastPart) phones.push(lastPart);
    }

    return phones;
}

function extractNameFromVCardBlock(block: string): string {
    const fnMatch = block.match(/^FN[^:]*:(.+)$/im);
    if (fnMatch?.[1]) return fnMatch[1].trim();

    const nMatch = block.match(/^N[^:]*:(.+)$/im);
    if (nMatch?.[1]) {
        const [last = '', first = ''] = nMatch[1].split(';');
        return `${first} ${last}`.trim();
    }

    return '';
}

function extractEmailFromVCardBlock(block: string): string | undefined {
    const emailMatch = block.match(/^EMAIL[^:]*:(.+)$/im);
    return emailMatch?.[1]?.trim();
}

export function parseVCard(text: string): ParseContactsResult {
    const unfolded = unfoldVCard(text);
    const blocks = unfolded.split(/BEGIN:VCARD/i).slice(1);
    const contacts: ParsedWhatsAppContact[] = [];
    const invalid: Array<{ raw: string; reason: string }> = [];

    blocks.forEach((block, blockIndex) => {
        const endIdx = block.search(/END:VCARD/i);
        const card = endIdx >= 0 ? block.slice(0, endIdx) : block;
        const fullName = extractNameFromVCardBlock(card);
        const phones = extractPhonesFromVCardBlock(card);
        const email = extractEmailFromVCardBlock(card);

        if (phones.length === 0) {
            invalid.push({
                raw: fullName || `Contact ${blockIndex + 1}`,
                reason: 'No phone number found',
            });
            return;
        }

        const primaryPhone = phones.find((p) => isImportablePhone(p)) || phones[0];
        const parsed = finalizeContact(
            { fullName: fullName || primaryPhone, phone: primaryPhone, email },
            'vcard',
            blockIndex
        );

        if (parsed) {
            contacts.push(parsed);
        } else {
            invalid.push({
                raw: fullName || primaryPhone,
                reason: 'Invalid phone number',
            });
        }
    });

    return {
        contacts: dedupeContacts(contacts),
        invalid,
        format: 'vcard',
    };
}

export function parseCsvContacts(text: string): ParseContactsResult {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    const contacts: ParsedWhatsAppContact[] = [];
    const invalid: Array<{ raw: string; reason: string }> = [];

    if (lines.length === 0) {
        return { contacts: [], invalid: [], format: 'csv' };
    }

    const header = lines[0].toLowerCase();
    const hasHeader = header.includes('phone') || header.includes('name') || header.includes('email');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    dataLines.forEach((line, index) => {
        const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length < 2) {
            invalid.push({ raw: line, reason: 'Expected name and phone columns' });
            return;
        }

        let fullName = '';
        let phone = '';
        let email: string | undefined;

        if (parts.length >= 3 && isValidEmail(parts[2])) {
            [fullName, phone] = parts;
            email = parts[2];
        } else if (isValidEmail(parts[0]) && parts.length >= 2) {
            email = parts[0];
            fullName = parts[1];
            phone = parts[2] || '';
        } else {
            fullName = parts[0];
            phone = parts[1];
            if (parts[2] && isValidEmail(parts[2])) email = parts[2];
        }

        const parsed = finalizeContact({ fullName, phone, email }, 'csv', index);
        if (parsed) {
            contacts.push(parsed);
        } else {
            invalid.push({ raw: line, reason: 'Invalid phone number' });
        }
    });

    return {
        contacts: dedupeContacts(contacts),
        invalid,
        format: 'csv',
    };
}

const TEXT_PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/;

export function parsePlainTextContacts(text: string): ParseContactsResult {
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
    const contacts: ParsedWhatsAppContact[] = [];
    const invalid: Array<{ raw: string; reason: string }> = [];

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        const phoneMatch = trimmed.match(TEXT_PHONE_REGEX);

        if (!phoneMatch) {
            invalid.push({ raw: trimmed, reason: 'No phone number found' });
            return;
        }

        const phone = phoneMatch[1];
        const name = trimmed
            .replace(phoneMatch[0], '')
            .replace(/^[-–—|,:\s]+|[-–—|,:\s]+$/g, '')
            .trim();

        const parsed = finalizeContact(
            { fullName: name || phone, phone },
            'text',
            index
        );

        if (parsed) {
            contacts.push(parsed);
        } else {
            invalid.push({ raw: trimmed, reason: 'Invalid phone number' });
        }
    });

    return {
        contacts: dedupeContacts(contacts),
        invalid,
        format: 'text',
    };
}

export function detectContactFormat(text: string): ContactImportSource {
    const trimmed = text.trim();
    if (/BEGIN:VCARD/i.test(trimmed)) return 'vcard';
    if (trimmed.includes(',') && trimmed.split('\n').length > 1) return 'csv';
    return 'text';
}

export function parseContactImport(text: string, format: ContactImportSource | 'auto' = 'auto'): ParseContactsResult {
    const resolved = format === 'auto' ? detectContactFormat(text) : format;

    if (resolved === 'vcard') return parseVCard(text);
    if (resolved === 'csv') return parseCsvContacts(text);
    return parsePlainTextContacts(text);
}
