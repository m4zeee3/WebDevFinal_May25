/* =============================================
   Roots – Admin Inventory JS
   ============================================= */

const ADMIN_API = '../api';

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth('admin');
  loadInventory();

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

async function loadInventory() {
  const lowOnly = document.getElementById('showLowOnly').checked ? 1 : 0;

  try {
    const [products, summary] = await Promise.all([
      fetch(`${ADMIN_API}/inventory.php?action=list&low_stock=${lowOnly}`).then(r => r.json()),
      fetch(`${ADMIN_API}/inventory.php?action=summary`).then(r => r.json()),
    ]);

    renderSummary(summary);
    renderInventory(products);

    // Show low stock alert if any
    const lowAlert = document.getElementById('lowAlert');
    if (parseInt(summary.low_stock) > 0 || parseInt(summary.out_of_stock) > 0) {
      lowAlert.style.display = 'block';
    } else {
      lowAlert.style.display = 'none';
    }
  } catch { showToast('Failed to load inventory', 'error'); }
}

function renderSummary(s) {
  document.getElementById('invSummary').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon brown"><i class="fa-solid fa-boxes-stacked"></i></div>
      <div><div class="stat-label">Total Products</div><div class="stat-value">${s.total_products}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green"><i class="fa-solid fa-check-circle"></i></div>
      <div><div class="stat-label">In Stock</div><div class="stat-value">${s.in_stock}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon orange"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div><div class="stat-label">Low Stock (≤10)</div><div class="stat-value">${s.low_stock}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon red"><i class="fa-solid fa-xmark-circle"></i></div>
      <div><div class="stat-label">Out of Stock</div><div class="stat-value">${s.out_of_stock}</div></div>
    </div>`;
}

function renderInventory(products) {
  const tbody = document.getElementById('invBody');
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:40px">No products found</td></tr>`;
    return;
  }

  const catIcons = { 'Appetizer':'🍟','Main Course':'🍽️','Drinks':'☕','Dessert':'🍰','Specialty':'⭐' };

  tbody.innerHTML = products.map(p => {
    const qty = parseInt(p.quantity);
    let levelClass, levelLabel, barWidth;

    if (qty <= 0) {
      levelClass = 'stock-out'; levelLabel = 'Out'; barWidth = '100%';
    } else if (qty <= 10) {
      levelClass = 'stock-low'; levelLabel = 'Low'; barWidth = `${Math.min(qty * 10, 100)}%`;
    } else {
      levelClass = 'stock-ok'; levelLabel = 'Good'; barWidth = `${Math.min(qty * 2, 100)}%`;
    }

    return `<tr>
      <td>${catIcons[p.category]||'☕'} <strong>${esc(p.name)}</strong></td>
      <td>${p.category}</td>
      <td style="font-size:1.1rem;font-weight:700;color:${qty<=0?'var(--danger)':qty<=10?'var(--warning)':'var(--success)'}">${qty}</td>
      <td>
        <div class="${levelClass}">
          <div class="stock-bar"><div class="stock-bar-fill" style="width:${barWidth}"></div></div>
          <span style="font-size:.7rem;font-weight:600">${levelLabel}</span>
        </div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <input type="number" min="0" value="${qty}"
            id="stock_${p.productID}"
            style="width:70px;padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:.875rem"
            onkeydown="if(event.key==='Enter') updateStock(${p.productID})">
          <button class="btn btn-primary btn-sm" onclick="updateStock(${p.productID})">
            <i class="fa-solid fa-floppy-disk"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function updateStock(productID) {
  const input = document.getElementById(`stock_${productID}`);
  const qty   = parseInt(input.value);
  if (isNaN(qty) || qty < 0) { showToast('Invalid quantity', 'error'); return; }

  try {
    const res  = await fetch(`${ADMIN_API}/inventory.php?action=update_stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productID, quantity: qty }),
    });
    const data = await res.json();
    if (data.success) { showToast('Stock updated!', 'success'); loadInventory(); }
    else showToast('Update failed', 'error');
  } catch { showToast('Network error', 'error'); }
}

async function logout() {
  await fetch(`${ADMIN_API}/auth.php?action=logout`, { method: 'POST' });
  window.location.href = 'login.html';
}

function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}
