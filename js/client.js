/* =============================================
   Roots – Client Ordering Page Logic
   ============================================= */

const API = '../api';
let allProducts = [];
let cart = [];
let currentCategory = 'All';

// ----- Boot -----
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  bindEvents();
});

// ----- Fetch Products -----
async function loadProducts() {
  try {
    const res  = await fetch(`api/products.php?action=list&available=1`);
    allProducts = await res.json();
    renderProducts(allProducts);
  } catch {
    document.getElementById('productGrid').innerHTML =
      '<p class="text-muted" style="padding:32px">Failed to load menu. Please refresh.</p>';
  }
}

// ----- Render Products -----
function renderProducts(products) {
  const grid = document.getElementById('productGrid');

  if (!products.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <i class="fa-solid fa-mug-saucer"></i><p>No items in this category</p></div>`;
    return;
  }

  const catIcons = {
    'Appetizer':   '🍟',
    'Main Course': '🍽️',
    'Drinks':      '☕',
    'Dessert':     '🍰',
    'Specialty':   '⭐',
  };

  grid.innerHTML = products.map(p => {
    const outOfStock = parseInt(p.quantity) <= 0;
    const imgHTML = p.image
      ? `<img src="${p.image}" class="product-img" alt="${esc(p.name)}" loading="lazy">`
      : `<div class="product-img-placeholder">${catIcons[p.category] || '☕'}</div>`;

    return `
    <div class="product-card${outOfStock ? ' out-of-stock' : ''}" data-id="${p.productID}">
      ${imgHTML}
      <div class="product-info">
        <div class="product-name">${esc(p.name)}</div>
        <div class="product-category">${p.category}</div>
        <div class="product-price">₱${parseFloat(p.price).toFixed(2)}</div>
        ${outOfStock ? '<span class="out-badge">Out of Stock</span>' : `<span class="product-stock">Stock: ${p.quantity}</span>`}
      </div>
      ${outOfStock ? '' : `<button class="add-to-cart" data-id="${p.productID}">
        <i class="fa-solid fa-plus"></i> Add to Cart
      </button>`}
    </div>`;
  }).join('');

  // Attach add-to-cart listeners
  grid.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      addToCart(parseInt(btn.dataset.id));
    });
  });
}

// ----- Category Filter -----
function filterCategory(cat) {
  currentCategory = cat;
  document.getElementById('categoryTitle').textContent = cat === 'All' ? 'All Items' : cat;
  const filtered = cat === 'All' ? allProducts : allProducts.filter(p => p.category === cat);
  renderProducts(filtered);
}

// ----- Cart Logic -----
function addToCart(productID) {
  const product = allProducts.find(p => parseInt(p.productID) === productID);
  if (!product) return;

  const existing = cart.find(c => c.productID === productID);
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ productID, name: product.name, price: parseFloat(product.price), quantity: 1 });
  }

  updateCartUI();
  showToast(`${product.name} added to cart`, 'success');
}

function updateCartQty(productID, delta) {
  const item = cart.find(c => c.productID === productID);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter(c => c.productID !== productID);
  updateCartUI();
}

function removeFromCart(productID) {
  cart = cart.filter(c => c.productID !== productID);
  updateCartUI();
}

function getCartTotal() {
  return cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
}

function getCartCount() {
  return cart.reduce((sum, c) => sum + c.quantity, 0);
}

function updateCartUI() {
  const count   = getCartCount();
  const total   = getCartTotal();
  const countEl = document.getElementById('cartCount');
  const totalEl = document.getElementById('cartTotalEl');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const itemsEl = document.getElementById('cartItemsEl');

  countEl.textContent = count;
  totalEl.textContent = `₱${total.toFixed(2)}`;
  checkoutBtn.disabled = cart.length === 0;

  if (cart.length === 0) {
    itemsEl.innerHTML = `<div class="cart-empty"><i class="fa-solid fa-mug-hot"></i><p>Your cart is empty</p></div>`;
    return;
  }

  itemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div style="flex:1">
        <div class="cart-item-name">${esc(item.name)}</div>
        <div class="text-muted" style="font-size:.75rem">₱${item.price.toFixed(2)} each</div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" onclick="updateCartQty(${item.productID}, -1)">−</button>
        <span class="qty-val">${item.quantity}</span>
        <button class="qty-btn" onclick="updateCartQty(${item.productID}, 1)">+</button>
      </div>
      <div class="cart-item-price">₱${(item.price * item.quantity).toFixed(2)}</div>
      <button class="qty-remove" onclick="removeFromCart(${item.productID})" title="Remove">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`).join('');
}

// ----- Cart Sidebar Open/Close -----
function openCart() {
  document.getElementById('cartSidebar').classList.add('open');
  document.getElementById('cartOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cartSidebar').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ----- Checkout Modal -----
function openCheckout() {
  const summaryList = document.getElementById('summaryList');
  summaryList.innerHTML = cart.map(item => `
    <li>
      <span>${esc(item.name)} × ${item.quantity}</span>
      <span>₱${(item.price * item.quantity).toFixed(2)}</span>
    </li>`).join('');
  document.getElementById('summaryTotal').textContent = `₱${getCartTotal().toFixed(2)}`;
  document.getElementById('checkoutModal').classList.add('active');
  closeCart();
}

// ----- Place Order -----
async function placeOrder() {
  const nameInput = document.getElementById('customerName');
  const name = nameInput.value.trim() || 'Customer';
  const btn  = document.getElementById('placeOrderBtn');

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';

  try {
    const res = await fetch('api/orders.php?action=place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: name,
        items: cart.map(c => ({ productID: c.productID, quantity: c.quantity })),
      }),
    });

    const data = await res.json();

    if (data.success) {
      document.getElementById('checkoutModal').classList.remove('active');
      document.getElementById('confirmOrderId').textContent = `Order #${data.orderID}`;
      document.getElementById('confirmationScreen').classList.add('active');
      cart = [];
      updateCartUI();
    } else {
      showToast(data.error || 'Failed to place order', 'error');
    }
  } catch {
    showToast('Network error – please try again', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Place Order';
  }
}

// ----- Bind Events -----
function bindEvents() {
  // Category tabs
  document.getElementById('categoryBar').addEventListener('click', e => {
    const btn = e.target.closest('.cat-tab');
    if (!btn) return;
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    filterCategory(btn.dataset.cat);
  });

  document.getElementById('openCartBtn').addEventListener('click', openCart);
  document.getElementById('closeCartBtn').addEventListener('click', closeCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);
  document.getElementById('checkoutBtn').addEventListener('click', openCheckout);
  document.getElementById('closeCheckoutBtn').addEventListener('click', () => {
    document.getElementById('checkoutModal').classList.remove('active');
    openCart();
  });
  document.getElementById('backToCartBtn').addEventListener('click', () => {
    document.getElementById('checkoutModal').classList.remove('active');
    openCart();
  });
  document.getElementById('placeOrderBtn').addEventListener('click', placeOrder);
  document.getElementById('newOrderBtn').addEventListener('click', () => {
    document.getElementById('confirmationScreen').classList.remove('active');
    document.getElementById('customerName').value = '';
    loadProducts();
  });
}

// ----- Utility -----
function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

let toastTimer;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.className = '', 2800);
}
