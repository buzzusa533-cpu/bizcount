/**
 * BizCount — Reports & Dashboard Stats Function
 * GET /api/reports?range=30
 */

const { getDb, ok, err, verifyToken, CORS_HEADERS } = require('./_firebase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };

  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized.', 401);
  if (decoded.role !== 'owner') return err('Owner access required.', 403);

  const db    = getDb();
  const uid   = decoded.uid;
  const range = parseInt(event.queryStringParameters?.range || '30');
  const today = new Date().toISOString().slice(0, 10);

  // Cutoff date for range
  const cutoff = new Date(Date.now() - range * 86400000).toISOString().slice(0, 10);

  // ── Fetch all data in parallel ────────────────────────────
  const [salesSnap, expensesSnap, productsSnap, staffSnap] = await Promise.all([
    db.collection('sales').where('user_id', '==', uid).where('sale_date', '>=', cutoff).orderBy('sale_date', 'desc').get(),
    db.collection('expenses').where('user_id', '==', uid).where('expense_date', '>=', cutoff).orderBy('expense_date', 'desc').get(),
    db.collection('products').where('user_id', '==', uid).get(),
    db.collection('users').where('owner_id', '==', uid).where('role', '==', 'staff').get(),
  ]);

  const sales    = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const expenses = expensesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Attach product names to sales
  const prodMap = {};
  products.forEach(p => { prodMap[p.id] = p.name; });
  const salesWithNames = sales.map(s => ({ ...s, product_name: prodMap[s.product_id] || '—' }));

  // ── Core stats ────────────────────────────────────────────
  const totalRevenue  = sales.reduce((a, s) => a + (s.total || 0), 0);
  const totalExpenses = expenses.reduce((a, e) => a + (e.amount || 0), 0);
  const netProfit     = totalRevenue - totalExpenses;
  const todaySales    = sales.filter(s => s.sale_date === today).reduce((a, s) => a + (s.total || 0), 0);
  const lowStockCount = products.filter(p => p.stock_qty <= p.reorder_level).length;

  // ── Daily sales chart data (last 7 days) ──────────────────
  const last7 = [];
  const last7Labels = [];
  for (let i = 6; i >= 0; i--) {
    const d   = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const sum = sales.filter(s => s.sale_date === d).reduce((a, s) => a + (s.total || 0), 0);
    last7.push(sum);
    last7Labels.push(new Date(d).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric' }));
  }

  // ── Monthly revenue vs expenses (last 6 months) ───────────
  const monthlyLabels  = [];
  const monthlyRevenue = [];
  const monthlyExp     = [];
  for (let i = 5; i >= 0; i--) {
    const d   = new Date();
    d.setMonth(d.getMonth() - i);
    const m   = d.toISOString().slice(0, 7); // YYYY-MM
    const rev = sales.filter(s => s.sale_date?.startsWith(m)).reduce((a, s) => a + (s.total || 0), 0);
    const exp = expenses.filter(e => e.expense_date?.startsWith(m)).reduce((a, e) => a + (e.amount || 0), 0);
    monthlyLabels.push(d.toLocaleDateString('en-KE', { month: 'short' }));
    monthlyRevenue.push(rev);
    monthlyExp.push(exp);
  }

  // ── Top products ──────────────────────────────────────────
  const productTotals = {};
  sales.forEach(s => {
    if (!s.product_id) return;
    productTotals[s.product_id] = (productTotals[s.product_id] || 0) + (s.total || 0);
  });
  const topProducts = Object.entries(productTotals)
    .map(([id, total]) => ({ id, name: prodMap[id] || '—', total }))
    .sort((a, b) => b.total - a.total).slice(0, 5);

  // ── Expense breakdown by category ─────────────────────────
  const expByCategory = {};
  expenses.forEach(e => {
    expByCategory[e.category] = (expByCategory[e.category] || 0) + (e.amount || 0);
  });

  return ok({
    stats: {
      todaySales, totalRevenue, totalExpenses, netProfit,
      salesCount: sales.length,
      productCount: products.length,
      staffCount: staffSnap.size,
      lowStockCount,
    },
    charts: {
      daily: { labels: last7Labels, values: last7 },
      monthly: { labels: monthlyLabels, revenue: monthlyRevenue, expenses: monthlyExp },
      topProducts,
      expByCategory,
    },
    recentSales:    salesWithNames.slice(0, 10),
    recentExpenses: expenses.slice(0, 10),
    lowStockItems:  products.filter(p => p.stock_qty <= p.reorder_level),
  });
};
