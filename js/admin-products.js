/* =============================================
   Roots – Admin Products JS
   ============================================= */

const ADMIN_API = '../api';
let allProducts = [];

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth('admin');
  loadProducts();

  // URL input → preview
  document.getElementById('pImage').addEventListener('input', () => {
    setImagePreview(document.getElementById('pImage').value.trim());
  });

  // Click drop zone → open file picker
  document.getElementById('imgDropZone').addEventListener('click', () => {
    document.getElementById('imgFilePicker').click();
  });

  // File selected
  document.getElementById('imgFilePicker').addEventListener('change', e => {
    if (e.target.files[0]) uploadImageFile(e.target.files[0]);
  });

  // Drag & drop
  const zone = document.getElementById('imgDropZone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--brown-dark)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = 'var(--border)'; });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.style.borderColor = 'var(--border)';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) uploadImageFile(file);
    else showToast('Please drop an image file', 'error');
  });

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

async function loadProducts() {
  try {
    const data = await fetch(`${ADMIN_API}/products.php?action=list`).then(r => r.json());
    allProducts = data;
    renderProducts(allProducts);
  } catch {
    document.getElementById('productsBody').innerHTML =
      `<tr><td colspan="7" class="text-center text-muted">Failed to load</td></tr>`;
  }
}

function filterProducts() {
  const search = document.getElementById('searchProd').value.toLowerCase();
  const cat    = document.getElementById('filterCat').value;
  const avail  = document.getElementById('filterAvail').value;

  let filtered = allProducts.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search);
    const matchCat    = !cat   || p.category === cat;
    const matchAvail  = avail === '' || String(p.is_available) === avail;
    return matchSearch && matchCat && matchAvail;
  });
  renderProducts(filtered);
}

