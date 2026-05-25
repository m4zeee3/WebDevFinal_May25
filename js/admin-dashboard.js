/* =============================================
   Roots – Admin Dashboard JS
   ============================================= */

const ADMIN_API = '../api';
let salesChartInst, topChartInst, statusChartInst;

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth('admin');
  initTopbar();
  loadDashboard();
  setInterval(loadDashboard, 30000); // auto-refresh every 30 s
});

// ----- Auth Guard -----
async function checkAuth(requiredRole = null) {
  try {
    const res  = await fetch(`${ADMIN_API}/auth.php?action=check`);
    const data = await res.json();
    if (!data.logged_in) { window.location.href = 'login.html'; return; }
    if (requiredRole && data.role !== requiredRole) { window.location.href = 'login.html'; return; }
    document.getElementById('userName').textContent  = data.name;
    document.getElementById('userRole').textContent  = data.role.toUpperCase();
  } catch { window.location.href = 'login.html'; }
}

function initTopbar() {
  const el = document.getElementById('topbarDate');
  if (el) el.textContent = new Date().toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ----- Dashboard Data -----
async function loadDashboard() {
  try {
    const [stats, recent, salesData, topData] = await Promise.all([
      fetch(`${ADMIN_API}/dashboard.php?action=stats`).then(r => r.json()),
      fetch(`${ADMIN_API}/dashboard.php?action=recent_orders`).then(r => r.json()),
      fetch(`${ADMIN_API}/dashboard.php?action=sales_chart&days=7`).then(r => r.json()),
      fetch(`${ADMIN_API}/dashboard.php?action=top_products`).then(r => r.json()),
    ]);

    renderStats(stats);
    renderRecentOrders(recent);
    renderSalesChart(salesData);
    renderTopProductsChart(topData);
    renderStatusChart(stats.status_counts);
  } catch (e) {
    console.error(e);
    showToast('Failed to load dashboard data', 'error');
  }
}

function renderStats(s) {
  document.getElementById('statTodayOrders').textContent = s.today_orders;
  document.getElementById('statTodaySales').textContent  = `₱${parseFloat(s.today_sales).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  document.getElementById('statPending').textContent     = s.pending_orders;
  document.getElementById('statProducts').textContent    = s.product_count;
  document.getElementById('statTotalSales').textContent  = `₱${parseFloat(s.total_sales).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('recentBody');
  if (!orders.length) { tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No orders yet</td></tr>`; return; }
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><strong>#${o.orderID}</strong></td>
      <td>${esc(o.customer_name)}</td>
      <td>${o.order_type === 'online' ? '📱 Online' : '🧍 Walk-in'}</td>
      <td>₱${parseFloat(o.totalAmount).toFixed(2)}</td>
      <td><span class="badge badge-${o.status}">${o.status}</span></td>
      <td>${timeAgo(o.orderDateTime)}</td>
    </tr>`).join('');
}

// ----- Charts -----
const chartColors = {
  dark:   '#8E3200', mid: '#A64B2A', light: '#D7A86E', cream: '#FFEBC1',
  green:  '#28a745', blue: '#0dcaf0', yellow: '#ffc107', red: '#dc3545',
};

function renderSalesChart(data) {
  const ctx = document.getElementById('salesChart').getContext('2d');
  const labels = data.map(d => d.date);
  const totals  = data.map(d => parseFloat(d.total));

  if (salesChartInst) salesChartInst.destroy();
  salesChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Sales (₱)',
        data: totals,
        borderColor: chartColors.dark,
        backgroundColor: 'rgba(142,50,0,.08)',
        tension: .4,
        fill: true,
        pointBackgroundColor: chartColors.dark,
        pointRadius: 5,
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

function renderTopProductsChart(data) {
  const ctx = document.getElementById('topProductsChart').getContext('2d');
  if (topChartInst) topChartInst.destroy();
  topChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.name),
      datasets: [{
        label: 'Units Sold',
        data: data.map(d => parseInt(d.total_sold)),
        backgroundColor: [chartColors.dark, chartColors.mid, chartColors.light,
          '#c0392b','#e67e22','#f39c12','#27ae60','#2980b9'],
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

function renderStatusChart(statusCounts) {
  const ctx = document.getElementById('statusChart').getContext('2d');
  const colorMap = {
    pending: chartColors.yellow, preparing: chartColors.blue,
    ready: chartColors.green, completed: '#218838', cancelled: chartColors.red,
  };
  if (statusChartInst) statusChartInst.destroy();
  statusChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: statusCounts.map(s => s.status),
      datasets: [{
        data: statusCounts.map(s => parseInt(s.cnt)),
        backgroundColor: statusCounts.map(s => colorMap[s.status] || '#999'),
        borderWidth: 2,
      }],
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
  });
}

// ----- Logout -----
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

// ----- Helpers -----
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}
