/**
 * BizCount — M-Pesa Callback Function
 * POST /api/mpesa-callback
 * Receives payment confirmation from Safaricom servers
 */

const { getDb, CORS_HEADERS } = require('./_firebase');

exports.handler = async (event) => {
  // Always respond 200 to Safaricom
  const respond = (msg = 'Accepted') => ({
    statusCode: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ResultCode: 0, ResultDesc: msg }),
  });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };

  let data = {};
  try { data = JSON.parse(event.body || '{}'); } catch {
    console.error('BizCount callback: Invalid JSON');
    return respond('Invalid payload');
  }

  console.log('BizCount M-Pesa Callback:', JSON.stringify(data));

  const stkCallback = data?.Body?.stkCallback;
  if (!stkCallback) return respond('No stkCallback');

  const checkoutRequestId = stkCallback.CheckoutRequestID || '';
  const resultCode        = parseInt(stkCallback.ResultCode ?? -1);
  const resultDesc        = stkCallback.ResultDesc || '';

  const db = getDb();

  // ── Payment FAILED ────────────────────────────────────────
  if (resultCode !== 0) {
    console.log(`BizCount: Payment failed [${checkoutRequestId}]: ${resultDesc}`);
    try {
      const snap = await db.collection('payments')
        .where('checkout_request_id', '==', checkoutRequestId).limit(1).get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({
          status: 'failed',
          result_description: resultDesc,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e) { console.error('DB error on failed payment:', e.message); }
    return respond('Received');
  }

  // ── Payment SUCCEEDED — extract metadata ──────────────────
  const items = stkCallback?.CallbackMetadata?.Item || [];
  const meta  = {};
  items.forEach(item => { meta[item.Name] = item.Value; });

  const mpesaReceipt   = meta.MpesaReceiptNumber  || null;
  const transactionDate= meta.TransactionDate      || null;
  const phoneNumber    = String(meta.PhoneNumber   || '');
  const amount         = parseFloat(meta.Amount    || 0);

  console.log(`BizCount: Payment success [${checkoutRequestId}] Receipt:${mpesaReceipt} Amount:${amount}`);

  try {
    // Find pending payment record
    const paySnap = await db.collection('payments')
      .where('checkout_request_id', '==', checkoutRequestId).limit(1).get();

    if (paySnap.empty) {
      console.warn('BizCount: No payment found for', checkoutRequestId);
      return respond('Received');
    }

    const payDoc = paySnap.docs[0];
    const userId = payDoc.data().user_id;

    // Mark payment completed
    await payDoc.ref.update({
      status: 'completed',
      mpesa_receipt: mpesaReceipt,
      mpesa_phone: phoneNumber,
      amount,
      transaction_date: transactionDate ? String(transactionDate) : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Get current subscription
    const subSnap = await db.collection('subscriptions')
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc').limit(1).get();

    const subDays   = parseInt(process.env.SUBSCRIPTION_DAYS || '7');
    const now       = new Date();
    let baseDate    = now;

    if (!subSnap.empty) {
      const current = subSnap.docs[0].data();
      const expires = new Date(current.expires_at);
      if (current.status === 'active' && expires > now) baseDate = expires;
    }

    const newExpiry = new Date(baseDate.getTime() + subDays * 86400000).toISOString();

    if (!subSnap.empty) {
      await subSnap.docs[0].ref.update({
        status: 'active',
        expires_at: newExpiry,
        updated_at: now.toISOString(),
      });
    } else {
      await db.collection('subscriptions').add({
        user_id: userId, status: 'active',
        started_at: now.toISOString(),
        expires_at: newExpiry,
        created_at: now.toISOString(),
      });
    }

    console.log(`BizCount: Subscription activated for user ${userId}, expires ${newExpiry}`);

  } catch (e) {
    console.error('BizCount callback DB error:', e.message);
  }

  return respond('Accepted');
};
