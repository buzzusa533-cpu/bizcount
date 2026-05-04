/**
 * BizCount Netlify — Frontend App
 * Handles: Auth, API calls, Dashboard, Theme, Navigation
 */

'use strict';

/* ═══════════════ CONFIG ═══════════════ */
const API = {
  auth:         '/.netlify/functions/auth',
  sales:        '/.netlify/functions/sales',
  products:     '/.netlify/functions/products',
  expenses:     '/.netlify/functions/expenses',
  staff:        '/.netlify/functions/staff',
  tasks:        '/.netlify/functions/tasks',
  reports:      '/.netlify/functions/reports',
  mpesaPay:     '/.netlify/functions/mpesa-pay',
  subscription: '/.netlify/functions/subscription',
};

const CURRENCY = 'KES';

/* ═══════════════ TOKEN HELPERS ═══════════════ */
function getToken()        { return localStorage.getItem('bc_token'); }
function setToken(t)       { localStorage.setItem('bc_token', t); }
function removeToken()     { localStorage.removeItem('bc_token'); localStorage.removeItem('bc_user'); }
function getUser()         { try { return JSON.parse(localStorage.getItem('bc_user') || 'null'); } catch { return null; } }
function setUser(u)        { localStorage.setItem('bc_user', JSON.stringify(u)); }
function isLoggedIn()      { return !!getToken(); }
function isOwner()         { return getUser()?.role === 'owner'; }

/* ═══════════════ API HELPER ═══════════════ */
async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res  = await fetch(url, { ...options, headers });
    const data = await res.json();
    return data;
  } catch (e) {
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

async function apiGet(url, params = {})  {
  const qs  = new URLSearchParams(params).toString();
  return apiFetch(qs ? `${url}?${qs}` : url, { method: 'GET' });
}
async function apiPost(url, body = {})   { return apiFetch(url, { method: 'POST', body: JSON.stringify(body) }); }

/* ═══════════════ THEME ═══════════════ */
(function initTheme() {
  const saved = localStorage.getItem('bc_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('bc_theme', next);
}

/* ═══════════════ FORMAT HELPERS ═══════════════ */
function fmt(amount) { return CURRENCY + ' ' + Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d)  { if (!d) return '—'; return new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }); }
function today()     { return new Date().toISOString().slice(0, 10); }
function esc(s)      { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

/* ═══════════════ TOAST ═══════════════ */
function toast(msg, type = 'success') {
  const existing = document.querySelector('.bc-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = `bc-toast alert alert-${type}`;
  t.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'check-circle' : 'circle-exclamation'}"></i> ${msg}`;
  Object.assign(t.style, {
    position: 'fixed', top: '80px', right: '20px', zIndex: '9999',
    minWidth: '280px', maxWidth: '420px',
    boxShadow: 'var(--shadow-lg)', borderRadius: 'var(--radius-md)',
    padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px',
    transition: 'all .3s ease', opacity: '0', transform: 'translateX(20px)',
  });
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(0)'; });
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 4000);
}

/* ═══════════════ SPINNER ═══════════════ */
function showSpinner(id, show = true) {
  const el = document.getElementById(id);
  if (!el) return;
  if (show) { el.innerHTML = '<div class="spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>'; }
}

/* ═══════════════ LOADING BTN ═══════════════ */
function setBtnLoading(btn, loading = true, originalText = '') {
  if (!btn) return;
  if (loading) { btn.dataset.original = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Please wait...'; }
  else { btn.disabled = false; btn.innerHTML = btn.dataset.original || originalText; }
}

/* ═══════════════ DOM READY ═══════════════ */
document.addEventListener('DOMContentLoaded', function () {

  // Theme toggle
  document.querySelectorAll('#themeToggle, .theme-toggle').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });

  // Hamburger menu
  const hamburger = document.getElementById('hamburger');
  const mainNav   = document.getElementById('mainNav');
  if (hamburger && mainNav) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      mainNav.classList.toggle('open');
    });
  }

  // Header scroll
  const header = document.getElementById('mainHeader');
  if (header) {
    window.addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 10), { passive: true });
  }

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
    });
  });

  // Page-specific init
  const page = document.body.dataset.page || '';
  if (page === 'register')     initRegister();
  if (page === 'login')        initLogin();
  if (page === 'dashboard')    initDashboard();
  if (page === 'staff-portal') initStaffPortal();
});

/* ═══════════════════════════════════════════════════════
   REGISTER PAGE
═══════════════════════════════════════════════════════ */
function initRegister() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  // Password strength
  document.getElementById('password')?.addEventListener('input', function () {
    const bar = document.getElementById('pwBar');
    if (!bar) return;
    let strength = 0;
    if (this.value.length >= 8) strength++;
    if (/[A-Z]/.test(this.value)) strength++;
    if (/[0-9]/.test(this.value)) strength++;
    if (/[^A-Za-z0-9]/.test(this.value)) strength++;
    bar.className = 'pw-bar';
    const levels = ['', 'weak', 'fair', 'good', 'strong'];
    if (strength) bar.classList.add(levels[strength]);
    bar.style.width = (strength * 25) + '%';
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearFieldErrors();
    const btn = form.querySelector('[type=submit]');
    setBtnLoading(btn, true);

    const data = {
      action:        'register',
      first_name:    form.first_name.value.trim(),
      last_name:     form.last_name.value.trim(),
      business_name: form.business_name.value.trim(),
      email:         form.email.value.trim(),
      phone:         form.phone.value.trim(),
      password:      form.password.value,
      confirm_password: form.confirm_password.value,
    };

    // Client validation
    let hasErr = false;
    if (!data.first_name)    { showFieldErr('err_first_name', 'Required'); hasErr = true; }
    if (!data.last_name)     { showFieldErr('err_last_name',  'Required'); hasErr = true; }
    if (!data.business_name) { showFieldErr('err_business_name', 'Required'); hasErr = true; }
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { showFieldErr('err_email', 'Invalid email'); hasErr = true; }
    if (!data.phone || !/^(0[17]\d{8}|254[17]\d{8})$/.test(data.phone.replace(/\s/g, ''))) { showFieldErr('err_phone', 'Enter valid Kenyan number e.g. 0712345678'); hasErr = true; }
    if (data.password.length < 8) { showFieldErr('err_password', 'Min 8 characters'); hasErr = true; }
    if (data.password !== data.confirm_password) { showFieldErr('err_confirm_password', 'Passwords do not match'); hasErr = true; }
    if (!form.terms?.checked) { showFieldErr('err_terms', 'You must accept the terms'); hasErr = true; }

    if (hasErr) { setBtnLoading(btn, false); return; }

    const res = await apiPost(API.auth, data);
    setBtnLoading(btn, false);

    if (res.success) {
      setToken(res.token);
      setUser(res.user);
      toast('Account created! Redirecting to dashboard…', 'success');
      setTimeout(() => window.location.href = '/pages/dashboard.html', 1200);
    } else {
      showAlert('regError', res.error || 'Registration failed. Please try again.');
    }
  });
}

/* ═══════════════════════════════════════════════════════
   LOGIN PAGE
═══════════════════════════════════════════════════════ */
function initLogin() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  // Role tabs
  document.querySelectorAll('.role-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('roleInput').value = this.dataset.role;
      const note = document.getElementById('staffNote');
      if (note) note.style.display = this.dataset.role === 'staff' ? 'flex' : 'none';
    });
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearFieldErrors();
    const btn = form.querySelector('[type=submit]');
    setBtnLoading(btn, true);

    const data = {
      action:   'login',
      email:    form.email.value.trim(),
      password: form.password.value,
      role:     document.getElementById('roleInput')?.value || 'owner',
    };

    if (!data.email) { showFieldErr('err_email', 'Email required'); setBtnLoading(btn, false); return; }
    if (!data.password) { showFieldErr('err_password', 'Password required'); setBtnLoading(btn, false); return; }

    const res = await apiPost(API.auth, data);
    setBtnLoading(btn, false);

    if (res.success) {
      setToken(res.token);
      setUser(res.user);
      toast('Welcome back!', 'success');
      const dest = res.user.role === 'owner' ? '/pages/dashboard.html' : '/pages/staff.html';
      setTimeout(() => window.location.href = dest, 800);
    } else {
      showAlert('loginError', res.error || 'Login failed. Check your credentials.');
    }
  });
}

