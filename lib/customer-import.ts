import type { SupabaseClient } from '@supabase/supabase-js';
import { phoneDedupKey } from './phone';
import {
    ParsedWhatsAppContact,
    placeholderEmailFromPhone,
    isPlaceholderImportEmail,
} from './whatsapp-contacts';

export interface CustomerImportOptions {
    mergeDuplicates?: boolean;
    importTag?: string;
    importedBy?: string;
}

export interface CustomerImportRowResult {
    previewId: string;
    fullName: string;
    phone: string;
    status: 'imported' | 'updated' | 'skipped' | 'failed';
    message?: string;
    customerId?: string;
}

export interface CustomerImportResult {
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
    rows: CustomerImportRowResult[];
}

interface ExistingCustomer {
    id: string;
    email: string;
    phone: string | null;
    secondary_phone: string | null;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    tags: string[] | null;
    notes: string | null;
}

function buildPhoneIndex(customers: ExistingCustomer[]): Map<string, ExistingCustomer> {
    const index = new Map<string, ExistingCustomer>();

    for (const customer of customers) {
        for (const rawPhone of [customer.phone, customer.secondary_phone]) {
            if (!rawPhone) continue;
            const key = phoneDedupKey(rawPhone);
            if (key && !index.has(key)) {
                index.set(key, customer);
            }
        }
    }

    return index;
}

function mergeTags(existing: string[] | null, tag: string): string[] {
    const base = existing ? [...existing] : [];
    if (!base.includes(tag)) base.push(tag);
    return base;
}

function buildImportNote(importedBy?: string): string {
    const date = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    const by = importedBy ? ` by ${importedBy}` : '';
    return `Imported from WhatsApp on ${date}${by}`;
}

export async function importWhatsAppContacts(
    supabase: SupabaseClient,
    contacts: ParsedWhatsAppContact[],
    options: CustomerImportOptions = {}
): Promise<CustomerImportResult> {
    const {
        mergeDuplicates = true,
        importTag = 'whatsapp-import',
        importedBy,
    } = options;

    const { data: existingCustomers, error: fetchError } = await supabase
        .from('customers')
        .select('id, email, phone, secondary_phone, full_name, first_name, last_name, tags, notes');

    if (fetchError) {
        throw new Error(`Failed to load existing customers: ${fetchError.message}`);
    }

    const phoneIndex = buildPhoneIndex(existingCustomers || []);
    const emailIndex = new Map(
        (existingCustomers || []).map((c) => [c.email.toLowerCase(), c])
    );

    const rows: CustomerImportRowResult[] = [];
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const contact of contacts) {
        const phoneKey = phoneDedupKey(contact.phone);
        if (!phoneKey) {
            failed += 1;
            rows.push({
                previewId: contact.previewId,
                fullName: contact.fullName,
                phone: contact.phone,
                status: 'failed',
                message: 'Invalid phone number',
            });
            continue;
        }

        const existing = phoneIndex.get(phoneKey);
        const email = contact.email || placeholderEmailFromPhone(contact.phone);

        if (existing) {
            if (!mergeDuplicates) {
                skipped += 1;
                rows.push({
                    previewId: contact.previewId,
                    fullName: contact.fullName,
                    phone: contact.phone,
                    status: 'skipped',
                    message: 'Already exists',
                    customerId: existing.id,
                });
                continue;
            }

            const updates: Record<string, unknown> = {
                tags: mergeTags(existing.tags, importTag),
                updated_at: new Date().toISOString(),
            };

            const hasRealName =
                contact.fullName &&
                contact.fullName !== contact.phone &&
                (!existing.full_name || existing.full_name === existing.phone);

            if (hasRealName) {
                updates.full_name = contact.fullName;
                updates.first_name = contact.firstName;
                updates.last_name = contact.lastName;
            }

            if (contact.email && isPlaceholderImportEmail(existing.email)) {
                updates.email = contact.email;
            }

            const note = buildImportNote(importedBy);
            updates.notes = existing.notes ? `${existing.notes}\n${note}` : note;

            const { error: updateError } = await supabase
                .from('customers')
                .update(updates)
                .eq('id', existing.id);

            if (updateError) {
                failed += 1;
                rows.push({
                    previewId: contact.previewId,
                    fullName: contact.fullName,
                    phone: contact.phone,
                    status: 'failed',
                    message: updateError.message,
                    customerId: existing.id,
                });
                continue;
            }

            updated += 1;
            rows.push({
                previewId: contact.previewId,
                fullName: contact.fullName,
                phone: contact.phone,
                status: 'updated',
                message: 'Merged with existing customer',
                customerId: existing.id,
            });
            continue;
        }

        if (emailIndex.has(email.toLowerCase())) {
            skipped += 1;
            rows.push({
                previewId: contact.previewId,
                fullName: contact.fullName,
                phone: contact.phone,
                status: 'skipped',
                message: 'Email already in use',
            });
            continue;
        }

        const insertPayload = {
            email,
            phone: contact.phone,
            full_name: contact.fullName,
            first_name: contact.firstName || null,
            last_name: contact.lastName || null,
            tags: [importTag],
            notes: buildImportNote(importedBy),
            total_orders: 0,
            total_spent: 0,
        };

        const { data: inserted, error: insertError } = await supabase
            .from('customers')
            .insert(insertPayload)
            .select('id')
            .single();

        if (insertError) {
            failed += 1;
            rows.push({
                previewId: contact.previewId,
                fullName: contact.fullName,
                phone: contact.phone,
                status: 'failed',
                message: insertError.message,
            });
            continue;
        }

        imported += 1;
        const newCustomer: ExistingCustomer = {
            id: inserted.id,
            email,
            phone: contact.phone,
            secondary_phone: null,
            full_name: contact.fullName,
            first_name: contact.firstName,
            last_name: contact.lastName,
            tags: [importTag],
            notes: insertPayload.notes,
        };
        phoneIndex.set(phoneKey, newCustomer);
        emailIndex.set(email.toLowerCase(), newCustomer);

        rows.push({
            previewId: contact.previewId,
            fullName: contact.fullName,
            phone: contact.phone,
            status: 'imported',
            customerId: inserted.id,
        });
    }

    return { imported, updated, skipped, failed, rows };
}
