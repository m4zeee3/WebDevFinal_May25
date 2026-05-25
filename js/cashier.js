/* =============================================
   Roots – Cashier POS JS
   ============================================= */

const API = '../api';
let allProducts = [];
let cart = [];
let currentCat = 'All';
let cashierName = '';
let currentTab = 'walkin';
let activePaymentOrder = null;
let onlineRefreshTimer;

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  loadMenu();
  bindEvents();
  updateDateTime();
  setInterval(updateDateTime, 60000);
  pollOnlineBadge();
  setInterval(pollOnlineBadge, 30000);
});

// ----- Auth -----
async function checkAuth() {
  try {
    const res  = await fetch(`${API}/auth.php?action=check`);
    const data = await res.json();
    if (!data.logged_in) { window.location.href = '../admin/login.html'; return; }
    if (data.role !== 'cashier' && data.role !== 'admin') {
      window.location.href = '../admin/login.html'; return;
    }
    cashierName = data.name;
    document.getElementById('cashierName').textContent = data.name;
  } catch { window.location.href = '../admin/login.html'; }
}

// ----- Menu -----
async function loadMenu() {
  try {
    const data = await fetch(`${API}/products.php?action=list&available=1`).then(r => r.json());
    allProducts = data;
    renderMenu(allProducts);
  } catch {
    document.getElementById('menuGrid').innerHTML = '<p class="text-muted" style="padding:32px">Failed to load menu</p>';
  }
}

function renderMenu(products) {
  const grid = document.getElementById('menuGrid');
  const catIcons = { 'Appetizer':'🍟','Main Course':'🍽️','Drinks':'☕','Dessert':'🍰','Specialty':'⭐' };

  if (!products.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fa-solid fa-mug-saucer"></i><p>No items</p></div>';
    return;
  }

  grid.innerHTML = products.map(p => {
    const outOfStock = parseInt(p.quantity) <= 0;
    const imgSrc = p.image
      ? ((p.image.startsWith('http') || p.image.startsWith('/') || p.image.startsWith('../'))
          ? p.image : '../' + p.image)
      : null;
    const imgHtml = imgSrc
      ? `<img src="${esc(imgSrc)}" class="menu-item-img" alt="${esc(p.name)}" onerror="this.style.display='none'">`
      : `<div class="menu-item-placeholder">${catIcons[p.category]||'☕'}</div>`;

    return `
    <div class="menu-item${outOfStock?' out-of-stock':''}" onclick="addToCart(${p.productID})" data-id="${p.productID}">
      ${imgHtml}
      <div class="menu-item-info">
        <div class="menu-item-name">${esc(p.name)}</div>
        <div class="menu-item-price">₱${parseFloat(p.price).toFixed(2)}</div>
        <div class="menu-item-stock">${outOfStock ? '❌ Out of stock' : `Qty: ${p.quantity}`}</div>
      </div>
    </div>`;
  }).join('');
}

function filterMenu() {
  const search = document.getElementById('posSearch').value.toLowerCase();
  let filtered = allProducts.filter(p => {
    const matchCat    = currentCat === 'All' || p.category === currentCat;
    const matchSearch = !search || p.name.toLowerCase().includes(search);
    return matchCat && matchSearch;
  });
  renderMenu(filtered);
}

// ----- Cart -----
function addToCart(productID) {
  const product = allProducts.find(p => parseInt(p.productID) === productID);
  if (!product || parseInt(product.quantity) <= 0) return;

  const existing = cart.find(c => c.productID === productID);
  if (existing) {
    if (existing.quantity >= parseInt(product.quantity)) {
      showToast(`Only ${product.quantity} of "${product.name}" available`, 'error');
      return;
    }
    existing.quantity++;
  } else {
    cart.push({ productID, name: product.name, price: parseFloat(product.price), quantity: 1 });
  }
  updateCartUI();
}

