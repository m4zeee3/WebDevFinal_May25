/* =============================================
   Roots – Admin Reports JS
   ============================================= */

const ADMIN_API = '../api';

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth('admin');

  const today    = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  document.getElementById('reportFrom').value = firstDay.toISOString().split('T')[0];
  document.getElementById('reportTo').value   = today.toISOString().split('T')[0];

  loadReports();

  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
  });
  document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
  });
});

async function checkAuth(role) {
  try {
    const res  = await fetch(`${ADMIN_API}/auth.php?action=check`);
    const data = await res.json();
    if (!data.logged_in || data.role !== role) { window.location.href = 'login.html'; return; }
    document.getElementById('userName').textContent = data.name;
    document.getElementById('userRole').textContent = data.role.toUpperCase();
  } catch { window.location.href = 'login.html'; }
}

async function loadReports() {
  const period = document.getElementById('reportPeriod').value;
  const from   = document.getElementById('reportFrom').value;
  const to     = document.getElementById('reportTo').value;

  const base = `${ADMIN_API}/reports.php?date_from=${from}&date_to=${to}`;

  try {
    const [sales, ranking, catPerf] = await Promise.all([
      fetch(`${base}&action=sales&period=${period}`).then(r => r.json()),
      fetch(`${base}&action=product_ranking`).then(r => r.json()),
      fetch(`${base}&action=category_performance`).then(r => r.json()),
    ]);

    renderSales(sales, from, to);
    renderRanking(ranking);
    renderCategories(catPerf);
  } catch { showToast('Failed to load reports', 'error'); }
}

function renderSales(data, from, to) {
  const tbody = document.getElementById('salesBody');
  const meta  = document.getElementById('salesSummaryMeta');

  meta.textContent = `${from} → ${to}`;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No data for this period</td></tr>`;
    return;
  }

  const totalRev    = data.reduce((s, r) => s + parseFloat(r.revenue), 0);
  const totalOrders = data.reduce((s, r) => s + parseInt(r.order_count), 0);

  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${esc(r.period)}</td>
      <td>${r.order_count}</td>
      <td>₱${parseFloat(r.revenue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
    </tr>`).join('') + `
    <tr style="background:var(--cream);font-weight:700">
      <td>TOTAL</td>
      <td>${totalOrders}</td>
      <td>₱${totalRev.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
    </tr>`;
}

function renderRanking(data) {
  const tbody = document.getElementById('rankBody');
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No data</td></tr>`; return; }
  tbody.innerHTML = data.map((r, i) => `
    <tr>
      <td>${i < 3 ? ['🥇','🥈','🥉'][i] : (i+1)} ${esc(r.name)}</td>
      <td><span class="badge" style="background:var(--cream);color:var(--brown-dark)">${r.category}</span></td>
      <td><strong>${r.total_sold}</strong></td>
      <td>₱${parseFloat(r.revenue).toFixed(2)}</td>
    </tr>`).join('');
}

function renderCategories(data) {
  const tbody = document.getElementById('catBody');
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No data</td></tr>`; return; }
  const catIcons = { 'Appetizer':'🍟','Main Course':'🍽️','Drinks':'☕','Dessert':'🍰','Specialty':'⭐' };
  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${catIcons[r.category]||''} ${r.category}</td>
      <td>${r.order_count}</td>
      <td>${r.total_sold}</td>
      <td>₱${parseFloat(r.revenue).toFixed(2)}</td>
    </tr>`).join('');
}

function exportCSV() {
  const from = document.getElementById('reportFrom').value;
  const to   = document.getElementById('reportTo').value;
  window.location.href = `${ADMIN_API}/reports.php?action=export_csv&date_from=${from}&date_to=${to}`;
}

function logout() {
  showConfirm({
    title: 'Log Out',
    message: 'Are you sure you want to log out?',
    confirmLabel: 'Log Out',
    type: 'logout',
    onConfirm: async () => {
      await fetch(`${ADMIN_API}/auth.php?action=logout`, { method: 'POST' });
      window.location.href = 'login.html';
    },
  });
}

function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}
