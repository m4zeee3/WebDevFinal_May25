/* =============================================
   Roots – Kitchen Display JS
   Auto-refreshes every 5 seconds. No login needed.
   ============================================= */

const API = '../api';
const REFRESH_MS = 5000;

let knownOrderIDs = new Set();
let refreshTimer;

document.addEventListener('DOMContentLoaded', () => {
  startClock();
  loadOrders();
  scheduleRefresh();
});

// ----- Clock -----
function startClock() {
  const tick = () => {
    document.getElementById('kitchenClock').textContent =
      new Date().toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  };
  tick();
  setInterval(tick, 1000);
}

// ----- Load Orders -----
async function loadOrders() {
  try {
    const orders = await fetch(`${API}/orders.php?action=kitchen`).then(r => r.json());
    renderOrders(orders);
    setLiveStatus(orders.length);
  } catch {
    document.getElementById('statusLabel').textContent = 'Connection error';
    document.getElementById('pulseIndicator').style.background = '#dc3545';
  }
}

// ----- Render Orders -----
function renderOrders(orders) {
  const content = document.getElementById('kitchenContent');

  if (!orders.length) {
    content.innerHTML = `
      <div class="kitchen-empty">
        <i class="fa-solid fa-mug-hot"></i>
        <h2>No Active Orders</h2>
        <p>All caught up! Waiting for new orders…</p>
      </div>`;
    knownOrderIDs = new Set();
    return;
  }

  // Detect genuinely new orders (not on first load)
  const currentIDs  = new Set(orders.map(o => parseInt(o.orderID)));
  const hasNew      = knownOrderIDs.size > 0 && orders.some(o => !knownOrderIDs.has(parseInt(o.orderID)));

  if (hasNew) {
    showNewOrderBanner();
    playBell();
  }
  knownOrderIDs = currentIDs;

  content.innerHTML = `<div class="kitchen-grid">${orders.map(buildOrderCard).join('')}</div>`;
}

function buildOrderCard(o) {
  const isNew       = knownOrderIDs.size > 0 && !knownOrderIDs.has(parseInt(o.orderID));
  const isPreparing = o.status === 'preparing';
  const typeClass   = o.order_type === 'online' ? 'type-online' : 'type-walkin';
  const typeLabel   = o.order_type === 'online' ? 'Online' : 'Walk-in';

  const itemsHTML = (o.items || []).map(i => `
    <li>
      <span class="item-qty">${i.quantity}</span>
      <span class="item-name">${esc(i.product_name)}</span>
    </li>`).join('');

  const actionBtn = isPreparing
    ? `<button class="kitchen-btn btn-ready" onclick="setOrderStatus(${o.orderID},'ready')">
         <i class="fa-solid fa-bell-concierge"></i> Ready
       </button>`
    : `<button class="kitchen-btn btn-start" onclick="setOrderStatus(${o.orderID},'preparing')">
         <i class="fa-solid fa-fire-burner"></i> Start
       </button>`;

  return `
  <div class="order-card${isNew ? ' new-order' : ''}${isPreparing ? ' preparing' : ''}" id="card_${o.orderID}">
    <div class="order-card-header">
      <div>
        <div class="order-id">#${o.orderID}</div>
        <div class="order-customer"><i class="fa-solid fa-user" style="font-size:.7rem"></i> ${esc(o.customer_name)}</div>
      </div>
      <div style="text-align:right">
        <span class="order-type-badge ${typeClass}">${typeLabel}</span>
        <div class="order-time">${formatTime(o.orderDateTime)}</div>
      </div>
    </div>

    <ul class="order-items-list">${itemsHTML || '<li style="opacity:.5">No items</li>'}</ul>

    <div class="order-card-footer">
      <div class="order-elapsed">
        Waiting: <span class="time-val">${getElapsed(o.orderDateTime)}</span>
      </div>
      <div style="display:flex;gap:6px">
        ${actionBtn}
        <button class="kitchen-btn btn-cancel" onclick="setOrderStatus(${o.orderID},'cancelled')" title="Cancel">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  </div>`;
}

// ----- Update Order Status -----
async function setOrderStatus(orderID, status) {
  try {
    await fetch(`${API}/orders.php?action=update_status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderID, status }),
    });
    loadOrders(); // immediate re-render
  } catch { console.error('Status update failed'); }
}

// ----- UI Helpers -----
function setLiveStatus(count) {
  document.getElementById('statusLabel').textContent = 'Live';
  document.getElementById('pulseIndicator').style.background = '#28a745';
  const el = document.getElementById('orderCount');
  el.textContent = count > 0 ? `${count} active order${count > 1 ? 's' : ''}` : 'No active orders';
}

function showNewOrderBanner() {
  const banner = document.getElementById('newOrderBanner');
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 3500);
}

function playBell() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch {}
}

// ----- Auto-Refresh -----
function scheduleRefresh() {
  // Restart CSS progress bar
  const prog = document.getElementById('refreshProgress');
  prog.style.animation = 'none';
  void prog.offsetWidth;
  prog.style.animation = '';

  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    loadOrders();
    scheduleRefresh();
  }, REFRESH_MS);
}

// ----- Utilities -----
function getElapsed(dateStr) {
  const sec = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (sec < 60)   return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec/60)}m ${sec%60}s`;
  return `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}m`;
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' });
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