function updateQty(productID, delta) {
  const item    = cart.find(c => c.productID === productID);
  const product = allProducts.find(p => parseInt(p.productID) === productID);
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    cart = cart.filter(c => c.productID !== productID);
    updateCartUI();
    return;
  }
  if (product && newQty > parseInt(product.quantity)) {
    showToast(`Only ${product.quantity} of "${product.name}" in stock`, 'error');
    return;
  }
  item.quantity = newQty;
  updateCartUI();
}

function setQty(productID, rawValue) {
  const qty     = parseInt(rawValue);
  const item    = cart.find(c => c.productID === productID);
  const product = allProducts.find(p => parseInt(p.productID) === productID);
  if (!item || !product) return;

  if (isNaN(qty) || qty < 1) {
    showToast('Quantity must be at least 1', 'error');
    updateCartUI();
    return;
  }
  if (qty > parseInt(product.quantity)) {
    showToast(`Only ${product.quantity} of "${product.name}" available`, 'error');
    updateCartUI();
    return;
  }
  item.quantity = qty;
  updateCartUI();
}

function removeItem(productID) {
  cart = cart.filter(c => c.productID !== productID);
  updateCartUI();
}

function clearCart() {
  if (cart.length === 0) return;
  showConfirm({
    title: 'Clear Order',
    message: 'Remove all items from the current order?',
    confirmLabel: 'Clear',
    type: 'danger',
    onConfirm: () => {
      cart = [];
      document.getElementById('cashInput').value = '';
      document.getElementById('changeDisplay').textContent = '';
      updateCartUI();
    },
  });
}

function getTotal() {
  return cart.reduce((s, c) => s + c.price * c.quantity, 0);
}

function updateCartUI() {
  const total    = getTotal();
  const count    = cart.reduce((s, c) => s + c.quantity, 0);
  const cartEl   = document.getElementById('posCartItems');
  const checkBtn = document.getElementById('posCheckoutBtn');

  document.getElementById('posSubtotal').textContent = `₱${total.toFixed(2)}`;
  document.getElementById('posTotal').textContent    = `₱${total.toFixed(2)}`;
  document.getElementById('cartItemCount').textContent = `${count} item(s)`;

  checkBtn.disabled = cart.length === 0;
  calcChange();

  if (cart.length === 0) {
    cartEl.innerHTML = `<div class="pos-cart-empty">
      <i class="fa-solid fa-mug-hot"></i><p>No items yet</p>
      <p style="font-size:.75rem">Click a menu item to add</p></div>`;
    return;
  }

  cartEl.innerHTML = cart.map(item => {
    const product = allProducts.find(p => parseInt(p.productID) === item.productID);
    const stock   = product ? parseInt(product.quantity) : item.quantity;
    return `
    <div class="pos-cart-item">
      <div style="flex:1">
        <div class="pos-item-name">${esc(item.name)}</div>
        <div class="pos-item-unit">₱${item.price.toFixed(2)} ea.</div>
      </div>
      <div class="pos-qty-btns">
        <button class="pos-qty-btn" onclick="updateQty(${item.productID}, -1)">−</button>
        <input type="number" class="pos-qty-val" value="${item.quantity}"
          min="1" max="${stock}"
          onchange="setQty(${item.productID}, this.value)"
          onclick="this.select()">
        <button class="pos-qty-btn" onclick="updateQty(${item.productID}, 1)">+</button>
      </div>
      <div class="pos-item-price">₱${(item.price * item.quantity).toFixed(2)}</div>
      <button class="qty-btn" onclick="removeItem(${item.productID})" style="color:var(--danger);background:none;border:none;font-size:.9rem">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`;
  }).join('');
}

function calcChange() {
  const cash  = parseFloat(document.getElementById('cashInput').value) || 0;
  const total = getTotal();
  const el    = document.getElementById('changeDisplay');

  if (!cash || total === 0) { el.textContent = ''; el.className = 'change-display'; return; }

  if (cash < total) {
    el.textContent = `Short by ₱${(total - cash).toFixed(2)}`;
    el.className = 'change-display change-error';
  } else {
    el.textContent = `Change: ₱${(cash - total).toFixed(2)}`;
    el.className = 'change-display';
  }
}

