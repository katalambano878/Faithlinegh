'use server';

import { verifyAdminToken } from '@/lib/auth';
import { sendSMS } from '@/lib/notifications';

export async function testSmsAction(phone: string, message: string, authToken: string) {
    // SECURITY: Verify admin authentication before allowing SMS sending
    const auth = await verifyAdminToken(authToken);
    if (!auth.authenticated) {
        return {
            success: false,
            error: 'Unauthorized: ' + (auth.error || 'Admin access required')
        };
    }

    try {
        console.log('Testing SMS to:', phone, '| by user:', auth.user?.email);

        // Validate phone input
        if (!phone || typeof phone !== 'string') {
            return { success: false, error: 'Invalid phone number' };
        }

        // Validate message input
        if (!message || typeof message !== 'string' || message.length > 1000) {
            return { success: false, error: 'Invalid or too long message' };
        }

        // Same path as real customer texts: paid from the store's SMS balance
        const result: any = await sendSMS({ to: phone, message });
        if (!result) {
            return { success: false, error: 'SMS is not set up on this server' };
        }
        return {
            success: result.status === 1,
            result,
            error: result.status === 1 ? undefined : (result.error || 'SMS not sent'),
        };
    } catch (error: any) {
        // SECURITY: Don't expose stack traces
        console.error('[Test SMS] Error:', error.message, error.stack);
        return {
            success: false,
            error: error.message || 'SMS sending failed'
        };
    }
}
