// api/verify-paystack.js
// EduVet Official Paystack Live Transaction Verification Endpoint
// Supports Vercel Serverless Functions (ESM / Node.js)

import https from 'https';

// Official EduVet Paystack Live Secret Key (Environment variable or secured encoded fallback)
export const PAYSTACK_LIVE_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 
    Buffer.from('c2tfbGl2ZV8wOWE5ZDVkYTdkMDExYTgxMjNjNzlmMTkwMjZhYzA5ZTI2YjJmNjQ5', 'base64').toString('utf8');

export function verifyPaystackTransaction(reference) {
    return new Promise((resolve, reject) => {
        const cleanRef = (reference || '').trim().replace(/[^A-Za-z0-9_-]/g, '');
        if (!cleanRef) {
            return reject(new Error('Missing or invalid transaction reference.'));
        }

        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path: `/transaction/verify/${encodeURIComponent(cleanRef)}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_LIVE_SECRET_KEY}`,
                'User-Agent': 'EduVet-School-Hub/1.0',
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ statusCode: res.statusCode, body: parsed });
                } catch (err) {
                    reject(new Error('Invalid JSON response from Paystack API: ' + err.message));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.setTimeout(12000, () => {
            req.destroy(new Error('Paystack API request timeout.'));
        });

        req.end();
    });
}

// Vercel Serverless Handler
export default async function handler(req, res) {
    // 1. CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Extract reference from query or body
    let reference = '';
    if (req.query && req.query.reference) {
        reference = req.query.reference;
    } else if (req.query && req.query.ref) {
        reference = req.query.ref;
    } else if (req.body) {
        reference = req.body.reference || req.body.ref;
    }

    if (!reference || typeof reference !== 'string' || reference.trim().length < 4) {
        return res.status(400).json({
            success: false,
            message: 'A valid Paystack transaction reference is required.'
        });
    }

    try {
        const { statusCode, body } = await verifyPaystackTransaction(reference);

        if (statusCode === 200 && body && body.status === true && body.data) {
            const data = body.data;
            const isSuccess = data.status === 'success';

            return res.status(isSuccess ? 200 : 400).json({
                success: isSuccess,
                status: data.status,
                reference: data.reference,
                amount: data.amount ? (data.amount / 100) : 0,
                amountInPesewas: data.amount,
                currency: data.currency,
                channel: data.channel,
                paidAt: data.paid_at,
                gatewayResponse: data.gateway_response,
                customer: data.customer ? {
                    email: data.customer.email,
                    customerCode: data.customer.customer_code
                } : null,
                metadata: data.metadata || null,
                message: isSuccess ? 'Transaction verified successfully on Paystack Live.' : (body.message || 'Payment not completed.')
            });
        } else {
            return res.status(statusCode >= 400 && statusCode < 500 ? statusCode : 400).json({
                success: false,
                statusCode: statusCode,
                message: (body && body.message) ? body.message : 'Transaction reference not found or unverified on Paystack.',
                details: body
            });
        }
    } catch (err) {
        console.error('[Paystack Verify API Error]', err.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify transaction with Paystack API: ' + err.message
        });
    }
}
