/**
 * BizCount — Expenses Function
 * GET  /api/expenses
 * POST /api/expenses { action: 'add'|'delete' }
 */

const { getDb, ok, err, verifyToken, CORS_HEADERS } = require('./_firebase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };

  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized.', 401);
  if (decoded.role !== 'owner') return err('Owner access required.', 403);

  const db = getDb();
  const uid = decoded.uid;

  if (event.httpMethod === 'GET') {
    const range  = parseInt(event.queryStringParameters?.range || '30');
    const cutoff = new Date(Date.now() - range * 86400000).toISOString().slice(0, 10);
    const snap   = await db.collection('expenses')
      .where('user_id', '==', uid)
      .where('expense_date', '>=', cutoff)
      .orderBy('expense_date', 'desc').get();
    const expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const total    = expenses.reduce((a, e) => a + (e.amount || 0), 0);
    return ok({ expenses, total });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const action = body.action || '';

  if (action === 'add') {
    const { category, amount, description, expense_date } = body;
    if (!category || !amount) return err('Category and amount are required.');
    const now = new Date().toISOString();
    const ref = await db.collection('expenses').add({
      user_id: uid, category,
      amount: parseFloat(amount),
      description: description || '',
      expense_date: expense_date || now.slice(0, 10),
      created_at: now,
    });
    return ok({ id: ref.id, message: 'Expense logged.' });
  }

  if (action === 'delete') {
    const { id } = body;
    if (!id) return err('Expense ID required.');
    await db.collection('expenses').doc(id).delete();
    return ok({ message: 'Expense deleted.' });
  }

  return err('Invalid action.');
};
