/* =============================================
   Roots – Admin Order History JS
   ============================================= */

const ADMIN_API = '../api';

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth('admin');

  // Set default date range: this month
  const today   = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  document.getElementById('histFrom').value = firstDay.toISOString().split('T')[0];
  document.getElementById('histTo').value   = today.toISOString().split('T')[0];

  loadHistory();

  document.getElementById('searchH').addEventListener('keydown', e => { if (e.key === 'Enter') loadHistory(); });
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

async function loadHistory() {
  const search = document.getElementById('searchH').value.trim();
  const from   = document.getElementById('histFrom').value;
  const to     = document.getElementById('histTo').value;
  const status = document.getElementById('histStatus').value;

  let url = `${ADMIN_API}/orders.php?action=list&limit=200`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (from)   url += `&date_from=${from}`;
  if (to)     url += `&date_to=${to}`;
  if (status) url += `&status=${encodeURIComponent(status)}`;

  const tbody = document.getElementById('historyBody');
  tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Loading…</td></tr>`;

  try {
    const orders = await fetch(url).then(r => r.json());
    renderHistory(orders);
    document.getElementById('resultCount').textContent = `${orders.length} result(s)`;
  } catch {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Failed to load</td></tr>`;
  }
}

function renderHistory(orders) {
  const tbody = document.getElementById('historyBody');
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:40px">No orders found</td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><strong>#${o.orderID}</strong></td>
      <td>${esc(o.customer_name)}</td>
      <td>${o.order_type === 'online' ? '📱 Online' : '🧍 Walk-in'}</td>
      <td>₱${parseFloat(o.totalAmount).toFixed(2)}</td>
      <td><span class="badge badge-${o.status}">${o.status}</span></td>
      <td>${o.employee_name ? esc(o.employee_name) : '<span class="text-muted">—</span>'}</td>
      <td style="white-space:nowrap;font-size:.8rem">${formatDate(o.orderDateTime)}</td>
    </tr>`).join('');
}

function clearH() {
  document.getElementById('searchH').value  = '';
  document.getElementById('histStatus').value = '';
  const today    = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  document.getElementById('histFrom').value = firstDay.toISOString().split('T')[0];
  document.getElementById('histTo').value   = today.toISOString().split('T')[0];
  loadHistory();
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

function formatDate(str) {
  return new Date(str).toLocaleString('en-PH', {
    year:'numeric', month:'short', day:'numeric',
    hour:'2-digit', minute:'2-digit',
  });
}

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}