// ----- Checkout -----
async function processCheckout() {
  const cashRaw = document.getElementById('cashInput').value.trim();
  const cash    = parseFloat(cashRaw);
  const total   = getTotal();

  if (!cashRaw) {
    showToast('Please enter the cash amount received', 'error');
    document.getElementById('cashInput').focus();
    return;
  }
  if (isNaN(cash) || cash < 0) {
    showToast('Cash amount must be a valid positive number', 'error');
    document.getElementById('cashInput').focus();
    return;
  }
  if (cash > 999999) {
    showToast('Cash amount is too large', 'error');
    document.getElementById('cashInput').focus();
    return;
  }
  if (cart.length === 0) {
    showToast('Cart is empty', 'error');
    return;
  }
  if (cash < total) {
    showToast('Cash received is less than the total amount', 'error');
    document.getElementById('cashInput').focus();
    return;
  }

  const btn = document.getElementById('posCheckoutBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div>';

  try {
    const res = await fetch(`${API}/orders.php?action=place`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Walk-in',
        items: cart.map(c => ({ productID: c.productID, quantity: c.quantity })),
      }),
    });
    const data = await res.json();

    if (data.success) {
      showReceipt(data.orderID, data.total, cash);
    } else {
      showToast(data.error || 'Checkout failed', 'error');
    }
  } catch { showToast('Network error', 'error'); }
  finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Checkout';
  }
}

function showReceipt(orderID, total, cash) {
  const change = cash - total;
  const now    = new Date().toLocaleString('en-PH');

  const itemsHTML = cart.map(i =>
    `<div class="receipt-row"><span>${esc(i.name)} x${i.quantity}</span><span>₱${(i.price*i.quantity).toFixed(2)}</span></div>`
  ).join('');

  document.getElementById('receiptContent').innerHTML = `
    <div class="receipt-header">
      <div class="receipt-logo">Roots</div>
      <div style="font-size:.7rem;letter-spacing:.15em;font-weight:700">COFFEE & CRAFT</div>
      <div style="font-size:.72rem;margin-top:4px">${now}</div>
      <div style="font-size:.72rem">Order #${orderID}</div>
    </div>
    <div style="padding:8px 0">${itemsHTML}</div>
    <hr class="receipt-divider">
    <div class="receipt-row total"><span>TOTAL</span><span>₱${parseFloat(total).toFixed(2)}</span></div>
    <div class="receipt-row"><span>Cash</span><span>₱${parseFloat(cash).toFixed(2)}</span></div>
    <div class="receipt-row"><span><strong>Change</strong></span><span><strong>₱${change.toFixed(2)}</strong></span></div>
    <div class="receipt-footer">
      Thank you for visiting!<br>Come back soon ☕
    </div>`;

  document.getElementById('receiptModal').classList.add('active');

  // Clear cart after showing receipt
  const prevCart = [...cart];
  cart = [];
  document.getElementById('cashInput').value = '';
  updateCartUI();
  loadMenu(); // refresh stock counts
  showToast(`Order #${orderID} placed!`, 'success');
}

function closeReceipt() {
  document.getElementById('receiptModal').classList.remove('active');
}

// ----- Tab Switching -----
function switchTab(tab) {
  currentTab = tab;
  const isWalkin = tab === 'walkin';

  document.getElementById('panelWalkin').style.display = isWalkin ? 'block' : 'none';
  document.getElementById('panelOnline').style.display = isWalkin ? 'none' : 'flex';

  document.getElementById('tabWalkin').style.color       = isWalkin ? 'var(--brown-dark)' : 'var(--text-muted)';
  document.getElementById('tabWalkin').style.borderBottomColor = isWalkin ? 'var(--brown-dark)' : 'transparent';
  document.getElementById('tabOnline').style.color       = isWalkin ? 'var(--text-muted)' : 'var(--brown-dark)';
  document.getElementById('tabOnline').style.borderBottomColor = isWalkin ? 'transparent' : 'var(--brown-dark)';

  if (!isWalkin) loadOnlineOrders();
}

