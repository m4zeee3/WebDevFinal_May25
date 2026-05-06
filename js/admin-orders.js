/* =============================================
   Roots – Admin Orders JS
   ============================================= */

const ADMIN_API = '../api';

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth('admin');
  loadOrders();
  setInterval(loadOrders, 30000);
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

async function loadOrders() {
  const status   = document.getElementById('filterStatus').value;
  const dateFrom = document.getElementById('filterFrom').value;
  const dateTo   = document.getElementById('filterTo').value;

  let url = `${ADMIN_API}/orders.php?action=list`;
  if (status)   url += `&status=${encodeURIComponent(status)}`;
  if (dateFrom) url += `&date_from=${dateFrom}`;
  if (dateTo)   url += `&date_to=${dateTo}`;

  try {
    const orders = await fetch(url).then(r => r.json());
    renderOrders(orders);
  } catch {
    document.getElementById('ordersBody').innerHTML =
      `<tr><td colspan="8" class="text-center text-muted">Failed to load orders</td></tr>`;
  }
}

function renderOrders(orders) {
  const tbody = document.getElementById('ordersBody');
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding:40px">No orders found</td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><strong>#${o.orderID}</strong></td>
      <td>${esc(o.customer_name)}</td>
      <td>${o.order_type === 'online' ? '📱 Online' : '🧍 Walk-in'}</td>
      <td><strong>₱${parseFloat(o.totalAmount).toFixed(2)}</strong></td>
      <td></td>
      <td>
        <select class="form-control" style="padding:5px 8px;font-size:.8rem;width:auto"
          onchange="updateStatus(${o.orderID}, this.value)">
          ${['pending','preparing','ready','completed','cancelled'].map(s =>
            `<option value="${s}" ${s===o.status?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td style="white-space:nowrap">${formatDate(o.orderDateTime)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewDetail(${o.orderID})">
          <i class="fa-solid fa-eye"></i>
        </button>
      </td>
    </tr>`).join('');
}

async function updateStatus(orderID, status) {
  try {
    const res  = await fetch(`${ADMIN_API}/orders.php?action=update_status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderID, status }),
    });
    const data = await res.json();
    if (data.success) showToast(`Order #${orderID} → ${status}`, 'success');
    else showToast('Update failed', 'error');
  } catch { showToast('Network error', 'error'); }
}

async function viewDetail(orderID) {
  const modal = document.getElementById('detailModal');
  const body  = document.getElementById('detailBody');
  body.innerHTML = '<div class="spinner-center"><div class="spinner"></div></div>';
  modal.classList.add('active');

  try {
    const o = await fetch(`${ADMIN_API}/orders.php?action=get&id=${orderID}`).then(r => r.json());
    document.getElementById('detailTitle').textContent = `Order #${o.orderID}`;

    const items = (o.items || []).map(i => `
      <li>
        <span>${esc(i.product_name)} <span class="text-muted">${i.category}</span></span>
        <span>${i.quantity} × ₱${parseFloat(i.price).toFixed(2)} = <strong>₱${(i.quantity*i.price).toFixed(2)}</strong></span>
      </li>`).join('');

    body.innerHTML = `
      <div class="detail-meta">
        <span><strong>Customer:</strong><br>${esc(o.customer_name)}</span>
        <span><strong>Type:</strong><br>${o.order_type}</span>
        <span><strong>Status:</strong><br><span class="badge badge-${o.status}">${o.status}</span></span>
        <span><strong>Date:</strong><br>${formatDate(o.orderDateTime)}</span>
        ${o.employee_name ? `<span><strong>Employee:</strong><br>${esc(o.employee_name)}</span>` : ''}
      </div>
      <hr style="margin:12px 0;border-color:var(--border)">
      <p class="text-muted mb-1" style="font-size:.8rem;font-weight:600">ITEMS</p>
      <ul class="order-detail-items">${items}</ul>
      <div style="display:flex;justify-content:flex-end;font-size:1.1rem;font-weight:800;color:var(--brown-dark);margin-top:12px">
        Total: ₱${parseFloat(o.totalAmount).toFixed(2)}
      </div>`;

    document.getElementById('detailFooter').innerHTML = `
      <select id="statusSelect" class="form-control" style="width:auto">
        ${['pending','preparing','ready','completed','cancelled'].map(s =>
          `<option value="${s}" ${s===o.status?'selected':''}>${s}</option>`).join('')}
      </select>
      <button class="btn btn-primary btn-sm" onclick="updateFromDetail(${o.orderID})">
        <i class="fa-solid fa-floppy-disk"></i> Update Status
      </button>`;
  } catch {
    body.innerHTML = '<p class="text-muted text-center">Failed to load details</p>';
  }
}

async function updateFromDetail(orderID) {
  const status = document.getElementById('statusSelect').value;
  await updateStatus(orderID, status);
  closeDetail();
  loadOrders();
}

function closeDetail() {
  document.getElementById('detailModal').classList.remove('active');
}

function clearFilters() {
  document.getElementById('filterStatus').value = '';
  document.getElementById('filterFrom').value   = '';
  document.getElementById('filterTo').value     = '';
  loadOrders();
}

async function logout() {
  await fetch(`${ADMIN_API}/auth.php?action=logout`, { method: 'POST' });
  window.location.href = 'login.html';
}

document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
});
document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
});

function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

function formatDate(str) {
  return new Date(str).toLocaleString('en-PH', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}
