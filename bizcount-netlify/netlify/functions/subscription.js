/**
 * BizCount — Subscription Status Function
 * GET /api/subscription
 */

const { getDb, ok, err, verifyToken, CORS_HEADERS } = require('./_firebase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };

  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized.', 401);

  const db  = getDb();
  const uid = decoded.role === 'owner' ? decoded.uid : decoded.owner_id;
  if (!uid) return err('User not found.');

  // Get latest subscription
  const subSnap = await db.collection('subscriptions')
    .where('user_id', '==', uid)
    .orderBy('created_at', 'desc').limit(1).get();

  if (subSnap.empty) {
    return ok({ status: 'no_subscription', label: 'No Subscription', expires: null, days_left: 0 });
  }

  const sub     = subSnap.docs[0].data();
  const subId   = subSnap.docs[0].id;
  const now     = new Date();
  const expires = new Date(sub.expires_at);
  const diffMs  = expires - now;
  const daysLeft= Math.max(0, Math.ceil(diffMs / 86400000));

  // Auto-expire
  if ((sub.status === 'trial' || sub.status === 'active') && expires <= now) {
    await subSnap.docs[0].ref.update({ status: 'expired', updated_at: now.toISOString() });
    return ok({ status: 'expired', label: 'Subscription Expired — Please Renew', expires: sub.expires_at, days_left: 0, id: subId });
  }

  const labels = {
    trial:   `Free Trial — ${daysLeft} day(s) left`,
    active:  `Active — ${daysLeft} day(s) left`,
    expired: 'Expired — Please Renew',
    cancelled: 'Cancelled',
  };

  // Get recent payments
  const paySnap = await db.collection('payments')
    .where('user_id', '==', uid)
    .orderBy('created_at', 'desc').limit(10).get();
  const payments = paySnap.docs.map(d => ({ id: d.id, ...d.data() }));

  return ok({
    status:   sub.status,
    label:    labels[sub.status] || sub.status,
    expires:  sub.expires_at,
    days_left: daysLeft,
    has_access: ['trial', 'active'].includes(sub.status) && expires > now,
    id: subId,
    payments,
  });
};