/* ═══════════════════════════════════════════════════════
   OWNER DASHBOARD
═══════════════════════════════════════════════════════ */
function initDashboard() {
  if (!isLoggedIn() || !isOwner()) { window.location.href = '/pages/login.html'; return; }

  // Populate user name
  const user = getUser();
  document.querySelectorAll('.user-name-el').forEach(el => el.textContent = (user?.first_name || '') + ' ' + (user?.last_name || ''));
  document.querySelectorAll('.business-name-el').forEach(el => el.textContent = user?.business_name || '');
  document.querySelectorAll('.user-avatar-el').forEach(el => el.textContent = ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')).toUpperCase());

  // Sidebar navigation
  const currentPage = new URLSearchParams(location.search).get('page') || 'overview';
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const p = new URLSearchParams(new URL(link.href, location.origin).search).get('page');
    if (p === currentPage) link.classList.add('active');
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    removeToken(); window.location.href = '/pages/login.html';
  });

  // Load subscription status
  loadSubscription();

  // Load page content
  if (currentPage === 'overview')      loadOverview();
  else if (currentPage === 'sales')    loadSales();
  else if (currentPage === 'expenses') loadExpenses();
  else if (currentPage === 'products') loadProducts();
  else if (currentPage === 'stock')    loadStock();
  else if (currentPage === 'staff')    loadStaff();
  else if (currentPage === 'tasks')    loadTasks();
  else if (currentPage === 'reports')  loadReports();
  else if (currentPage === 'subscription') loadSubscriptionPage();
  else if (currentPage === 'settings') loadSettings();
  else loadOverview();
}

