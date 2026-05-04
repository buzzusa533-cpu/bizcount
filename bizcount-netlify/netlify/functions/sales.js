/**
 * BizCount — Sales Function
 * GET  /api/sales?action=list&range=30
 * POST /api/sales  { action: 'add', ... }
 * POST /api/sales  { action: 'delete', id }
 */

const { getDb, ok, err, verifyToken, CORS_HEADERS } = require('./_firebase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };

  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized.', 401);

  const db      = getDb();
  const ownerId = decoded.role === 'owner' ? decoded.uid : decoded.owner_id;
  if (!ownerId) return err('Owner ID not found.', 400);

  // ── GET: list sales ───────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const range     = parseInt(event.queryStringParameters?.range || '30');
    const cutoff    = new Date(Date.now() - range * 86400000).toISOString();
    const staffFilter = event.queryStringParameters?.staff_id || null;

    let query = db.collection('sales')
      .where('user_id', '==', ownerId)
      .where('sale_date', '>=', cutoff.slice(0, 10))
      .orderBy('sale_date', 'desc');

    const snap  = await query.get();
    let sales   = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (staffFilter) sales = sales.filter(s => s.staff_id === staffFilter);

    // Attach product names
    const prodSnap = await db.collection('products').where('user_id', '==', ownerId).get();
    const prodMap  = {};
    prodSnap.docs.forEach(d => { prodMap[d.id] = d.data().name; });
    sales = sales.map(s => ({ ...s, product_name: prodMap[s.product_id] || '—' }));

    // Summary stats
    const today = new Date().toISOString().slice(0, 10);
    const todayTotal   = sales.filter(s => s.sale_date === today).reduce((a, s) => a + (s.total || 0), 0);
    const rangeTotal   = sales.reduce((a, s) => a + (s.total || 0), 0);

    return ok({ sales, todayTotal, rangeTotal });
  }

  // ── POST: add/delete sale ─────────────────────────────────
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}

  const action = body.action || '';

  if (action === 'add') {
    const { product_id, qty, unit_price, notes, sale_date } = body;
    if (!product_id || !qty || !unit_price) return err('Product, quantity and price are required.');

    const total    = parseFloat(qty) * parseFloat(unit_price);
    const saleDate = sale_date || new Date().toISOString().slice(0, 10);
    const now      = new Date().toISOString();

    const saleRef = await db.collection('sales').add({
      user_id: ownerId,
      staff_id: decoded.role === 'staff' ? decoded.uid : null,
      product_id, qty: parseFloat(qty),
      unit_price: parseFloat(unit_price),
      total, notes: notes || '',
      sale_date: saleDate, created_at: now,
    });

    // Reduce stock
    const prodRef = db.collection('products').doc(product_id);
    const prodDoc = await prodRef.get();
    if (prodDoc.exists) {
      const current = prodDoc.data().stock_qty || 0;
      await prodRef.update({ stock_qty: Math.max(0, current - parseFloat(qty)), updated_at: now });
    }

    return ok({ id: saleRef.id, message: 'Sale recorded!' });
  }

  if (action === 'delete') {
    if (decoded.role !== 'owner') return err('Only owners can delete sales.', 403);
    const { id } = body;
    if (!id) return err('Sale ID required.');
    await db.collection('sales').doc(id).delete();
    return ok({ message: 'Sale deleted.' });
  }

  return err('Invalid action.');
};
