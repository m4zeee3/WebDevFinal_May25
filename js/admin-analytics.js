/* =============================================
   Roots – Admin Analytics JS
   ============================================= */

const ADMIN_API = '../api';
let trendInst, topBarInst, statusPieInst, catInst;

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth('admin');
  loadAnalytics();

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

async function loadAnalytics() {
  const days    = document.getElementById('analyticsDays').value;
  const today   = new Date();
  const from    = new Date(today);
  from.setDate(today.getDate() - parseInt(days));
  const dateFrom = from.toISOString().split('T')[0];
  const dateTo   = today.toISOString().split('T')[0];

  try {
    const [salesData, topData, statusData, catData] = await Promise.all([
      fetch(`${ADMIN_API}/dashboard.php?action=sales_chart&days=${days}`).then(r => r.json()),
      fetch(`${ADMIN_API}/dashboard.php?action=top_products`).then(r => r.json()),
      fetch(`${ADMIN_API}/dashboard.php?action=order_status_pie`).then(r => r.json()),
      fetch(`${ADMIN_API}/reports.php?action=category_performance&date_from=${dateFrom}&date_to=${dateTo}`).then(r => r.json()),
    ]);

    renderTrend(salesData);
    renderTopBar(topData);
    renderStatusPie(statusData);
    renderCategoryChart(catData);
  } catch { showToast('Failed to load analytics', 'error'); }
}

const COLORS = ['#8E3200','#A64B2A','#D7A86E','#c0392b','#e67e22','#f39c12','#27ae60','#2980b9','#8e44ad','#16a085'];

function renderTrend(data) {
  const ctx = document.getElementById('trendChart').getContext('2d');
  if (trendInst) trendInst.destroy();
  trendInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date),
      datasets: [{
        label: 'Daily Revenue (₱)',
        data:  data.map(d => parseFloat(d.total)),
        borderColor: '#8E3200',
        backgroundColor: 'rgba(142,50,0,.07)',
        tension: .4, fill: true,
        pointBackgroundColor: '#8E3200', pointRadius: 5,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => `₱${v.toLocaleString()}` } },
      },
    },
  });
}

function renderTopBar(data) {
  const ctx = document.getElementById('topBarChart').getContext('2d');
  if (topBarInst) topBarInst.destroy();
  topBarInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.name),
      datasets: [{
        label: 'Units Sold',
        data:  data.map(d => parseInt(d.total_sold)),
        backgroundColor: COLORS,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } },
    },
  });
}

function renderStatusPie(data) {
  const colorMap = {
    pending: '#ffc107', preparing: '#0dcaf0',
    ready: '#28a745', completed: '#218838', cancelled: '#dc3545',
  };
  const ctx = document.getElementById('statusPieChart').getContext('2d');
  if (statusPieInst) statusPieInst.destroy();
  statusPieInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.status),
      datasets: [{
        data:            data.map(d => parseInt(d.cnt)),
        backgroundColor: data.map(d => colorMap[d.status] || '#999'),
        borderWidth: 2,
      }],
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
  });
}

function renderCategoryChart(data) {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  if (catInst) catInst.destroy();
  catInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.category),
      datasets: [{
        label: 'Revenue (₱)',
        data:  data.map(d => parseFloat(d.revenue)),
        backgroundColor: COLORS,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => `₱${v.toLocaleString()}` } } },
    },
  });
}

async function logout() {
  await fetch(`${ADMIN_API}/auth.php?action=logout`, { method: 'POST' });
  window.location.href = 'login.html';
}

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}