/* ── Subscription Banner ─────────────────────────────── */
async function loadSubscription() {
  const res = await apiGet(API.subscription);
  if (!res.success) return;
  const sub     = res;
  const banner  = document.getElementById('subBanner');
  if (!banner) return;

  if (sub.status === 'trial') {
    banner.className = 'sub-banner trial mb-6';
    banner.innerHTML = `<i class="fa-solid fa-hourglass-half"></i>
      <div class="sub-banner-text">
        <strong>Free Trial — ${sub.days_left} day(s) remaining</strong>
        <span>Trial expires ${fmtDate(sub.expires)}. Subscribe to keep access.</span>
      </div>
      <a href="?page=subscription" class="btn btn-warning btn-sm">Subscribe Now</a>`;
    banner.style.display = 'flex';
  } else if (sub.status === 'expired') {
    banner.className = 'sub-banner expired mb-6';
    banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>
      <div class="sub-banner-text">
        <strong>Subscription Expired</strong>
        <span>Renew now to restore full access.</span>
      </div>
      <a href="?page=subscription" class="btn btn-danger btn-sm">Renew — ${CURRENCY} 200</a>`;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

/* ── OVERVIEW ─────────────────────────────────────────── */
async function loadOverview() {
  const content = document.getElementById('pageContent');
  if (!content) return;
  content.innerHTML = '<div class="spinner" style="padding:40px;text-align:center"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--brand-primary)"></i></div>';

  const [rep, sub] = await Promise.all([
    apiGet(API.reports, { range: 30 }),
    apiGet(API.subscription),
  ]);

  if (!rep.success) { content.innerHTML = `<div class="alert alert-error">${rep.error}</div>`; return; }

  const s = rep.stats;
  const user = getUser();

  content.innerHTML = `
    <div class="page-header-row mb-6">
      <div class="page-header">
        <h1 class="page-title">Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, ${esc(user?.first_name || '')} 👋</h1>
        <p class="page-subtitle">Here's what's happening at ${esc(user?.business_name || '')} today.</p>
      </div>
      <div class="page-actions">
        <a href="?page=sales" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Record Sale</a>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card" style="--card-color:#4f46e5">
        <div class="stat-card-icon"><i class="fa-solid fa-cash-register"></i></div>
        <div class="stat-label">Today's Sales</div>
        <div class="stat-value">${fmt(s.todaySales)}</div>
        <span class="stat-change neutral"><i class="fa-solid fa-calendar-day"></i> ${fmtDate(today())}</span>
      </div>
      <div class="stat-card" style="--card-color:#10b981">
        <div class="stat-card-icon"><i class="fa-solid fa-arrow-trend-up"></i></div>
        <div class="stat-label">Revenue (30 days)</div>
        <div class="stat-value">${fmt(s.totalRevenue)}</div>
        <span class="stat-change positive"><i class="fa-solid fa-chart-line"></i> Last 30 days</span>
      </div>
      <div class="stat-card" style="--card-color:#7c3aed">
        <div class="stat-card-icon"><i class="fa-solid fa-piggy-bank"></i></div>
        <div class="stat-label">Net Profit (30 days)</div>
        <div class="stat-value">${fmt(s.netProfit)}</div>
        <span class="stat-change ${s.netProfit >= 0 ? 'positive' : 'negative'}">
          <i class="fa-solid fa-${s.netProfit >= 0 ? 'arrow-up' : 'arrow-down'}"></i> After expenses
        </span>
      </div>
      <div class="stat-card" style="--card-color:${s.lowStockCount > 0 ? '#ef4444' : '#06b6d4'}">
        <div class="stat-card-icon"><i class="fa-solid fa-boxes-stacked"></i></div>
        <div class="stat-label">Low Stock Items</div>
        <div class="stat-value">${s.lowStockCount}</div>
        <span class="stat-change ${s.lowStockCount > 0 ? 'negative' : 'positive'}">
          <i class="fa-solid fa-${s.lowStockCount > 0 ? 'triangle-exclamation' : 'check'}"></i>
          ${s.productCount} total products
        </span>
      </div>
    </div>

    <div class="quick-actions mb-6">
      <a href="?page=sales" class="quick-action"><i class="fa-solid fa-cash-register"></i><span>Add Sale</span></a>
      <a href="?page=products" class="quick-action"><i class="fa-solid fa-box-open"></i><span>Add Product</span></a>
      <a href="?page=expenses" class="quick-action"><i class="fa-solid fa-receipt"></i><span>Log Expense</span></a>
      <a href="?page=reports" class="quick-action"><i class="fa-solid fa-chart-bar"></i><span>View Reports</span></a>
    </div>

    <div class="grid-21 mb-6">
      <div class="dash-card">
        <div class="dash-card-header">
          <span class="dash-card-title">Sales — Last 7 Days</span>
          <a href="?page=reports" class="dash-card-action">Full Report →</a>
        </div>
        <div class="chart-container" style="height:220px">
          <canvas id="salesChart"></canvas>
        </div>
      </div>
      <div class="dash-card">
        <div class="dash-card-header"><span class="dash-card-title">Quick Stats</span></div>
        <div style="display:flex;flex-direction:column;gap:0">
          ${quickStat('fa-users','Staff Members', s.staffCount, 'var(--brand-primary)')}
          ${quickStat('fa-box','Products', s.productCount, 'var(--brand-primary)')}
          ${quickStat('fa-money-bill','Expenses (30d)', fmt(s.totalExpenses), 'var(--brand-danger)')}
          ${quickStat('fa-triangle-exclamation','Low Stock', s.lowStockCount, s.lowStockCount > 0 ? 'var(--brand-warning)' : 'var(--brand-success)')}
        </div>
      </div>
    </div>

    <div class="dash-card">
      <div class="dash-card-header">
        <span class="dash-card-title">Recent Sales</span>
        <a href="?page=sales" class="dash-card-action">View All →</a>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Date</th></tr></thead>
          <tbody>
            ${rep.recentSales.length === 0
              ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:28px">No sales yet. <a href="?page=sales" class="link">Record your first sale</a></td></tr>'
              : rep.recentSales.slice(0, 8).map(s => `
              <tr>
                <td class="td-bold">${esc(s.product_name)}</td>
                <td>${s.qty}</td>
                <td>${fmt(s.unit_price)}</td>
                <td><strong>${fmt(s.total)}</strong></td>
                <td>${fmtDate(s.sale_date)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  // Draw chart
  if (typeof Chart !== 'undefined' && rep.charts?.daily) {
    drawLineChart('salesChart', rep.charts.daily.labels, rep.charts.daily.values, 'Sales (KES)');
  }
}

function quickStat(icon, label, value, color) {
  return `<div class="flex-between" style="padding:11px 0;border-bottom:1px solid var(--border-color)">
    <span style="font-size:.85rem;color:var(--text-secondary)"><i class="fa-solid ${icon}" style="color:${color};margin-right:8px;width:14px"></i>${label}</span>
    <strong>${value}</strong>
  </div>`;
}

/* ── SALES PAGE ───────────────────────────────────────── */
async function loadSales() {
  const content = document.getElementById('pageContent');
  if (!content) return;

  const [salesRes, prodRes] = await Promise.all([
    apiGet(API.sales, { range: 30 }),
    apiGet(API.products),
  ]);

  const products = prodRes.products || [];
  const sales    = salesRes.sales   || [];

  content.innerHTML = `
    <div class="page-header mb-6">
      <h1 class="page-title">Sales</h1>
      <p class="page-subtitle">Record and manage daily sales transactions.</p>
    </div>

    <div class="grid-12 mb-6">
      <div class="form-section">
        <h3><i class="fa-solid fa-plus-circle" style="color:var(--brand-primary)"></i> Record New Sale</h3>
        <form id="saleForm">
          <div class="form-grid mb-4">
            <div class="form-group-dash">
              <label>Product *</label>
              <select name="product_id" id="saleProduct" required>
                <option value="">— Select Product —</option>
                ${products.map(p => `<option value="${p.id}" data-price="${p.sell_price}">${esc(p.name)} (${fmt(p.sell_price)})</option>`).join('')}
              </select>
            </div>
            <div class="form-group-dash">
              <label>Sale Date *</label>
              <input type="date" name="sale_date" value="${today()}" required/>
            </div>
            <div class="form-group-dash">
              <label>Quantity *</label>
              <input type="number" name="qty" id="saleQty" min="0.01" step="0.01" placeholder="1" required/>
            </div>
            <div class="form-group-dash">
              <label>Unit Price (KES) *</label>
              <input type="number" name="unit_price" id="salePrice" min="0.01" step="0.01" placeholder="0.00" required/>
            </div>
            <div class="form-group-dash">
              <label>Total (auto)</label>
              <input type="number" id="saleTotal" readonly placeholder="0.00" style="background:var(--bg-surface-2)"/>
            </div>
            <div class="form-group-dash">
              <label>Notes</label>
              <input type="text" name="notes" placeholder="e.g. Cash, M-Pesa…"/>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" id="saleSubmitBtn"><i class="fa-solid fa-check"></i> Record Sale</button>
          </div>
        </form>
      </div>

      <div class="dash-card" style="align-self:flex-start">
        <div class="dash-card-header"><span class="dash-card-title">Sales Summary (30 days)</span></div>
        <div style="display:flex;flex-direction:column;gap:0">
          ${quickStat('fa-calendar-day', 'Today', fmt(salesRes.todayTotal), 'var(--brand-primary)')}
          ${quickStat('fa-calendar', '30-Day Revenue', fmt(salesRes.rangeTotal), 'var(--brand-success)')}
          ${quickStat('fa-list-ol', 'Transactions', sales.length, 'var(--brand-primary)')}
        </div>
      </div>
    </div>

    <div class="dash-card">
      <div class="dash-card-header"><span class="dash-card-title">All Sales (Last 30 Days)</span></div>
      <div class="table-wrap">
        <table class="data-table" id="salesTable">
          <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Date</th><th>Notes</th><th>Action</th></tr></thead>
          <tbody id="salesTableBody">
            ${sales.length === 0
              ? '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:28px">No sales yet.</td></tr>'
              : sales.map(s => `
              <tr>
                <td class="td-bold">${esc(s.product_name)}</td>
                <td>${s.qty}</td>
                <td>${fmt(s.unit_price)}</td>
                <td><strong>${fmt(s.total)}</strong></td>
                <td>${fmtDate(s.sale_date)}</td>
                <td>${esc(s.notes || '—')}</td>
                <td>
                  <button class="btn btn-danger btn-sm" style="padding:4px 10px" onclick="deleteSale('${s.id}')">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  // Auto-fill price from product
  document.getElementById('saleProduct')?.addEventListener('change', function () {
    const opt = this.options[this.selectedIndex];
    if (opt?.dataset.price) {
      document.getElementById('salePrice').value = opt.dataset.price;
      calcSaleTotal();
    }
  });
  document.getElementById('saleQty')?.addEventListener('input', calcSaleTotal);
  document.getElementById('salePrice')?.addEventListener('input', calcSaleTotal);

  document.getElementById('saleForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = document.getElementById('saleSubmitBtn');
    setBtnLoading(btn, true);
    const fd = new FormData(this);
    const res = await apiPost(API.sales, {
      action: 'add',
      product_id: fd.get('product_id'),
      qty: fd.get('qty'),
      unit_price: fd.get('unit_price'),
      notes: fd.get('notes'),
      sale_date: fd.get('sale_date'),
    });
    setBtnLoading(btn, false);
    if (res.success) { toast('Sale recorded!'); this.reset(); loadSales(); }
    else toast(res.error || 'Failed to record sale.', 'error');
  });
}

function calcSaleTotal() {
  const qty   = parseFloat(document.getElementById('saleQty')?.value)   || 0;
  const price = parseFloat(document.getElementById('salePrice')?.value) || 0;
  const total = document.getElementById('saleTotal');
  if (total) total.value = (qty * price).toFixed(2);
}

async function deleteSale(id) {
  if (!confirm('Delete this sale record?')) return;
  const res = await apiPost(API.sales, { action: 'delete', id });
  if (res.success) { toast('Sale deleted.'); loadSales(); }
  else toast(res.error || 'Failed.', 'error');
}

/* ── EXPENSES PAGE ───────────────────────────────────── */
async function loadExpenses() {
  const content = document.getElementById('pageContent');
  if (!content) return;
  const res = await apiGet(API.expenses, { range: 30 });
  const expenses = res.expenses || [];
  const cats = ['Rent','Utilities','Salaries','Stock Purchase','Transport','Marketing','Maintenance','Other'];

  content.innerHTML = `
    <div class="page-header mb-6"><h1 class="page-title">Expense Tracker</h1><p class="page-subtitle">Track all your business expenses.</p></div>
    <div class="grid-12 mb-6">
      <div class="form-section">
        <h3><i class="fa-solid fa-plus-circle" style="color:var(--brand-primary)"></i> Log New Expense</h3>
        <form id="expenseForm">
          <div class="form-grid mb-4">
            <div class="form-group-dash">
              <label>Category *</label>
              <select name="category" required>
                <option value="">— Select —</option>
                ${cats.map(c => `<option>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group-dash">
              <label>Amount (KES) *</label>
              <input type="number" name="amount" min="1" step="0.01" placeholder="0.00" required/>
            </div>
            <div class="form-group-dash">
              <label>Date *</label>
              <input type="date" name="expense_date" value="${today()}" required/>
            </div>
            <div class="form-group-dash">
              <label>Description</label>
              <input type="text" name="description" placeholder="Brief description…"/>
            </div>
          </div>
          <div class="form-actions"><button type="submit" class="btn btn-primary" id="expBtn"><i class="fa-solid fa-check"></i> Log Expense</button></div>
        </form>
      </div>
      <div class="dash-card" style="align-self:flex-start">
        <div class="dash-card-header"><span class="dash-card-title">30-Day Summary</span></div>
        <div class="stat-value" style="font-size:2rem;margin:8px 0">${fmt(res.total)}</div>
        <p style="font-size:.82rem;color:var(--text-muted)">Total expenses this period</p>
      </div>
    </div>
    <div class="dash-card">
      <div class="dash-card-header"><span class="dash-card-title">Expense History</span></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Category</th><th>Amount</th><th>Date</th><th>Description</th><th>Action</th></tr></thead>
          <tbody>
            ${expenses.length === 0
              ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:28px">No expenses logged yet.</td></tr>'
              : expenses.map(e => `
              <tr>
                <td><span class="status-badge status-warning">${esc(e.category)}</span></td>
                <td class="td-bold">${fmt(e.amount)}</td>
                <td>${fmtDate(e.expense_date)}</td>
                <td>${esc(e.description || '—')}</td>
                <td>
                  <button class="btn btn-danger btn-sm" style="padding:4px 10px" onclick="deleteExpense('${e.id}')">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById('expenseForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = document.getElementById('expBtn');
    setBtnLoading(btn, true);
    const fd = new FormData(this);
    const res = await apiPost(API.expenses, {
      action: 'add', category: fd.get('category'), amount: fd.get('amount'),
      description: fd.get('description'), expense_date: fd.get('expense_date'),
    });
    setBtnLoading(btn, false);
    if (res.success) { toast('Expense logged.'); this.reset(); loadExpenses(); }
    else toast(res.error || 'Failed.', 'error');
  });
}

async function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  const res = await apiPost(API.expenses, { action: 'delete', id });
  if (res.success) { toast('Deleted.'); loadExpenses(); }
  else toast(res.error || 'Failed.', 'error');
}

/* ── PRODUCTS PAGE ───────────────────────────────────── */
async function loadProducts() {
  const content = document.getElementById('pageContent');
  if (!content) return;
  const res      = await apiGet(API.products);
  const products = res.products || [];

  content.innerHTML = `
    <div class="page-header mb-6"><h1 class="page-title">Products</h1><p class="page-subtitle">Manage your product catalog.</p></div>
    <div class="form-section mb-6">
      <h3><i class="fa-solid fa-plus-circle" style="color:var(--brand-primary)"></i> Add New Product</h3>
      <form id="productForm">
        <div class="form-grid-3 mb-4">
          <div class="form-group-dash"><label>Name *</label><input type="text" name="name" placeholder="e.g. Maize Flour 2kg" required/></div>
          <div class="form-group-dash"><label>SKU / Code</label><input type="text" name="sku" placeholder="MF-001"/></div>
          <div class="form-group-dash"><label>Category</label><input type="text" name="category" placeholder="Groceries"/></div>
          <div class="form-group-dash"><label>Buying Price (KES)</label><input type="number" name="buy_price" min="0" step="0.01" placeholder="0.00"/></div>
          <div class="form-group-dash"><label>Selling Price (KES) *</label><input type="number" name="sell_price" min="0.01" step="0.01" placeholder="0.00" required/></div>
          <div class="form-group-dash"><label>Stock Qty</label><input type="number" name="stock_qty" min="0" step="0.01" placeholder="0"/></div>
          <div class="form-group-dash"><label>Reorder Level</label><input type="number" name="reorder_level" min="0" step="0.01" placeholder="5"/></div>
          <div class="form-group-dash"><label>Unit</label><input type="text" name="unit" placeholder="pcs / kg / litre"/></div>
        </div>
        <div class="form-actions"><button type="submit" class="btn btn-primary" id="prodBtn"><i class="fa-solid fa-plus"></i> Add Product</button></div>
      </form>
    </div>
    <div class="dash-card">
      <div class="dash-card-header"><span class="dash-card-title">All Products (${products.length})</span></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Name</th><th>SKU</th><th>Category</th><th>Buy Price</th><th>Sell Price</th><th>Stock</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${products.length === 0
              ? '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:28px">No products added yet.</td></tr>'
              : products.map(p => {
                  const low = p.stock_qty <= p.reorder_level;
                  return `<tr>
                    <td class="td-bold">${esc(p.name)}</td>
                    <td>${esc(p.sku || '—')}</td>
                    <td>${esc(p.category || '—')}</td>
                    <td>${fmt(p.buy_price)}</td>
                    <td>${fmt(p.sell_price)}</td>
                    <td style="font-weight:700;color:var(--${low ? 'brand-danger' : 'text-primary'})">${p.stock_qty}</td>
                    <td><span class="status-badge ${low ? 'status-danger' : 'status-success'}">${low ? '⚠ Low' : '✓ OK'}</span></td>
                    <td><button class="btn btn-danger btn-sm" style="padding:4px 10px" onclick="deleteProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button></td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById('productForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = document.getElementById('prodBtn');
    setBtnLoading(btn, true);
    const fd  = new FormData(this);
    const res = await apiPost(API.products, {
      action: 'add', name: fd.get('name'), sku: fd.get('sku'),
      category: fd.get('category'), buy_price: fd.get('buy_price'),
      sell_price: fd.get('sell_price'), stock_qty: fd.get('stock_qty'),
      reorder_level: fd.get('reorder_level'), unit: fd.get('unit'),
    });
    setBtnLoading(btn, false);
    if (res.success) { toast('Product added!'); this.reset(); loadProducts(); }
    else toast(res.error || 'Failed.', 'error');
  });
}

async function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  const res = await apiPost(API.products, { action: 'delete', id });
  if (res.success) { toast('Product deleted.'); loadProducts(); }
  else toast(res.error || 'Failed.', 'error');
}

/* ── STOCK PAGE ──────────────────────────────────────── */
async function loadStock() {
  const content  = document.getElementById('pageContent');
  if (!content) return;
  const res      = await apiGet(API.products);
  const products = res.products || [];
  const lowItems = products.filter(p => p.stock_qty <= p.reorder_level);

  content.innerHTML = `
    <div class="page-header mb-6"><h1 class="page-title">Stock Management</h1><p class="page-subtitle">Monitor inventory levels and update stock.</p></div>
    ${lowItems.length > 0 ? `<div class="alert alert-warning mb-6"><i class="fa-solid fa-triangle-exclamation"></i> ${lowItems.length} item(s) need restocking.</div>` : ''}
    <div class="dash-card">
      <div class="dash-card-header"><span class="dash-card-title">All Inventory (${products.length})</span></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Product</th><th>Category</th><th>In Stock</th><th>Reorder At</th><th>Status</th><th>Update Stock</th></tr></thead>
          <tbody>
            ${products.map(p => {
              const low = p.stock_qty <= p.reorder_level;
              return `<tr>
                <td class="td-bold">${esc(p.name)}</td>
                <td>${esc(p.category || '—')}</td>
                <td style="font-weight:700;color:var(--${low ? 'brand-danger' : 'text-primary'})">${p.stock_qty}</td>
                <td>${p.reorder_level}</td>
                <td><span class="status-badge ${low ? 'status-danger' : 'status-success'}">${low ? '⚠ Low' : '✓ OK'}</span></td>
                <td>
                  <div style="display:flex;gap:6px;align-items:center">
                    <input type="number" id="stock_${p.id}" value="${p.stock_qty}" min="0" step="0.01"
                      style="width:80px;padding:6px 8px;border:1.5px solid var(--input-border);border-radius:6px;font-size:.82rem;background:var(--input-bg);color:var(--text-primary)"/>
                    <button class="btn btn-success btn-sm" style="padding:6px 10px" onclick="updateStock('${p.id}')">
                      <i class="fa-solid fa-check"></i>
                    </button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function updateStock(id) {
  const val = document.getElementById(`stock_${id}`)?.value;
  const res = await apiPost(API.products, { action: 'update-stock', id, stock_qty: val });
  if (res.success) toast('Stock updated.');
  else toast(res.error || 'Failed.', 'error');
}

/* ── STAFF PAGE ──────────────────────────────────────── */
async function loadStaff() {
  const content = document.getElementById('pageContent');
  if (!content) return;
  const res  = await apiGet(API.staff);
  const list = res.staff || [];

  content.innerHTML = `
    <div class="page-header mb-6"><h1 class="page-title">Staff Management</h1><p class="page-subtitle">Create and manage staff accounts.</p></div>
    <div class="form-section mb-6">
      <h3><i class="fa-solid fa-user-plus" style="color:var(--brand-primary)"></i> Create Staff Account</h3>
      <form id="staffForm">
        <div class="form-grid mb-4">
          <div class="form-group-dash"><label>First Name *</label><input type="text" name="first_name" required/></div>
          <div class="form-group-dash"><label>Last Name *</label><input type="text" name="last_name" required/></div>
          <div class="form-group-dash"><label>Email *</label><input type="email" name="email" required/></div>
          <div class="form-group-dash"><label>Phone</label><input type="tel" name="phone" placeholder="0712345678"/></div>
          <div class="form-group-dash"><label>Temporary Password</label><input type="text" name="password" placeholder="Auto-generated if blank"/></div>
        </div>
        <div class="form-actions"><button type="submit" class="btn btn-primary" id="staffBtn"><i class="fa-solid fa-user-plus"></i> Create Account</button></div>
      </form>
    </div>
    <div class="dash-card">
      <div class="dash-card-header"><span class="dash-card-title">Staff Members (${list.length})</span></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
          <tbody>
            ${list.length === 0
              ? '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:28px">No staff created yet.</td></tr>'
              : list.map(s => `
              <tr>
                <td class="td-bold">${esc(s.first_name + ' ' + s.last_name)}</td>
                <td>${esc(s.email)}</td>
                <td>${esc(s.phone || '—')}</td>
                <td><span class="status-badge ${s.is_active ? 'status-success' : 'status-danger'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>${s.last_login ? fmtDate(s.last_login) : 'Never'}</td>
                <td style="display:flex;gap:6px">
                  <button class="btn btn-warning btn-sm" style="padding:4px 10px" onclick="toggleStaff('${s.id}')"><i class="fa-solid fa-power-off"></i></button>
                  <button class="btn btn-danger btn-sm" style="padding:4px 10px" onclick="deleteStaff('${s.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById('staffForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = document.getElementById('staffBtn');
    setBtnLoading(btn, true);
    const fd  = new FormData(this);
    const res = await apiPost(API.staff, {
      action: 'create', first_name: fd.get('first_name'), last_name: fd.get('last_name'),
      email: fd.get('email'), phone: fd.get('phone'), password: fd.get('password'),
    });
    setBtnLoading(btn, false);
    if (res.success) { toast(res.message || 'Staff created!'); this.reset(); loadStaff(); }
    else toast(res.error || 'Failed.', 'error');
  });
}

async function toggleStaff(id) {
  const res = await apiPost(API.staff, { action: 'toggle', id });
  if (res.success) { toast('Status updated.'); loadStaff(); }
  else toast(res.error || 'Failed.', 'error');
}
async function deleteStaff(id) {
  if (!confirm('Delete this staff account?')) return;
  const res = await apiPost(API.staff, { action: 'delete', id });
  if (res.success) { toast('Staff deleted.'); loadStaff(); }
  else toast(res.error || 'Failed.', 'error');
}

/* ── TASKS PAGE ──────────────────────────────────────── */
async function loadTasks() {
  const content = document.getElementById('pageContent');
  if (!content) return;
  const [taskRes, staffRes] = await Promise.all([apiGet(API.tasks), apiGet(API.staff)]);
  const tasks = taskRes.tasks || [];
  const staff = staffRes.staff || [];
  const pending = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  const done    = tasks.filter(t => t.status === 'done');

  content.innerHTML = `
    <div class="page-header mb-6"><h1 class="page-title">Task Manager</h1><p class="page-subtitle">Assign tasks to your staff.</p></div>
    <div class="form-section mb-6">
      <h3><i class="fa-solid fa-plus-circle" style="color:var(--brand-primary)"></i> Assign New Task</h3>
      ${staff.length === 0
        ? '<div class="alert alert-info"><i class="fa-solid fa-circle-info"></i> <a href="?page=staff" class="link">Create staff accounts</a> first.</div>'
        : `<form id="taskForm">
          <div class="form-grid mb-4">
            <div class="form-group-dash"><label>Assign To *</label>
              <select name="staff_id" required><option value="">— Select Staff —</option>
                ${staff.map(s => `<option value="${s.id}">${esc(s.first_name + ' ' + s.last_name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group-dash"><label>Priority</label>
              <select name="priority"><option value="low">Low</option><option value="normal" selected>Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>
            </div>
            <div class="form-group-dash" style="grid-column:1/-1"><label>Title *</label><input type="text" name="title" required/></div>
            <div class="form-group-dash"><label>Description</label><textarea name="description" style="min-height:70px"></textarea></div>
            <div class="form-group-dash"><label>Due Date</label><input type="date" name="due_date"/></div>
          </div>
          <div class="form-actions"><button type="submit" class="btn btn-primary" id="taskBtn"><i class="fa-solid fa-check"></i> Assign Task</button></div>
        </form>`}
    </div>
    <div class="dash-card mb-6">
      <div class="dash-card-header"><span class="dash-card-title">Pending Tasks (${pending.length})</span></div>
      ${pending.length === 0 ? '<p style="color:var(--text-muted);padding:20px;text-align:center">No pending tasks.</p>'
        : pending.map(t => taskCard(t, true)).join('')}
    </div>
    ${done.length > 0 ? `<div class="dash-card">
      <div class="dash-card-header"><span class="dash-card-title">Completed (${done.length})</span></div>
      ${done.map(t => taskCard(t, false)).join('')}
    </div>` : ''}`;

  document.getElementById('taskForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = document.getElementById('taskBtn');
    setBtnLoading(btn, true);
    const fd  = new FormData(this);
    const res = await apiPost(API.tasks, {
      action: 'add', staff_id: fd.get('staff_id'), title: fd.get('title'),
      description: fd.get('description'), priority: fd.get('priority'), due_date: fd.get('due_date'),
    });
    setBtnLoading(btn, false);
    if (res.success) { toast('Task assigned!'); this.reset(); loadTasks(); }
    else toast(res.error || 'Failed.', 'error');
  });
}

function taskCard(t, showActions) {
  const colors = { urgent: 'status-danger', high: 'status-warning', normal: 'status-info', low: 'status-neutral' };
  return `<div class="task-card ${t.status === 'done' ? 'done' : t.priority === 'urgent' ? 'urgent' : ''}">
    <div class="flex-between">
      <div class="task-title ${t.status === 'done' ? 'text-muted' : ''}" style="${t.status === 'done' ? 'text-decoration:line-through' : ''}">${esc(t.title)}</div>
      <span class="status-badge ${colors[t.priority] || 'status-info'}">${t.priority}</span>
    </div>
    <div class="task-meta">
      ${t.staff_name ? `<i class="fa-solid fa-user"></i> ${esc(t.staff_name)} · ` : ''}
      ${t.due_date ? `Due: ${fmtDate(t.due_date)} · ` : ''}
      ${t.status}
    </div>
    ${showActions ? `<div style="margin-top:8px;display:flex;gap:8px">
      <button class="btn btn-success btn-sm" onclick="updateTaskStatus('${t.id}','done')"><i class="fa-solid fa-check"></i> Mark Done</button>
      <button class="btn btn-danger btn-sm" onclick="deleteTask('${t.id}')"><i class="fa-solid fa-trash"></i></button>
    </div>` : ''}
  </div>`;
}

async function updateTaskStatus(id, status) {
  const res = await apiPost(API.tasks, { action: 'update-status', id, status });
  if (res.success) { toast('Task updated.'); loadTasks(); }
  else toast(res.error || 'Failed.', 'error');
}
async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  const res = await apiPost(API.tasks, { action: 'delete', id });
  if (res.success) { toast('Task deleted.'); loadTasks(); }
  else toast(res.error || 'Failed.', 'error');
}

/* ── REPORTS PAGE ────────────────────────────────────── */
async function loadReports(range = 30) {
  const content = document.getElementById('pageContent');
  if (!content) return;
  content.innerHTML = '<div style="padding:40px;text-align:center"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--brand-primary)"></i></div>';
  const res = await apiGet(API.reports, { range });
  if (!res.success) { content.innerHTML = `<div class="alert alert-error">${res.error}</div>`; return; }
  const s = res.stats;

  content.innerHTML = `
    <div class="page-header-row mb-6">
      <div class="page-header"><h1 class="page-title">Reports & Analytics</h1></div>
      <div class="page-actions">
        ${[7,30,90,365].map(r => `<button class="btn btn-sm ${r==range?'btn-primary':'btn-ghost'}" onclick="loadReports(${r})">${r === 365 ? '1 Year' : r + ' Days'}</button>`).join('')}
      </div>
    </div>
    <div class="stats-grid mb-6">
      <div class="stat-card" style="--card-color:#4f46e5"><div class="stat-card-icon"><i class="fa-solid fa-cash-register"></i></div><div class="stat-label">Transactions</div><div class="stat-value">${s.salesCount}</div><span class="stat-change neutral">Last ${range} days</span></div>
      <div class="stat-card" style="--card-color:#10b981"><div class="stat-card-icon"><i class="fa-solid fa-money-bill-wave"></i></div><div class="stat-label">Total Revenue</div><div class="stat-value">${fmt(s.totalRevenue)}</div><span class="stat-change positive">Last ${range} days</span></div>
      <div class="stat-card" style="--card-color:#ef4444"><div class="stat-card-icon"><i class="fa-solid fa-receipt"></i></div><div class="stat-label">Total Expenses</div><div class="stat-value">${fmt(s.totalExpenses)}</div><span class="stat-change negative">Last ${range} days</span></div>
      <div class="stat-card" style="--card-color:#7c3aed"><div class="stat-card-icon"><i class="fa-solid fa-piggy-bank"></i></div><div class="stat-label">Net Profit</div><div class="stat-value">${fmt(s.netProfit)}</div><span class="stat-change ${s.netProfit>=0?'positive':'negative'}">Last ${range} days</span></div>
    </div>
    <div class="dash-card mb-6">
      <div class="dash-card-header"><span class="dash-card-title">Revenue vs Expenses — Last 6 Months</span></div>
      <div class="chart-container" style="height:280px"><canvas id="profitChart"></canvas></div>
    </div>
    <div class="dash-card mb-6">
      <div class="dash-card-header"><span class="dash-card-title">Daily Sales — Last 7 Days</span></div>
      <div class="chart-container" style="height:220px"><canvas id="dailyChart"></canvas></div>
    </div>
    <div class="dash-card">
      <div class="dash-card-header"><span class="dash-card-title">Recent Sales Detail</span></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
          <tbody>
            ${res.recentSales.length === 0
              ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:28px">No sales data.</td></tr>'
              : res.recentSales.map(s => `<tr>
                <td>${fmtDate(s.sale_date)}</td>
                <td class="td-bold">${esc(s.product_name)}</td>
                <td>${s.qty}</td>
                <td>${fmt(s.unit_price)}</td>
                <td><strong>${fmt(s.total)}</strong></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  if (typeof Chart !== 'undefined') {
    const c = res.charts;
    drawBarChart('profitChart', c.monthly.labels, c.monthly.revenue, c.monthly.expenses);
    drawLineChart('dailyChart', c.daily.labels, c.daily.values, 'Sales (KES)');
  }
}

/* ── SUBSCRIPTION PAGE ───────────────────────────────── */
async function loadSubscriptionPage() {
  const content = document.getElementById('pageContent');
  if (!content) return;
  const res = await apiGet(API.subscription);
  const user = getUser();

  const statusColors = { trial: 'status-warning', active: 'status-success', expired: 'status-danger' };
  content.innerHTML = `
    <div class="page-header mb-6"><h1 class="page-title">Subscription & Billing</h1><p class="page-subtitle">Manage your BizCount subscription via M-Pesa.</p></div>
    <div class="grid-2">
      <div>
        <div class="dash-card mb-6">
          <div class="dash-card-header"><span class="dash-card-title">Current Plan</span></div>
          <div style="display:flex;flex-direction:column;gap:0">
            ${quickStat('fa-circle-check','Status','<span class="status-badge '+( statusColors[res.status]||'status-neutral')+'">'+( res.label||'—')+'</span>','var(--brand-primary)')}
            ${quickStat('fa-calendar-check','Expires', fmtDate(res.expires), 'var(--brand-primary)')}
            ${quickStat('fa-tag','Plan','Weekly — KES 200','var(--brand-primary)')}
          </div>
        </div>
        <div class="dash-card">
          <div class="dash-card-header"><span class="dash-card-title">Payment History</span></div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Date</th><th>Amount</th><th>M-Pesa Ref</th><th>Status</th></tr></thead>
              <tbody>
                ${(res.payments||[]).length === 0
                  ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">No payments yet.</td></tr>'
                  : (res.payments||[]).map(p => `
                  <tr>
                    <td>${fmtDate(p.created_at)}</td>
                    <td class="td-bold">${fmt(p.amount)}</td>
                    <td>${p.mpesa_receipt || '—'}</td>
                    <td><span class="status-badge ${p.status==='completed'?'status-success':'status-warning'}">${p.status}</span></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div>
        <div class="pay-box">
          <h3>Subscribe Now</h3>
          <p>Renew your access with M-Pesa. Just <strong>KES 200 per week</strong> — all features unlocked.</p>
          <div class="pay-amount">KES 200</div>
          <div class="form-group-dash mb-6">
            <label style="text-align:left;display:block;margin-bottom:6px;font-size:.82rem;color:var(--text-secondary);font-weight:600">M-Pesa Number</label>
            <input type="tel" id="mpesaPhone" value="${esc(user?.mpesa_phone || user?.phone || '')}" placeholder="0712345678"
              style="width:100%;padding:12px 14px;border:1.5px solid var(--input-border);border-radius:10px;background:var(--input-bg);color:var(--text-primary);font-size:.95rem;outline:none;font-family:inherit"/>
          </div>
          <button class="btn btn-primary btn-full btn-lg" id="mpesaPayBtn" onclick="initiateMpesa()">
            <i class="fa-solid fa-mobile-screen-button"></i> Pay KES 200 via M-Pesa
          </button>
          <div id="mpesaStatus" style="margin-top:16px;font-size:.82rem;color:var(--text-muted);text-align:center"></div>
          <p style="margin-top:16px;font-size:.75rem;color:var(--text-muted)"><i class="fa-solid fa-shield-halved"></i> Payments secured via Safaricom M-Pesa Daraja API.</p>
        </div>
      </div>
    </div>`;
}

async function initiateMpesa() {
  const phone = document.getElementById('mpesaPhone')?.value;
  const btn   = document.getElementById('mpesaPayBtn');
  const status= document.getElementById('mpesaStatus');
  if (!phone) { toast('Enter your M-Pesa number.', 'error'); return; }
  setBtnLoading(btn, true);
  const res = await apiPost(API.mpesaPay, { phone, amount: 200 });
  setBtnLoading(btn, false);
  if (res.success) {
    if (status) status.innerHTML = `<i class="fa-solid fa-mobile-screen-button" style="color:var(--brand-success)"></i> ${res.message}`;
    toast(res.message || 'M-Pesa prompt sent!', 'success');
  } else {
    toast(res.error || 'M-Pesa failed. Try again.', 'error');
  }
}

/* ── SETTINGS PAGE ───────────────────────────────────── */
async function loadSettings() {
  const content = document.getElementById('pageContent');
  const user    = getUser();
  if (!content) return;
  content.innerHTML = `
    <div class="page-header mb-6"><h1 class="page-title">Settings</h1><p class="page-subtitle">Update your business and account information.</p></div>
    <div id="settingsAlert"></div>
    <div class="form-section mb-6">
      <h3>Business & Profile</h3>
      <form id="profileForm">
        <div class="form-grid mb-4">
          <div class="form-group-dash"><label>First Name</label><input type="text" name="first_name" value="${esc(user?.first_name||'')}" required/></div>
          <div class="form-group-dash"><label>Last Name</label><input type="text" name="last_name" value="${esc(user?.last_name||'')}" required/></div>
          <div class="form-group-dash"><label>Business Name</label><input type="text" name="business_name" value="${esc(user?.business_name||'')}" required/></div>
          <div class="form-group-dash"><label>Phone (M-Pesa)</label><input type="tel" name="phone" value="${esc(user?.phone||'')}"/></div>
        </div>
        <div class="form-actions"><button type="submit" class="btn btn-primary" id="profileBtn"><i class="fa-solid fa-save"></i> Save Changes</button></div>
      </form>
    </div>
    <div class="form-section">
      <h3>Change Password</h3>
      <form id="pwForm">
        <div class="form-grid mb-4">
          <div class="form-group-dash"><label>Current Password</label><input type="password" name="old_password" required/></div>
          <div class="form-group-dash"></div>
          <div class="form-group-dash"><label>New Password (min 8)</label><input type="password" name="new_password" required/></div>
          <div class="form-group-dash"><label>Confirm New Password</label><input type="password" name="confirm_password" required/></div>
        </div>
        <div class="form-actions"><button type="submit" class="btn btn-primary" id="pwBtn"><i class="fa-solid fa-key"></i> Change Password</button></div>
      </form>
    </div>`;

  document.getElementById('profileForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = document.getElementById('profileBtn');
    setBtnLoading(btn, true);
    const fd  = new FormData(this);
    const res = await apiPost(API.auth, { action: 'update-profile', first_name: fd.get('first_name'), last_name: fd.get('last_name'), business_name: fd.get('business_name'), phone: fd.get('phone') });
    setBtnLoading(btn, false);
    if (res.success) {
      const u = getUser();
      u.first_name = fd.get('first_name'); u.last_name = fd.get('last_name'); u.business_name = fd.get('business_name');
      setUser(u);
      toast('Profile updated!');
    } else toast(res.error || 'Failed.', 'error');
  });

  document.getElementById('pwForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const fd = new FormData(this);
    if (fd.get('new_password') !== fd.get('confirm_password')) { toast('Passwords do not match.', 'error'); return; }
    const btn = document.getElementById('pwBtn');
    setBtnLoading(btn, true);
    const res = await apiPost(API.auth, { action: 'change-password', old_password: fd.get('old_password'), new_password: fd.get('new_password') });
    setBtnLoading(btn, false);
    if (res.success) { toast('Password changed!'); this.reset(); }
    else toast(res.error || 'Failed.', 'error');
  });
}

/* ═══════════════════════════════════════════════════════
   STAFF PORTAL
═══════════════════════════════════════════════════════ */
async function initStaffPortal() {
  if (!isLoggedIn() || isOwner()) { window.location.href = '/pages/login.html'; return; }
  const user = getUser();
  document.querySelectorAll('.user-name-el').forEach(el => el.textContent = (user?.first_name || '') + ' ' + (user?.last_name || ''));
  document.querySelectorAll('.business-name-el').forEach(el => el.textContent = user?.business_name || '');
  document.querySelectorAll('.user-avatar-el').forEach(el => el.textContent = ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')).toUpperCase());

  document.getElementById('logoutBtn')?.addEventListener('click', () => { removeToken(); window.location.href = '/pages/login.html'; });

  const page = new URLSearchParams(location.search).get('page') || 'overview';
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const p = new URLSearchParams(new URL(link.href, location.origin).search).get('page');
    if (p === page) link.classList.add('active');
  });

  if (page === 'overview')  loadStaffOverview();
  else if (page === 'sales')  loadStaffSales();
  else if (page === 'stock')  loadStaffStock();
  else if (page === 'tasks')  loadStaffTasks();
  else if (page === 'history') loadStaffHistory();
  else loadStaffOverview();
}

async function loadStaffOverview() {
  const content = document.getElementById('pageContent');
  if (!content) return;
  const [taskRes, salesRes] = await Promise.all([apiGet(API.tasks), apiGet(API.sales, { range: 1 })]);
  const user    = getUser();
  const tasks   = (taskRes.tasks || []).filter(t => t.status !== 'done');

  content.innerHTML = `
    <div class="page-header mb-6">
      <h1 class="page-title">Welcome, ${esc(user?.first_name || '')} 👋</h1>
      <p class="page-subtitle">Staff portal for ${esc(user?.business_name || '')}</p>
    </div>
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-card" style="--card-color:#4f46e5"><div class="stat-card-icon"><i class="fa-solid fa-cash-register"></i></div><div class="stat-label">My Sales Today</div><div class="stat-value">${fmt(salesRes.todayTotal || 0)}</div><span class="stat-change neutral">${fmtDate(today())}</span></div>
      <div class="stat-card" style="--card-color:#f59e0b"><div class="stat-card-icon"><i class="fa-solid fa-list-check"></i></div><div class="stat-label">Pending Tasks</div><div class="stat-value">${tasks.length}</div><span class="stat-change ${tasks.length > 0 ? 'negative' : 'positive'}">Assigned to me</span></div>
      <div class="stat-card" style="--card-color:#10b981"><div class="stat-card-icon"><i class="fa-solid fa-calendar-check"></i></div><div class="stat-label">Today's Date</div><div class="stat-value" style="font-size:1.2rem">${fmtDate(today())}</div><span class="stat-change neutral">Have a great day!</span></div>
    </div>
    <div class="quick-actions mb-6" style="grid-template-columns:repeat(3,1fr)">
      <a href="?page=sales" class="quick-action"><i class="fa-solid fa-cash-register"></i><span>Record Sale</span></a>
      <a href="?page=stock" class="quick-action"><i class="fa-solid fa-boxes-stacked"></i><span>Check Stock</span></a>
      <a href="?page=tasks" class="quick-action"><i class="fa-solid fa-list-check"></i><span>My Tasks</span></a>
    </div>
    ${tasks.length > 0 ? `<div class="dash-card">
      <div class="dash-card-header"><span class="dash-card-title">My Pending Tasks</span><a href="?page=tasks" class="dash-card-action">View All →</a></div>
      ${tasks.slice(0, 3).map(t => `<div class="task-card ${t.priority==='urgent'?'urgent':''}">
        <div class="task-title">${esc(t.title)}</div>
        <div class="task-meta">${t.due_date?'Due: '+fmtDate(t.due_date):''} · ${t.priority}</div>
      </div>`).join('')}
    </div>` : ''}`;
}

async function loadStaffSales() {
  const content = document.getElementById('pageContent');
  if (!content) return;
  const prodRes = await apiGet(API.products);
  const products = (prodRes.products || []).filter(p => p.stock_qty > 0);

  content.innerHTML = `
    <div class="page-header mb-6"><h1 class="page-title">Record a Sale</h1></div>
    <div class="form-section" style="max-width:600px">
      <h3><i class="fa-solid fa-cash-register" style="color:var(--brand-primary)"></i> New Sale Entry</h3>
      <form id="staffSaleForm">
        <div class="form-group-dash mb-4">
          <label>Product *</label>
          <select name="product_id" id="saleProduct" required>
            <option value="">— Select a product —</option>
            ${products.map(p => `<option value="${p.id}" data-price="${p.sell_price}">${esc(p.name)} — ${fmt(p.sell_price)} (${p.stock_qty} in stock)</option>`).join('')}
          </select>
        </div>
        <div class="form-grid mb-4">
          <div class="form-group-dash"><label>Quantity *</label><input type="number" name="qty" id="saleQty" min="0.01" step="0.01" placeholder="1" required/></div>
          <div class="form-group-dash"><label>Unit Price *</label><input type="number" name="unit_price" id="salePrice" min="0.01" step="0.01" placeholder="0.00" required/></div>
          <div class="form-group-dash"><label>Total (auto)</label><input type="number" id="saleTotal" readonly placeholder="0.00" style="background:var(--bg-surface-2)"/></div>
          <div class="form-group-dash"><label>Date *</label><input type="date" name="sale_date" value="${today()}" required/></div>
        </div>
        <div class="form-group-dash mb-4"><label>Notes</label><input type="text" name="notes" placeholder="e.g. Cash payment…"/></div>
        <div class="form-actions"><button type="submit" class="btn btn-primary btn-lg" id="staffSaleBtn"><i class="fa-solid fa-check"></i> Submit Sale</button></div>
      </form>
    </div>`;

  document.getElementById('saleProduct')?.addEventListener('change', function () {
    const opt = this.options[this.selectedIndex];
    if (opt?.dataset.price) { document.getElementById('salePrice').value = opt.dataset.price; calcSaleTotal(); }
  });
  document.getElementById('saleQty')?.addEventListener('input', calcSaleTotal);
  document.getElementById('salePrice')?.addEventListener('input', calcSaleTotal);

  document.getElementById('staffSaleForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = document.getElementById('staffSaleBtn');
    setBtnLoading(btn, true);
    const fd  = new FormData(this);
    const res = await apiPost(API.sales, { action: 'add', product_id: fd.get('product_id'), qty: fd.get('qty'), unit_price: fd.get('unit_price'), notes: fd.get('notes'), sale_date: fd.get('sale_date') });
    setBtnLoading(btn, false);
    if (res.success) { toast('Sale recorded!'); this.reset(); }
    else toast(res.error || 'Failed.', 'error');
  });
}

async function loadStaffStock() {
  const content  = document.getElementById('pageContent');
  if (!content) return;
  const res      = await apiGet(API.products);
  const products = res.products || [];
  const low      = products.filter(p => p.stock_qty <= p.reorder_level);
  content.innerHTML = `
    <div class="page-header mb-6"><h1 class="page-title">Stock Levels</h1><p class="page-subtitle">Current inventory (read-only).</p></div>
    ${low.length > 0 ? `<div class="alert alert-warning mb-6"><i class="fa-solid fa-triangle-exclamation"></i> ${low.length} item(s) running low. Please inform the owner.</div>` : ''}
    <div class="dash-card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Product</th><th>Category</th><th>In Stock</th><th>Sell Price</th><th>Status</th></tr></thead>
          <tbody>
            ${products.map(p => {
              const isLow = p.stock_qty <= p.reorder_level;
              return `<tr>
                <td class="td-bold">${esc(p.name)}</td>
                <td>${esc(p.category || '—')}</td>
                <td style="font-weight:700;color:var(--${isLow?'brand-danger':'text-primary'})">${p.stock_qty}</td>
                <td>${fmt(p.sell_price)}</td>
                <td><span class="status-badge ${isLow?'status-danger':'status-success'}">${isLow?'⚠ Low':'✓ OK'}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function loadStaffTasks() {
  const content = document.getElementById('pageContent');
  if (!content) return;
  const res   = await apiGet(API.tasks);
  const tasks = res.tasks || [];
  const pending = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  const done    = tasks.filter(t => t.status === 'done');
  content.innerHTML = `
    <div class="page-header mb-6"><h1 class="page-title">My Tasks</h1></div>
    <div class="dash-card mb-6">
      <div class="dash-card-header"><span class="dash-card-title">Pending (${pending.length})</span></div>
      ${pending.length === 0 ? '<p style="color:var(--text-muted);padding:20px;text-align:center">No pending tasks 🎉</p>'
        : pending.map(t => `<div class="task-card ${t.priority==='urgent'?'urgent':''}">
          <div class="flex-between">
            <div class="task-title">${esc(t.title)}</div>
            <span class="status-badge status-${t.priority==='urgent'?'danger':t.priority==='high'?'warning':'info'}">${t.priority}</span>
          </div>
          ${t.description ? `<p style="font-size:.82rem;color:var(--text-secondary);margin:4px 0">${esc(t.description)}</p>` : ''}
          <div class="task-meta">${t.due_date?'Due: '+fmtDate(t.due_date):''}</div>
          <button class="btn btn-success btn-sm" style="margin-top:8px" onclick="staffMarkDone('${t.id}')"><i class="fa-solid fa-check"></i> Mark Done</button>
        </div>`).join('')}
    </div>
    ${done.length > 0 ? `<div class="dash-card"><div class="dash-card-header"><span class="dash-card-title">Completed (${done.length})</span></div>
      ${done.map(t => `<div class="task-card done"><div class="task-title" style="text-decoration:line-through">${esc(t.title)}</div><span class="status-badge status-success">✓ Done</span></div>`).join('')}
    </div>` : ''}`;
}

async function staffMarkDone(id) {
  const res = await apiPost(API.tasks, { action: 'update-status', id, status: 'done' });
  if (res.success) { toast('Marked as done!'); loadStaffTasks(); }
  else toast(res.error || 'Failed.', 'error');
}

async function loadStaffHistory() {
  const content = document.getElementById('pageContent');
  if (!content) return;
  const res   = await apiGet(API.sales, { range: 30 });
  const sales = res.sales || [];
  content.innerHTML = `
    <div class="page-header mb-6"><h1 class="page-title">My Sales History</h1></div>
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px">
      <div class="stat-card" style="--card-color:#4f46e5"><div class="stat-card-icon"><i class="fa-solid fa-list"></i></div><div class="stat-label">Transactions</div><div class="stat-value">${sales.length}</div></div>
      <div class="stat-card" style="--card-color:#10b981"><div class="stat-card-icon"><i class="fa-solid fa-money-bill"></i></div><div class="stat-label">Total Revenue</div><div class="stat-value">${fmt(res.rangeTotal)}</div></div>
      <div class="stat-card" style="--card-color:#f59e0b"><div class="stat-card-icon"><i class="fa-solid fa-calendar-day"></i></div><div class="stat-label">Today</div><div class="stat-value">${fmt(res.todayTotal)}</div></div>
    </div>
    <div class="dash-card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
          <tbody>
            ${sales.length === 0
              ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:28px">No sales recorded.</td></tr>'
              : sales.map(s => `<tr><td>${fmtDate(s.sale_date)}</td><td class="td-bold">${esc(s.product_name)}</td><td>${s.qty}</td><td>${fmt(s.unit_price)}</td><td><strong>${fmt(s.total)}</strong></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ═══════════════ CHARTS ═══════════════ */
function chartDefaults() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    textColor: dark ? '#94a3b8' : '#64748b',
    gridColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
  };
}

function drawLineChart(id, labels, values, label) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  const { textColor, gridColor } = chartDefaults();
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{ label, data: values, borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,0.08)', borderWidth: 2.5, pointBackgroundColor: '#4f46e5', pointRadius: 4, fill: true, tension: 0.4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` KES ${Number(c.raw).toLocaleString()}` } } },
      scales: {
        x: { ticks: { color: textColor, font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { color: textColor, font: { size: 11 }, callback: v => 'KES ' + Number(v).toLocaleString() }, grid: { color: gridColor } }
      }
    }
  });
}

function drawBarChart(id, labels, revenue, expenses) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  const { textColor, gridColor } = chartDefaults();
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Revenue', data: revenue, backgroundColor: 'rgba(79,70,229,0.8)', borderRadius: 6 },
        { label: 'Expenses', data: expenses, backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 6 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { color: textColor, usePointStyle: true } }, tooltip: { callbacks: { label: c => ` KES ${Number(c.raw).toLocaleString()}` } } },
      scales: {
        x: { ticks: { color: textColor }, grid: { display: false } },
        y: { ticks: { color: textColor, callback: v => 'KES ' + Number(v).toLocaleString() }, grid: { color: gridColor } }
      }
    }
  });
}

/* ═══════════════ FORM HELPERS ═══════════════ */
function showFieldErr(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.style.display = 'block'; } }
function clearFieldErrors()    { document.querySelectorAll('.field-error').forEach(e => { e.textContent = ''; e.style.display = 'none'; }); }
function showAlert(id, msg)    { const el = document.getElementById(id); if (el) { el.textContent = msg; el.style.display = 'flex'; } }

function togglePw(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  if (!input || !icon) return;
  if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash'); }
  else { input.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye'); }
}
