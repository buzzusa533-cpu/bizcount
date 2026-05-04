/**
 * BizCount — Staff Management Function
 * GET  /api/staff
 * POST /api/staff { action: 'create'|'toggle'|'delete' }
 */

const bcrypt = require('bcryptjs');
const { getDb, ok, err, verifyToken, formatMpesaPhone, CORS_HEADERS } = require('./_firebase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };

  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized.', 401);
  if (decoded.role !== 'owner') return err('Owner access required.', 403);

  const db      = getDb();
  const ownerId = decoded.uid;

  // GET: list staff
  if (event.httpMethod === 'GET') {
    const snap  = await db.collection('users')
      .where('owner_id', '==', ownerId)
      .where('role', '==', 'staff')
      .orderBy('first_name').get();
    const staff = snap.docs.map(d => {
      const { password_hash, ...safe } = d.data();
      return { id: d.id, ...safe };
    });
    return ok({ staff });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const action = body.action || '';

  // CREATE staff account
  if (action === 'create') {
    const { first_name, last_name, email, phone, password } = body;
    if (!first_name || !last_name || !email) return err('Name and email are required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Invalid email address.');

    // Check duplicate
    const existing = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
    if (!existing.empty) return err('A user with this email already exists.');

    // Get owner's business name
    const ownerDoc = await db.collection('users').doc(ownerId).get();
    const businessName = ownerDoc.data()?.business_name || '';

    const tempPw   = password || Math.random().toString(36).slice(-8);
    const pwHash   = await bcrypt.hash(tempPw, 10);
    const now      = new Date().toISOString();
    const staffRef = db.collection('users').doc();

    await staffRef.set({
      id: staffRef.id,
      owner_id: ownerId,
      first_name, last_name,
      business_name: businessName,
      email: email.toLowerCase(),
      phone: phone || '',
      mpesa_phone: phone ? formatMpesaPhone(phone) : '',
      password_hash: pwHash,
      role: 'staff',
      is_active: true,
      created_at: now, updated_at: now,
    });

    return ok({ id: staffRef.id, temp_password: tempPw, message: `Staff account created. Temp password: ${tempPw}` });
  }

  // TOGGLE active/inactive
  if (action === 'toggle') {
    const { id } = body;
    if (!id) return err('Staff ID required.');
    const snap = await db.collection('users').doc(id).get();
    if (!snap.exists || snap.data().owner_id !== ownerId) return err('Staff not found.');
    await snap.ref.update({ is_active: !snap.data().is_active, updated_at: new Date().toISOString() });
    return ok({ message: 'Staff status updated.' });
  }

  // DELETE
  if (action === 'delete') {
    const { id } = body;
    if (!id) return err('Staff ID required.');
    const snap = await db.collection('users').doc(id).get();
    if (!snap.exists || snap.data().owner_id !== ownerId) return err('Staff not found.');
    await snap.ref.delete();
    return ok({ message: 'Staff account deleted.' });
  }

  return err('Invalid action.');
};
