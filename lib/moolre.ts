/**
 * Moolre payment gateway helpers.
 *
 * Docs:
 *   - Generate Payment Link: POST https://api.moolre.com/embed/link
 *   - Payment Status:        POST https://api.moolre.com/open/transact/status
 *   - Webhook:               Moolre POSTs { status, code, message, data } to our callback URL
 *
 * Auth headers: X-API-USER + X-API-PUBKEY.
 */

export const MOOLRE_BASE = 'https://api.moolre.com';

export function moolreConfigured(): boolean {
    return Boolean(
        process.env.MOOLRE_API_USER &&
        process.env.MOOLRE_API_PUBKEY &&
        process.env.MOOLRE_ACCOUNT_NUMBER
    );
}

function moolreHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'X-API-USER': process.env.MOOLRE_API_USER as string,
        'X-API-PUBKEY': process.env.MOOLRE_API_PUBKEY as string,
    };
}

export interface MoolreLinkParams {
    amount: number;          // GHS
    email: string;
    externalref: string;     // unique per attempt
    callback?: string;
    redirect?: string;
    metadata?: Record<string, unknown>;
    expirationMinutes?: number;
}

export interface MoolreLinkResult {
    success: boolean;
    url?: string;
    reference?: string;
    message?: string;
    raw?: any;
}

/** Generate a hosted Moolre payment page URL. */
export async function generateMoolreLink(params: MoolreLinkParams): Promise<MoolreLinkResult> {
    const body: Record<string, unknown> = {
        type: 1,
        amount: params.amount.toFixed(2),
        email: params.email,
        externalref: params.externalref,
        reusable: '0',
        currency: 'GHS',
        accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER,
    };
    if (params.callback) body.callback = params.callback;
    if (params.redirect) body.redirect = params.redirect;
    if (params.metadata) body.metadata = params.metadata;
    if (params.expirationMinutes) body.expiration_time = params.expirationMinutes;

    const res = await fetch(`${MOOLRE_BASE}/embed/link`, {
        method: 'POST',
        headers: moolreHeaders(),
        body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({}));
    const ok = (json?.status == 1 || json?.status === '1') && json?.data?.authorization_url;

    if (ok) {
        return {
            success: true,
            url: json.data.authorization_url,
            reference: json.data.reference,
            raw: json,
        };
    }
    return {
        success: false,
        message: json?.message || 'Failed to generate payment link',
        raw: json,
    };
}

export interface MoolreStatus {
    confirmed: boolean;       // txstatus === 1
    amount: number | null;    // GHS
    transactionId?: string;
    externalref?: string;
    raw?: any;
}

/**
 * Check the status of a Moolre collection. `idtype` 1 = our externalref,
 * 2 = Moolre transaction id.
 */
export async function getMoolreStatus(id: string, idtype: '1' | '2' = '1'): Promise<MoolreStatus> {
    const res = await fetch(`${MOOLRE_BASE}/open/transact/status`, {
        method: 'POST',
        headers: moolreHeaders(),
        body: JSON.stringify({
            type: 1,
            idtype,
            id,
            accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER,
        }),
    });

    const json = await res.json().catch(() => ({}));
    const data = json?.data || {};
    const confirmed = (json?.status == 1 || json?.status === '1') && Number(data.txstatus) === 1;
    const rawAmount = data.amount ?? data.value;

    return {
        confirmed,
        amount: rawAmount !== undefined && rawAmount !== null ? Number(rawAmount) : null,
        transactionId: data.transactionid,
        externalref: data.externalref,
        raw: json,
    };
}

/** Recover the merchant order number from a Moolre externalref (strips -R<ts>). */
export function orderRefFromExternal(externalref: string): string {
    return (externalref || '').replace(/-R\d+$/, '');
}
