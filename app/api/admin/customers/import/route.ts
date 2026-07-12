import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { importWhatsAppContacts } from '@/lib/customer-import';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
    parseContactImport,
    type ContactImportSource,
    type ParsedWhatsAppContact,
} from '@/lib/whatsapp-contacts';

const MAX_IMPORT_BATCH = 2000;
const MAX_CONTENT_LENGTH = 5_000_000;

interface ImportRequestBody {
    contacts?: ParsedWhatsAppContact[];
    content?: string;
    format?: ContactImportSource | 'auto';
    mergeDuplicates?: boolean;
    previewOnly?: boolean;
}

export async function POST(request: Request) {
    const auth = await verifyAuth(request, { requireAdmin: true });
    if (!auth.authenticated) {
        return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    let body: ImportRequestBody;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let contacts: ParsedWhatsAppContact[] = [];

    if (body.content) {
        if (body.content.length > MAX_CONTENT_LENGTH) {
            return NextResponse.json(
                { error: 'Import file is too large. Try splitting into smaller batches.' },
                { status: 400 }
            );
        }

        const parsed = parseContactImport(body.content, body.format || 'auto');
        contacts = parsed.contacts;

        if (body.previewOnly) {
            return NextResponse.json({
                success: true,
                preview: true,
                format: parsed.format,
                contacts: parsed.contacts,
                invalid: parsed.invalid,
                totalValid: parsed.contacts.length,
                totalInvalid: parsed.invalid.length,
            });
        }
    } else if (Array.isArray(body.contacts)) {
        contacts = body.contacts;
    } else {
        return NextResponse.json(
            { error: 'Provide either "content" (vCard/CSV/text) or "contacts" array' },
            { status: 400 }
        );
    }

    if (contacts.length === 0) {
        return NextResponse.json({ error: 'No valid contacts to import' }, { status: 400 });
    }

    if (contacts.length > MAX_IMPORT_BATCH) {
        return NextResponse.json(
            { error: `Maximum ${MAX_IMPORT_BATCH} contacts per import. Split into smaller batches.` },
            { status: 400 }
        );
    }

    try {
        const result = await importWhatsAppContacts(supabaseAdmin, contacts, {
            mergeDuplicates: body.mergeDuplicates !== false,
            importedBy: auth.user?.email,
        });

        return NextResponse.json({
            success: true,
            ...result,
            total: contacts.length,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Import failed';
        console.error('[customers/import]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
