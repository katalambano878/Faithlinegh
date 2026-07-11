import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendOrderConfirmation } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { getMoolreStatus, orderRefFromExternal, moolreConfigured } from '@/lib/moolre';

/**
 * Moolre Payment Webhook Handler.
 *
 * Moolre sends: { status, code, message, data: { externalref, transactionid, amount, txstatus, ... } }
 *
 * SECURITY: Moolre callbacks are not HMAC-signed, so we never trust the
 * webhook body. We extract the reference, then re-query Moolre's status API
 * to confirm the payment and amount before marking the order paid.
 */
export async function POST(req: Request) {
    console.log('[Moolre Callback] POST received at', new Date().toISOString());

    try {
        const clientId = getClientIdentifier(req);
        const rateLimitResult = checkRateLimit(`callback:${clientId}`, RATE_LIMITS.callback);

        if (!rateLimitResult.success) {
            console.warn('[Moolre Callback] Rate limited:', clientId);
            return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
        }

        if (!moolreConfigured()) {
            console.error('[Moolre Callback] Moolre not configured');
            return NextResponse.json({ success: false, message: 'Server configuration error' }, { status: 500 });
        }

        let body: any = {};
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ success: false, message: 'Invalid body' }, { status: 400 });
        }

        const data = body?.data || {};
        const externalref: string = data.externalref || '';
        const transactionId: string = data.transactionid || '';

        console.log('[Moolre Callback] Ref:', externalref, '| TxId:', transactionId, '| Status:', body?.status);

        if (!externalref && !transactionId) {
            console.error('[Moolre Callback] Missing reference');
            return NextResponse.json({ success: false, message: 'Missing reference' }, { status: 400 });
        }

        // ============================================================
        // SECURITY: Re-query Moolre to confirm — never trust the webhook body.
        // ============================================================
        const status = externalref
            ? await getMoolreStatus(externalref, '1')
            : await getMoolreStatus(transactionId, '2');

        const merchantOrderRef = orderRefFromExternal(externalref || status.externalref || '');

        if (!merchantOrderRef) {
            console.error('[Moolre Callback] Could not resolve order reference');
            return NextResponse.json({ success: false, message: 'Missing order reference' }, { status: 400 });
        }

        if (!status.confirmed) {
            console.log('[Moolre Callback] Payment not successful for', merchantOrderRef);

            const { data: failedOrder } = await supabaseAdmin
                .from('orders')
                .select('metadata, payment_status')
                .eq('order_number', merchantOrderRef)
                .single();

            if (failedOrder && failedOrder.payment_status !== 'paid') {
                await supabaseAdmin
                    .from('orders')
                    .update({
                        payment_status: 'failed',
                        metadata: {
                            ...(failedOrder?.metadata || {}),
                            moolre_externalref: externalref,
                            failure_reason: body?.message || 'Payment not successful',
                            failed_at: new Date().toISOString(),
                        },
                    })
                    .eq('order_number', merchantOrderRef);
            }

            return NextResponse.json({ success: false, message: 'Payment not successful' });
        }

        console.log('[Moolre Callback] Payment SUCCESS for Order', merchantOrderRef);

        const { data: existingOrder, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('id, order_number, payment_status, total, email, metadata')
            .eq('order_number', merchantOrderRef)
            .single();

        if (fetchError || !existingOrder) {
            console.error('[Moolre Callback] Order not found:', merchantOrderRef);
            return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
        }

        // Idempotent: already paid
        if (existingOrder.payment_status === 'paid') {
            console.log('[Moolre Callback] Order already paid, skipping:', merchantOrderRef);
            return NextResponse.json({ success: true, message: 'Order already processed' });
        }

        // ============================================================
        // SECURITY: Verify amount matches — REJECT if mismatch.
        // ============================================================
        if (status.amount !== null) {
            const expectedAmount = Number(existingOrder.total);
            if (Math.abs(status.amount - expectedAmount) > 0.01) {
                console.error('[Moolre Callback] AMOUNT MISMATCH — REJECTING! Expected:', expectedAmount, 'Got:', status.amount, 'Order:', merchantOrderRef);
                return NextResponse.json({
                    success: false,
                    message: 'Payment amount does not match order total',
                }, { status: 400 });
            }
        }

        const { data: orderJson, error: updateError } = await supabaseAdmin
            .rpc('mark_order_paid', {
                order_ref: merchantOrderRef,
                moolre_ref: String(status.transactionId || transactionId || externalref),
            });

        if (updateError) {
            console.error('[Moolre Callback] RPC Error:', updateError.message);
            return NextResponse.json({ success: false, message: 'Database update failed' }, { status: 500 });
        }

        if (!orderJson) {
            console.error('[Moolre Callback] Order not found after RPC:', merchantOrderRef);
            return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
        }

        // Annotate metadata AND atomically claim the right to send the
        // confirmation — the verify route does the same, so whichever
        // path wins the conditional update is the only one that notifies.
        let shouldNotify = false;
        try {
            const { data: claimed } = await supabaseAdmin
                .from('orders')
                .update({
                    metadata: {
                        ...(orderJson.metadata || {}),
                        payment_provider: 'moolre',
                        moolre_externalref: externalref,
                        moolre_transaction_id: status.transactionId || transactionId,
                        moolre_paid_at: new Date().toISOString(),
                        confirmation_sent_at: new Date().toISOString(),
                    },
                })
                .eq('id', orderJson.id)
                .is('metadata->>confirmation_sent_at', null)
                .select('id');
            shouldNotify = !!claimed?.length;
        } catch (annotateErr: any) {
            console.warn('[Moolre Callback] Metadata annotate failed:', annotateErr.message);
        }

        console.log('[Moolre Callback] Order updated! ID:', orderJson.id, '| Status:', orderJson.status);

        try {
            if (orderJson.email) {
                await supabaseAdmin.rpc('update_customer_stats', {
                    p_customer_email: orderJson.email,
                    p_order_total: orderJson.total,
                });
            }
        } catch (statsError: any) {
            console.error('[Moolre Callback] Customer stats failed:', statsError.message);
        }

        if (shouldNotify) {
            try {
                await sendOrderConfirmation(orderJson);
                console.log('[Moolre Callback] Notifications sent!');
            } catch (notifyError: any) {
                console.error('[Moolre Callback] Notification failed:', notifyError.message);
            }
        }

        return NextResponse.json({ success: true, message: 'Payment verified and order updated' });

    } catch (error: any) {
        console.error('[Moolre Callback] Critical Error:', error.message);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({
        message: 'Moolre callback endpoint ready',
        timestamp: new Date().toISOString(),
    });
}
