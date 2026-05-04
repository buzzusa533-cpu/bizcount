/**
 * BizCount — Products & Stock Function
 * GET  /api/products
 * POST /api/products { action: 'add'|'update'|'delete'|'update-stock' }
 */

const { getDb, ok, err, verifyToken, CORS_HEADERS } = require('./_firebase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };

  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized.', 401);

  const db      = getDb();
  const ownerId = decoded.role === 'owner' ? decoded.uid : decoded.owner_id;
  if (!ownerId) return err('Owner ID not found.');

  // ── GET: list products ────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const snap     = await db.collection('products').where('user_id', '==', ownerId).orderBy('name').get();
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const lowStock = products.filter(p => p.stock_qty <= p.reorder_level);
    return ok({ products, lowStockCount: lowStock.length });
  }

  // ── Only owners can modify products ──────────────────────
  if (decoded.role !== 'owner') return err('Permission denied.', 403);

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const action = body.action || '';

  if (action === 'add') {
    const { name, sku, category, buy_price, sell_price, stock_qty, reorder_level, unit } = body;
    if (!name || !sell_price) return err('Product name and selling price are required.');
    const now = new Date().toISOString();
    const ref = await db.collection('products').add({
      user_id: ownerId,
      name: name.trim(),
      sku: sku || '',
      category: category || '',
      buy_price: parseFloat(buy_price) || 0,
      sell_price: parseFloat(sell_price),
      stock_qty: parseFloat(stock_qty) || 0,
      reorder_level: parseFloat(reorder_level) || 5,
      unit: unit || '',
      is_active: true,
      created_at: now, updated_at: now,
    });
    return ok({ id: ref.id, message: 'Product added!' });
  }

  if (action === 'update') {
    const { id, name, sku, category, buy_price, sell_price, stock_qty, reorder_level, unit } = body;
    if (!id || !name || !sell_price) return err('ID, name and selling price required.');
    await db.collection('products').doc(id).update({
      name: name.trim(), sku: sku || '', category: category || '',
      buy_price: parseFloat(buy_price) || 0,
      sell_price: parseFloat(sell_price),
      stock_qty: parseFloat(stock_qty) || 0,
      reorder_level: parseFloat(reorder_level) || 5,
      unit: unit || '',
      updated_at: new Date().toISOString(),
    });
    return ok({ message: 'Product updated.' });
  }

  if (action === 'update-stock') {
    const { id, stock_qty } = body;
    if (!id) return err('Product ID required.');
    await db.collection('products').doc(id).update({
      stock_qty: parseFloat(stock_qty) || 0,
      updated_at: new Date().toISOString(),
    });
    return ok({ message: 'Stock updated.' });
  }

  if (action === 'delete') {
    const { id } = body;
    if (!id) return err('Product ID required.');
    await db.collection('products').doc(id).delete();
    return ok({ message: 'Product deleted.' });
  }

  return err('Invalid action.');
};