function renderProducts(products) {
  const tbody = document.getElementById('productsBody');
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:40px">No products found</td></tr>`;
    return;
  }
  const catIcons = { 'Appetizer':'🍟','Main Course':'🍽️','Drinks':'☕','Dessert':'🍰','Specialty':'⭐' };

  tbody.innerHTML = products.map(p => {
    const imgSrc  = p.image
      ? ((p.image.startsWith('http') || p.image.startsWith('/') || p.image.startsWith('../'))
          ? p.image : '../' + p.image)
      : null;
    const imgHtml = imgSrc
      ? `<img src="${esc(imgSrc)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px" onerror="this.style.display='none'">`
      : `<span style="font-size:1.8rem">${catIcons[p.category]||'☕'}</span>`;

    const stockClass = p.quantity <= 0 ? 'color:var(--danger)' : p.quantity <= 10 ? 'color:var(--warning)' : 'color:var(--success)';

    return `<tr>
      <td>${imgHtml}</td>
      <td><strong>${esc(p.name)}</strong></td>
      <td><span class="badge" style="background:var(--cream);color:var(--brown-dark)">${p.category}</span></td>
      <td>₱${parseFloat(p.price).toFixed(2)}</td>
      <td><span style="${stockClass};font-weight:600">${p.quantity}</span></td>
      <td>
        <span class="badge ${p.is_available=='1'?'badge-completed':'badge-cancelled'}">
          ${p.is_available=='1'?'Yes':'No'}
        </span>
      </td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="openEditModal(${p.productID})">
          <i class="fa-solid fa-pencil"></i>
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.productID},'${esc(p.name)}')" style="margin-left:4px">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function openAddModal() {
  document.getElementById('modalTitle').textContent = 'Add Product';
  document.getElementById('editID').value   = '';
  document.getElementById('pName').value    = '';
  document.getElementById('pCat').value     = '';
  document.getElementById('pPrice').value   = '';
  document.getElementById('pQty').value     = '0';
  document.getElementById('pImage').value   = '';
  document.getElementById('pAvail').checked = true;
  document.getElementById('imgFilePicker').value = '';
  resetImgPreview();
  document.getElementById('productModal').classList.add('active');
}

async function openEditModal(id) {
  try {
    const p = await fetch(`${ADMIN_API}/products.php?action=get&id=${id}`).then(r => r.json());
    document.getElementById('modalTitle').textContent = 'Edit Product';
    document.getElementById('editID').value   = p.productID;
    document.getElementById('pName').value    = p.name;
    document.getElementById('pCat').value     = p.category;
    document.getElementById('pPrice').value   = p.price;
    document.getElementById('pQty').value     = p.quantity;
    document.getElementById('pImage').value   = p.image || '';
    document.getElementById('pAvail').checked = p.is_available == 1;
    document.getElementById('imgFilePicker').value = '';
    setImagePreview(p.image || '');
    document.getElementById('productModal').classList.add('active');
  } catch { showToast('Failed to load product', 'error'); }
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('active');
}

async function saveProduct() {
  const id    = document.getElementById('editID').value;
  const name  = document.getElementById('pName').value.trim();
  const cat   = document.getElementById('pCat').value;
  const price = parseFloat(document.getElementById('pPrice').value);
  const qty   = parseInt(document.getElementById('pQty').value);
  const image = document.getElementById('pImage').value.trim();
  const avail = document.getElementById('pAvail').checked ? 1 : 0;

  if (!name) {
    showToast('Product name is required', 'error'); return;
  }
  if (name.length > 100) {
    showToast('Product name is too long (max 100 characters)', 'error'); return;
  }
  if (!cat) {
    showToast('Please select a category', 'error'); return;
  }
  if (isNaN(price) || price <= 0) {
    showToast('Price must be greater than ₱0', 'error'); return;
  }
  if (price > 99999) {
    showToast('Price is too high (max ₱99,999)', 'error'); return;
  }
  if (isNaN(qty) || qty < 0) {
    showToast('Quantity cannot be negative', 'error'); return;
  }
  if (!Number.isInteger(qty)) {
    showToast('Quantity must be a whole number', 'error'); return;
  }
  if (qty > 9999) {
    showToast('Quantity is too high (max 9,999)', 'error'); return;
  }

  const payload = { name, category: cat, price, quantity: qty, image, is_available: avail };
  if (id) payload.productID = parseInt(id);

  const action = id ? 'update' : 'add';

  const doSave = async () => {
    const btn = document.getElementById('saveProductBtn');
    btn.disabled = true;
    try {
      const res  = await fetch(`${ADMIN_API}/products.php?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast(id ? 'Product updated!' : 'Product added!', 'success');
        closeProductModal();
        loadProducts();
      } else {
        showToast(data.error || 'Save failed', 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { btn.disabled = false; }
  };

  if (id) {
    showConfirm({
      title: 'Save Changes',
      message: `Update "${name}"? Your changes will be saved.`,
      confirmLabel: 'Save',
      type: 'save',
      onConfirm: doSave,
    });
  } else {
    doSave();
  }
}

async function deleteProduct(id, name) {
  showConfirm({
    title: 'Delete Product',
    message: `Delete "${name}"? This cannot be undone.`,
    confirmLabel: 'Delete',
    type: 'danger',
    onConfirm: async () => {
      try {
        const res  = await fetch(`${ADMIN_API}/products.php?action=delete&id=${id}`);
        const data = await res.json();
        if (data.success) { showToast('Product deleted', 'success'); loadProducts(); }
        else showToast(data.error || 'Delete failed', 'error');
      } catch { showToast('Network error', 'error'); }
    },
  });
}

async function uploadImageFile(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowed.includes(file.type)) { showToast('Invalid file type', 'error'); return; }
  if (file.size > 5 * 1024 * 1024)  { showToast('File too large (max 5 MB)', 'error'); return; }

  // Show uploading state
  document.getElementById('imgUploadingBadge').style.display = 'flex';
  document.getElementById('imgRemoveBtn').style.display = 'none';

  const form = new FormData();
  form.append('image', file);

  try {
    const res  = await fetch(`${ADMIN_API}/products.php?action=upload_image`, { method: 'POST', body: form });
    const data = await res.json();
    if (data.success) {
      document.getElementById('pImage').value = data.path;
      setImagePreview(data.path);
      showToast('Image uploaded!', 'success');
    } else {
      showToast(data.error || 'Upload failed', 'error');
    }
  } catch { showToast('Upload failed – network error', 'error'); }
  finally  { document.getElementById('imgUploadingBadge').style.display = 'none'; }
}

function setImagePreview(src) {
  const preview     = document.getElementById('imgPreviewEl');
  const placeholder = document.getElementById('imgPlaceholder');
  const removeBtn   = document.getElementById('imgRemoveBtn');

  if (src) {
    // Relative paths (uploads) need ../ prefix since we're inside /admin/
    const displaySrc = (src.startsWith('http') || src.startsWith('/') || src.startsWith('../'))
      ? src
      : '../' + src;

    preview.src               = displaySrc;
    preview.style.display     = 'block';
    placeholder.style.display = 'none';
    removeBtn.style.display   = 'flex';
    preview.onerror = () => {
      resetImgPreview();
      showToast('Could not load image from URL', 'error');
    };
  } else {
    resetImgPreview();
  }
}

function resetImgPreview() {
  document.getElementById('imgPreviewEl').style.display   = 'none';
  document.getElementById('imgPlaceholder').style.display = 'block';
  document.getElementById('imgRemoveBtn').style.display   = 'none';
}

function removeImage(e) {
  e.stopPropagation();
  document.getElementById('pImage').value = '';
  document.getElementById('imgFilePicker').value = '';
  resetImgPreview();
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
