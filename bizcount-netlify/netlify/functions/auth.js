/**
 * BizCount — Auth Function
 * POST /api/auth
 * Actions: register, login, me, change-password
 */

const bcrypt = require('bcryptjs');
const { getDb, ok, err, signToken, verifyToken, formatMpesaPhone, tsToIso, CORS_HEADERS } = require('./_firebase');

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

  const action = body.action || event.queryStringParameters?.action || '';
  const db = getDb();

  // ══════════════════════════════════════════════
  // REGISTER
  // ══════════════════════════════════════════════
  if (action === 'register') {
    const { first_name, last_name, business_name, email, phone, password } = body;

    if (!first_name || !last_name || !business_name || !email || !phone || !password)
      return err('All fields are required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return err('Invalid email address.');
    if (password.length < 8)
      return err('Password must be at least 8 characters.');
    if (!/^(0[17]\d{8}|254[17]\d{8})$/.test(phone.replace(/\s/g, '')))
      return err('Enter a valid Kenyan phone number (e.g. 0712345678).');

    // Check duplicate email
    const existing = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
    if (!existing.empty) return err('An account with this email already exists.');

    const passwordHash = await bcrypt.hash(password, 12);
    const mpesaPhone   = formatMpesaPhone(phone);
    const now          = new Date().toISOString();
    const trialExpires = new Date(Date.now() + (parseInt(process.env.TRIAL_DAYS || '7')) * 86400000).toISOString();

    // Create user
    const userRef = db.collection('users').doc();
    const userId  = userRef.id;

    const userData = {
      id: userId, first_name, last_name,
      business_name, email: email.toLowerCase(),
      phone, mpesa_phone: mpesaPhone,
      password_hash: passwordHash,
      role: 'owner', owner_id: null,
      is_active: true,
      created_at: now, updated_at: now,
    };
    await userRef.set(userData);

    // Create trial subscription
    await db.collection('subscriptions').add({
      user_id: userId, status: 'trial',
      started_at: now, expires_at: trialExpires,
      created_at: now,
    });

    const token = signToken({ uid: userId, role: 'owner', email: email.toLowerCase() });
    const { password_hash, ...safeUser } = userData;

    return ok({
      token,
      user: safeUser,
      message: 'Account created! Your 7-day free trial has started.',
    });
  }

  // ══════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════
  if (action === 'login') {
    const { email, password, role = 'owner' } = body;
    if (!email || !password) return err('Email and password are required.');

    const snap = await db.collection('users')
      .where('email', '==', email.toLowerCase())
      .where('role', '==', role)
      .limit(1).get();

    if (snap.empty) return err('Invalid email or password.');
    const userDoc = snap.docs[0];
    const user    = userDoc.data();

    if (!user.is_active) return err('Your account has been deactivated. Contact the owner.');

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return err('Invalid email or password.');

    // Update last login
    await userDoc.ref.update({ last_login: new Date().toISOString() });

    const token = signToken({ uid: user.id, role: user.role, email: user.email, owner_id: user.owner_id || null });
    const { password_hash, ...safeUser } = user;

    return ok({ token, user: safeUser });
  }

  // ══════════════════════════════════════════════
  // GET CURRENT USER
  // ══════════════════════════════════════════════
  if (action === 'me') {
    const decoded = verifyToken(event);
    if (!decoded) return err('Unauthorized.', 401);

    const snap = await db.collection('users').doc(decoded.uid).get();
    if (!snap.exists) return err('User not found.', 404);

    const user = snap.data();
    const { password_hash, ...safeUser } = user;

    // Get subscription
    const subSnap = await db.collection('subscriptions')
      .where('user_id', '==', decoded.uid)
      .orderBy('created_at', 'desc').limit(1).get();

    let subscription = null;
    if (!subSnap.empty) {
      subscription = subSnap.docs[0].data();
      subscription.id = subSnap.docs[0].id;
    }

    return ok({ user: safeUser, subscription });
  }

  // ══════════════════════════════════════════════
  // CHANGE PASSWORD
  // ══════════════════════════════════════════════
  if (action === 'change-password') {
    const decoded = verifyToken(event);
    if (!decoded) return err('Unauthorized.', 401);

    const { old_password, new_password } = body;
    if (!old_password || !new_password) return err('Both passwords required.');
    if (new_password.length < 8) return err('New password must be at least 8 characters.');

    const snap = await db.collection('users').doc(decoded.uid).get();
    const user = snap.data();
    const match = await bcrypt.compare(old_password, user.password_hash);
    if (!match) return err('Current password is incorrect.');

    const newHash = await bcrypt.hash(new_password, 12);
    await snap.ref.update({ password_hash: newHash, updated_at: new Date().toISOString() });
    return ok({ message: 'Password changed successfully.' });
  }

  // ══════════════════════════════════════════════
  // UPDATE PROFILE
  // ══════════════════════════════════════════════
  if (action === 'update-profile') {
    const decoded = verifyToken(event);
    if (!decoded) return err('Unauthorized.', 401);
    const { first_name, last_name, business_name, phone } = body;
    if (!first_name || !last_name || !business_name) return err('Name and business name required.');
    await db.collection('users').doc(decoded.uid).update({
      first_name, last_name, business_name,
      phone: phone || '',
      mpesa_phone: phone ? formatMpesaPhone(phone) : '',
      updated_at: new Date().toISOString(),
    });
    return ok({ message: 'Profile updated.' });
  }

  return err('Invalid action.');
};
