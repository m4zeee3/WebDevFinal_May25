/* =============================================
   Roots – Cashier POS JS
   ============================================= */

const API = '../api';
let allProducts = [];
let cart = [];
let currentCat = 'All';
let cashierName = '';

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  loadMenu();
  bindEvents();
  updateDateTime();
  setInterval(updateDateTime, 60000);
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
    const imgHtml = p.image
      ? `<img src="${esc(p.image)}" class="menu-item-img" alt="${esc(p.name)}">`
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
    existing.quantity++;
  } else {
    cart.push({ productID, name: product.name, price: parseFloat(product.price), quantity: 1 });
  }
  updateCartUI();
}

function updateQty(productID, delta) {
  const item = cart.find(c => c.productID === productID);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter(c => c.productID !== productID);
  updateCartUI();
}

function removeItem(productID) {
  cart = cart.filter(c => c.productID !== productID);
  updateCartUI();
}

function clearCart() {
  cart = [];
  document.getElementById('cashInput').value = '';
  document.getElementById('changeDisplay').textContent = '';
  updateCartUI();
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

  cartEl.innerHTML = cart.map(item => `
    <div class="pos-cart-item">
      <div style="flex:1">
        <div class="pos-item-name">${esc(item.name)}</div>
        <div class="pos-item-unit">₱${item.price.toFixed(2)} ea.</div>
      </div>
      <div class="pos-qty-btns">
        <button class="pos-qty-btn" onclick="updateQty(${item.productID}, -1)">−</button>
        <span class="pos-qty-val">${item.quantity}</span>
        <button class="pos-qty-btn" onclick="updateQty(${item.productID}, 1)">+</button>
      </div>
      <div class="pos-item-price">₱${(item.price * item.quantity).toFixed(2)}</div>
      <button class="qty-btn" onclick="removeItem(${item.productID})" style="color:var(--danger);background:none;border:none;font-size:.9rem">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`).join('');
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
  const cash  = parseFloat(document.getElementById('cashInput').value) || 0;
  const total = getTotal();

  if (cash < total) {
    showToast('Cash received is less than total', 'error');
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

async function logout() {
  await fetch(`${API}/auth.php?action=logout`, { method: 'POST' });
  window.location.href = '../admin/login.html';
}

function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}
