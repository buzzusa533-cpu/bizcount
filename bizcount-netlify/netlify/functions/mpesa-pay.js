/**
 * BizCount — M-Pesa STK Push Function
 * POST /api/mpesa-pay { phone, amount }
 */

const fetch = require('node-fetch');
const { getDb, ok, err, verifyToken, formatMpesaPhone, CORS_HEADERS } = require('./_firebase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };

  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized.', 401);

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}

  const phone  = formatMpesaPhone(body.phone || '');
  const amount = parseInt(body.amount || process.env.WEEKLY_PRICE || '200');

  if (!/^2547\d{8}$/.test(phone)) return err('Invalid M-Pesa phone number. Use format: 0712345678');
  if (amount < 1) return err('Invalid amount.');

  // 1. Get access token
  const token = await getMpesaToken();
  if (!token) return err('Could not connect to M-Pesa. Please try again later.');

  // 2. Build STK Push payload
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey   = process.env.MPESA_PASSKEY;
  const password  = Buffer.from(shortcode + passkey + timestamp).toString('base64');

  const payload = {
    BusinessShortCode: shortcode,
    Password:          password,
    Timestamp:         timestamp,
    TransactionType:   process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
    Amount:            amount,
    PartyA:            phone,
    PartyB:            shortcode,
    PhoneNumber:       phone,
    CallBackURL:       process.env.MPESA_CALLBACK_URL,
    AccountReference:  'BizCount-' + decoded.uid.slice(0, 8),
    TransactionDesc:   'BizCount Weekly Subscription',
  };

  const baseUrl = process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  try {
    const res  = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.ResponseCode === '0') {
      // Save pending payment to Firestore
      const db  = getDb();
      const ref = await db.collection('payments').add({
        user_id: decoded.uid,
        amount, phone,
        checkout_request_id: data.CheckoutRequestID,
        merchant_request_id: data.MerchantRequestID,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      return ok({
        checkout_request_id: data.CheckoutRequestID,
        payment_id: ref.id,
        message: `M-Pesa prompt sent to ${phone}. Enter your PIN on your phone to confirm.`,
      });
    } else {
      return err(data.errorMessage || data.ResponseDescription || 'M-Pesa request failed.');
    }
  } catch (e) {
    console.error('M-Pesa STK error:', e);
    return err('M-Pesa service error. Please try again.');
  }
};

async function getMpesaToken() {
  const baseUrl = process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
  const creds = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');
  try {
    const res  = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${creds}` },
    });
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}