// ----- All Orders Panel -----
async function loadOnlineOrders() {
  const list = document.getElementById('onlineOrdersList');
  list.innerHTML = '<div class="pos-cart-empty"><div class="spinner"></div></div>';

  try {
    const [pending, preparing, ready] = await Promise.all([
      fetch(`${API}/orders.php?action=list&status=pending`).then(r => r.json()),
      fetch(`${API}/orders.php?action=list&status=preparing`).then(r => r.json()),
      fetch(`${API}/orders.php?action=list&status=ready`).then(r => r.json()),
    ]);

    const orders = [...ready, ...preparing, ...pending];
    updateOnlineBadge(orders.length);

    if (!orders.length) {
      list.innerHTML = `<div class="pos-cart-empty">
        <i class="fa-solid fa-check-circle" style="font-size:2rem;color:var(--success)"></i>
        <p>No active orders</p>
        <p style="font-size:.75rem">All orders are settled</p>
      </div>`;
      return;
    }

    const statusColors = { pending: 'var(--warning)', preparing: 'var(--brown-mid)', ready: 'var(--success)' };
    const typeIcon     = { online: '📱', 'walk-in': '🧍' };

    list.innerHTML = orders.map(o => {
      const color       = statusColors[o.status] || 'var(--text-muted)';
      const isOnline    = o.order_type === 'online';
      const needsPayment = isOnline && (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready');

      return `
      <div style="background:#fff;border:1.5px solid var(--border);border-radius:10px;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:6px">
            <strong style="color:var(--brown-dark)">#${o.orderID}</strong>
            <span style="font-size:.68rem;background:${isOnline ? 'var(--cream)' : '#f0f0f0'};
              color:var(--brown-dark);padding:1px 7px;border-radius:10px;font-weight:600">
              ${typeIcon[o.order_type] || ''} ${o.order_type}
            </span>
          </div>
          <span style="font-size:.72rem;font-weight:700;color:${color};text-transform:uppercase">${o.status}</span>
        </div>
        <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:4px">
          <i class="fa-solid fa-user" style="font-size:.7rem"></i> ${esc(o.customer_name)}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
          <span style="font-size:.75rem;color:var(--text-muted)">${formatTime(o.orderDateTime)}</span>
          <strong style="color:var(--brown-dark)">₱${parseFloat(o.totalAmount).toFixed(2)}</strong>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px">
          ${isOnline ? `
            <button class="btn btn-primary btn-sm" style="flex:1"
              onclick="openPaymentModal(${o.orderID})">
              <i class="fa-solid fa-peso-sign"></i> Collect Payment
            </button>` : `
            <span style="flex:1;font-size:.75rem;color:var(--success);font-weight:600;
              display:flex;align-items:center;gap:4px">
              <i class="fa-solid fa-circle-check"></i> Payment collected at checkout
            </span>`}
          <button class="btn btn-sm" style="background:#fce4ec;color:var(--danger);border:none"
            onclick="cancelOrder(${o.orderID})" title="Cancel order">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>`;
    }).join('');

  } catch { list.innerHTML = '<div class="pos-cart-empty"><p>Failed to load orders</p></div>'; }
}

async function cancelOrder(orderID) {
  showConfirm({
    title: 'Cancel Order',
    message: `Cancel Order #${orderID}? This cannot be undone.`,
    confirmLabel: 'Cancel Order',
    type: 'danger',
    onConfirm: async () => {
      try {
        await fetch(`${API}/orders.php?action=update_status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderID, status: 'cancelled' }),
        });
        showToast(`Order #${orderID} cancelled`, 'success');
        loadOnlineOrders();
      } catch { showToast('Network error', 'error'); }
    },
  });
}

async function pollOnlineBadge() {
  try {
    const [pending, preparing, ready] = await Promise.all([
      fetch(`${API}/orders.php?action=list&status=pending`).then(r => r.json()),
      fetch(`${API}/orders.php?action=list&status=preparing`).then(r => r.json()),
      fetch(`${API}/orders.php?action=list&status=ready`).then(r => r.json()),
    ]);
    const count = [...pending, ...preparing, ...ready].length;
    updateOnlineBadge(count);
    if (currentTab === 'online') loadOnlineOrders();
  } catch {}
}

function updateOnlineBadge(count) {
  const badge = document.getElementById('onlineBadge');
  if (count > 0) {
    badge.textContent  = count;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

async function openPaymentModal(orderID) {
  try {
    const o = await fetch(`${API}/orders.php?action=get&id=${orderID}`).then(r => r.json());
    activePaymentOrder = o;

    document.getElementById('pmOrderId').textContent   = `#${o.orderID}`;
    document.getElementById('pmCustomer').textContent  = o.customer_name;
    document.getElementById('pmTotal').textContent     = `₱${parseFloat(o.totalAmount).toFixed(2)}`;
    document.getElementById('pmCashInput').value       = '';
    document.getElementById('pmChangeDisplay').textContent = '';
    document.getElementById('pmChangeDisplay').className   = 'change-display';

    const statusColors = { pending:'badge-pending', preparing:'badge-preparing', ready:'badge-completed' };
    const pmStatus = document.getElementById('pmStatus');
    pmStatus.textContent  = o.status;
    pmStatus.className    = `badge ${statusColors[o.status] || ''}`;

    document.getElementById('pmItems').innerHTML = (o.items || []).map(i =>
      `<div style="display:flex;justify-content:space-between">
        <span>${esc(i.product_name)} × ${i.quantity}</span>
        <span>₱${(i.price * i.quantity).toFixed(2)}</span>
      </div>`
    ).join('');

    const isWalkin = o.order_type === 'walk-in';
    const cashSection  = document.querySelector('#paymentModal .cash-section');
    const collectBtn   = document.getElementById('pmCollectBtn');

    if (isWalkin) {
      cashSection.style.display  = 'none';
      collectBtn.style.display   = 'none';
    } else {
      cashSection.style.display  = 'block';
      collectBtn.style.display   = 'inline-flex';
      document.getElementById('pmCashInput').value = '';
      document.getElementById('pmChangeDisplay').textContent = '';
    }

    document.getElementById('paymentModal').classList.add('active');
  } catch { showToast('Failed to load order details', 'error'); }
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.remove('active');
  activePaymentOrder = null;
}

function calcPaymentChange() {
  const cash  = parseFloat(document.getElementById('pmCashInput').value) || 0;
  const total = activePaymentOrder ? parseFloat(activePaymentOrder.totalAmount) : 0;
  const el    = document.getElementById('pmChangeDisplay');

  if (!cash || total === 0) { el.textContent = ''; el.className = 'change-display'; return; }

  if (cash < total) {
    el.textContent = `Short by ₱${(total - cash).toFixed(2)}`;
    el.className   = 'change-display change-error';
  } else {
    el.textContent = `Change: ₱${(cash - total).toFixed(2)}`;
    el.className   = 'change-display';
  }
}

async function confirmPayment() {
  if (!activePaymentOrder) return;

  const cash   = parseFloat(document.getElementById('pmCashInput').value) || 0;
  const total  = parseFloat(activePaymentOrder.totalAmount);
  const status = activePaymentOrder.status;

  if (!document.getElementById('pmCashInput').value.trim()) {
    showToast('Please enter cash received', 'error');
    document.getElementById('pmCashInput').focus();
    return;
  }
  if (isNaN(cash) || cash < 0) {
    showToast('Invalid cash amount', 'error'); return;
  }
  if (cash < total) {
    showToast('Cash is less than the total amount', 'error');
    document.getElementById('pmCashInput').focus();
    return;
  }

  if (status === 'pending' || status === 'preparing') {
    const word = status === 'pending' ? 'not yet started' : 'still being prepared';
    showConfirm({
      title: 'Kitchen Not Done Yet',
      message: `Order #${activePaymentOrder.orderID} is ${word} in the kitchen. Collecting payment will mark it as completed and remove it from the kitchen display. Proceed anyway?`,
      confirmLabel: 'Proceed',
      cancelLabel: 'Wait',
      type: 'warning',
      onConfirm: () => doCollectPayment(),
    });
    return;
  }

  doCollectPayment();
}

async function doCollectPayment() {
  const cash = parseFloat(document.getElementById('pmCashInput').value) || 0;
  const btn  = document.getElementById('pmCollectBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Processing…';

  try {
    const res  = await fetch(`${API}/orders.php?action=update_status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderID: activePaymentOrder.orderID, status: 'completed' }),
    });
    const data = await res.json();

    if (data.success) {
      const order = activePaymentOrder;
      closePaymentModal();
      showToast(`Order #${order.orderID} — Payment collected ✓`, 'success');
      showOnlineReceipt(order, cash);
      loadOnlineOrders();
    } else {
      showToast(data.error || 'Failed to complete order', 'error');
    }
  } catch { showToast('Network error', 'error'); }
  finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Collect & Complete';
  }
}

function showOnlineReceipt(order, cash) {
  const change   = cash - parseFloat(order.totalAmount);
  const now      = new Date().toLocaleString('en-PH');
  const items    = (order.items || []).map(i =>
    `<div class="receipt-row"><span>${esc(i.product_name)} x${i.quantity}</span><span>₱${(i.price*i.quantity).toFixed(2)}</span></div>`
  ).join('');

  document.getElementById('receiptContent').innerHTML = `
    <div class="receipt-header">
      <div class="receipt-logo">Roots</div>
      <div style="font-size:.7rem;letter-spacing:.15em;font-weight:700">COFFEE & CRAFT</div>
      <div style="font-size:.72rem;margin-top:4px">${now}</div>
      <div style="font-size:.72rem">Order #${order.orderID} · Online</div>
      <div style="font-size:.72rem;margin-top:2px">Customer: ${esc(order.customer_name)}</div>
    </div>
    <div style="padding:8px 0">${items}</div>
    <hr class="receipt-divider">
    <div class="receipt-row total"><span>TOTAL</span><span>₱${parseFloat(order.totalAmount).toFixed(2)}</span></div>
    <div class="receipt-row"><span>Cash</span><span>₱${parseFloat(cash).toFixed(2)}</span></div>
    <div class="receipt-row"><span><strong>Change</strong></span><span><strong>₱${change.toFixed(2)}</strong></span></div>
    <div class="receipt-footer">Thank you for visiting!<br>Come back soon ☕</div>`;

  document.getElementById('receiptModal').classList.add('active');
}

// ----- Events -----
function bindEvents() {
  document.getElementById('posCatTabs').addEventListener('click', e => {
    const btn = e.target.closest('.pos-cat-tab');
    if (!btn) return;
    document.querySelectorAll('.pos-cat-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    currentCat = btn.dataset.cat;
    filterMenu();
  });

  document.getElementById('posSearch').addEventListener('input', filterMenu);
}

function updateDateTime() {
  const el = document.getElementById('posDate');
  if (el) el.textContent = new Date().toLocaleString('en-PH', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function logout() {
  showConfirm({
    title: 'Log Out',
    message: 'Are you sure you want to log out?',
    confirmLabel: 'Log Out',
    type: 'logout',
    onConfirm: async () => {
      await fetch(`${API}/auth.php?action=logout`, { method: 'POST' });
      window.location.href = '../admin/login.html';
    },
  });
}

function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

function formatTime(str) {
  return new Date(str).toLocaleString('en-PH', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}
