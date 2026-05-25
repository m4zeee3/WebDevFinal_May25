const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const url    = require('url');
const mysql  = require('mysql2/promise');

const PORT = 8000;
const ROOT = __dirname;

// ── Session store (in-memory) ──────────────────────────────────────────────
const sessions = new Map();

function getSessionId(req) {
  const match = (req.headers.cookie || '').match(/sess_id=([^;]+)/);
  return match ? match[1] : null;
}
function getSession(req) {
  const id = getSessionId(req);
  return id ? (sessions.get(id) || {}) : {};
}
function createSession(res, data) {
  const id = crypto.randomBytes(16).toString('hex');
  sessions.set(id, data);
  res.setHeader('Set-Cookie', `sess_id=${id}; HttpOnly; Path=/`);
}
function destroySession(req) {
  const id = getSessionId(req);
  if (id) sessions.delete(id);
}

// ── MySQL connection pool ──────────────────────────────────────────────────
const pool = mysql.createPool({
  host:             'localhost',
  user:             'root',
  password:         '12345678',
  database:         'roots_coffee',
  waitForConnections: true,
  connectionLimit:  10,
});

// ── MIME types ─────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function getBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { resolve({}); }
    });
  });
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function requireAuth(session, res) {
  if (!session.emp_id) {
    json(res, { error: 'Unauthorized – please log in' }, 401);
    return false;
  }
  return true;
}

function requireAdmin(session, res) {
  if (!session.emp_id) {
    json(res, { error: 'Unauthorized – please log in' }, 401);
    return false;
  }
  if (session.role !== 'admin') {
    json(res, { error: 'Admin access required' }, 403);
    return false;
  }
  return true;
}

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ── Auth ───────────────────────────────────────────────────────────────────
async function handleAuth(req, res, action, session) {
  if (action === 'login') {
    const d = await getBody(req);
    const username = (d.username || '').trim();
    const password = (d.password || '').trim();

    if (!username || !password)
      return json(res, { success: false, message: 'Username and password are required' });

    const [rows] = await pool.execute(
      'SELECT * FROM employees WHERE username = ?', [username]
    );
    const emp = rows[0];

    if (emp && sha256(password) === emp.password) {
      createSession(res, { emp_id: emp.EmployeeID, emp_name: emp.name, role: emp.role });
      return json(res, { success: true, role: emp.role, name: emp.name });
    }
    return json(res, { success: false, message: 'Invalid username or password' });
  }

  if (action === 'logout') {
    destroySession(req);
    return json(res, { success: true });
  }

  if (action === 'check') {
    if (session.emp_id)
      return json(res, { logged_in: true, role: session.role, name: session.emp_name, id: session.emp_id });
    return json(res, { logged_in: false });
  }

  json(res, { error: 'Unknown action' });
}

// ── Products ───────────────────────────────────────────────────────────────
async function handleProducts(req, res, action, session, q) {
  if (action === 'list') {
    let sql = 'SELECT * FROM products';
    const params = [];
    const where  = [];
    if (q.category)  { where.push('category = ?');     params.push(q.category); }
    if (q.available !== undefined && q.available !== '') {
      where.push('is_available = ?');
      params.push(parseInt(q.available));
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY category, name';
    const [rows] = await pool.execute(sql, params);
    return json(res, rows);
  }

  if (action === 'get') {
    const [rows] = await pool.execute(
      'SELECT * FROM products WHERE productID = ?', [parseInt(q.id || 0)]
    );
    return json(res, rows[0] || { error: 'Not found' });
  }

  if (action === 'add') {
    if (!requireAdmin(session, res)) return;
    const d = await getBody(req);
    const [r] = await pool.execute(
      'INSERT INTO products (name, category, price, quantity, image, is_available) VALUES (?, ?, ?, ?, ?, ?)',
      [d.name.trim(), d.category, parseFloat(d.price), parseInt(d.quantity || 0), (d.image || '').trim(), parseInt(d.is_available ?? 1)]
    );
    return json(res, { success: true, id: r.insertId });
  }

  if (action === 'update') {
    if (!requireAdmin(session, res)) return;
    const d = await getBody(req);
    await pool.execute(
      'UPDATE products SET name=?, category=?, price=?, quantity=?, image=?, is_available=? WHERE productID=?',
      [d.name.trim(), d.category, parseFloat(d.price), parseInt(d.quantity), (d.image || '').trim(), parseInt(d.is_available ?? 1), parseInt(d.productID)]
    );
    return json(res, { success: true });
  }

  if (action === 'delete') {
    if (!requireAdmin(session, res)) return;
    await pool.execute('DELETE FROM products WHERE productID = ?', [parseInt(q.id || 0)]);
    return json(res, { success: true });
  }

  if (action === 'upload_image') {
    if (!requireAdmin(session, res)) return;
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) return json(res, { error: 'No boundary found' });
    const boundary = boundaryMatch[1];

    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      const headerEnd = buf.indexOf('\r\n\r\n');
      const headers   = buf.slice(0, headerEnd).toString();
      const fnMatch   = headers.match(/filename="([^"]+)"/);
      if (!fnMatch) return json(res, { error: 'No file uploaded' });

      const ext     = path.extname(fnMatch[1]).toLowerCase().slice(1);
      const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      if (!allowed.includes(ext)) return json(res, { error: 'Invalid file type' });

      const fileStart = headerEnd + 4;
      const fileEnd   = buf.indexOf('\r\n--' + boundary, fileStart);
      const fileData  = buf.slice(fileStart, fileEnd < 0 ? undefined : fileEnd);
      if (fileData.length > 5 * 1024 * 1024) return json(res, { error: 'File too large (max 5 MB)' });

      const filename  = 'prod_' + Date.now() + '.' + ext;
      const uploadDir = path.join(ROOT, 'images', 'uploads');
      fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFile(path.join(uploadDir, filename), fileData, err => {
        if (err) return json(res, { error: 'Upload failed' });
        json(res, { success: true, path: 'images/uploads/' + filename });
      });
    });
    return;
  }

  json(res, { error: 'Unknown action' });
}

// ── Orders ─────────────────────────────────────────────────────────────────
async function handleOrders(req, res, action, session, q) {
  if (action === 'place') {
    const d     = await getBody(req);
    const items = d.items || [];
    if (!items.length) return json(res, { error: 'Cart is empty' });

    const empID        = session.emp_id || null;
    const rawName      = (d.customer_name || 'Customer').trim().replace(/[<>"']/g, '');
    const tableNum     = d.table_number ? parseInt(d.table_number) : null;
    const customerName = tableNum ? `[Table ${tableNum}] ${rawName}` : rawName;
    // Table orders are always online (QR-based) even if a staff session exists
    const orderType    = tableNum ? 'online' : (empID ? 'walk-in' : 'online');
    let   total        = 0;
    const orderItems   = [];

    for (const item of items) {
      const [rows] = await pool.execute(
        'SELECT * FROM products WHERE productID = ? AND is_available = 1 AND quantity > 0',
        [parseInt(item.productID)]
      );
      const product = rows[0];
      if (!product) continue;
      const qty   = Math.max(1, parseInt(item.quantity));
      const price = parseFloat(product.price);
      total += price * qty;
      orderItems.push({ productID: product.productID, quantity: qty, price });
    }

    if (!orderItems.length) return json(res, { error: 'No valid items in cart' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.execute(
        "INSERT INTO orders (EmployeeID, customer_name, order_type, totalAmount, status) VALUES (?, ?, ?, ?, 'pending')",
        [empID, customerName, orderType, total]
      );
      const orderID = r.insertId;
      for (const oi of orderItems) {
        await conn.execute(
          'INSERT INTO order_items (orderID, productID, quantity, price) VALUES (?, ?, ?, ?)',
          [orderID, oi.productID, oi.quantity, oi.price]
        );
        await conn.execute(
          'UPDATE products SET quantity = quantity - ? WHERE productID = ?',
          [oi.quantity, oi.productID]
        );
      }
      await conn.commit();
      return json(res, { success: true, orderID, total });
    } catch (e) {
      await conn.rollback();
      return json(res, { error: 'Order failed: ' + e.message });
    } finally {
      conn.release();
    }
  }

  if (action === 'list') {
    if (!requireAuth(session, res)) return;
    const limit  = Math.min(parseInt(q.limit  || 50), 200);
    const offset = parseInt(q.offset || 0);
    let   sql    = 'SELECT o.*, e.name AS employee_name FROM orders o LEFT JOIN employees e ON o.EmployeeID = e.EmployeeID';
    const params = [];
    const where  = [];

    if (q.status)    { where.push('o.status = ?');                    params.push(q.status); }
    if (q.date_from) { where.push('DATE(o.orderDateTime) >= ?');      params.push(q.date_from); }
    if (q.date_to)   { where.push('DATE(o.orderDateTime) <= ?');      params.push(q.date_to); }
    if (q.search)    {
      where.push('(o.orderID LIKE ? OR o.customer_name LIKE ?)');
      params.push('%' + q.search + '%', '%' + q.search + '%');
    }

    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ` ORDER BY o.orderDateTime DESC LIMIT ${limit} OFFSET ${offset}`;

    const [rows] = await pool.execute(sql, params);
    return json(res, rows);
  }

  if (action === 'get') {
    if (!requireAuth(session, res)) return;
    const id = parseInt(q.id || 0);
    const [orders] = await pool.execute(
      'SELECT o.*, e.name AS employee_name FROM orders o LEFT JOIN employees e ON o.EmployeeID = e.EmployeeID WHERE o.orderID = ?',
      [id]
    );
    if (!orders[0]) return json(res, { error: 'Order not found' });
    const order = orders[0];
    const [items] = await pool.execute(
      'SELECT oi.*, p.name AS product_name, p.category FROM order_items oi JOIN products p ON oi.productID = p.productID WHERE oi.orderID = ?',
      [id]
    );
    order.items = items;
    return json(res, order);
  }

  if (action === 'update_status') {
    if (!requireAuth(session, res)) return;
    const d = await getBody(req);

    // Walk-in orders have payment collected at checkout already.
    // Auto-complete them when kitchen marks them ready.
    let finalStatus = d.status;
    if (d.status === 'ready') {
      const [rows] = await pool.execute(
        'SELECT order_type FROM orders WHERE orderID = ?', [parseInt(d.orderID)]
      );
      if (rows[0] && rows[0].order_type === 'walk-in') finalStatus = 'completed';
    }

    await pool.execute(
      'UPDATE orders SET status = ? WHERE orderID = ?',
      [finalStatus, parseInt(d.orderID)]
    );
    return json(res, { success: true, status: finalStatus });
  }

  if (action === 'kitchen') {
    const [orders] = await pool.execute(
      "SELECT o.orderID, o.customer_name, o.order_type, o.orderDateTime, o.status FROM orders o WHERE o.status IN ('pending','preparing') ORDER BY o.orderDateTime ASC"
    );
    for (const order of orders) {
      const [items] = await pool.execute(
        'SELECT oi.quantity, p.name AS product_name FROM order_items oi JOIN products p ON oi.productID = p.productID WHERE oi.orderID = ?',
        [order.orderID]
      );
      order.items = items;
    }
    return json(res, orders);
  }

  json(res, { error: 'Unknown action' });
}

// ── Dashboard ──────────────────────────────────────────────────────────────
async function handleDashboard(req, res, action, session, q) {
  if (!requireAdmin(session, res)) return;

  if (action === 'stats') {
    const today = new Date().toISOString().slice(0, 10);
    const [[r1]] = await pool.execute("SELECT COUNT(*) AS c FROM orders WHERE DATE(orderDateTime)=? AND status!='cancelled'", [today]);
    const [[r2]] = await pool.execute("SELECT COALESCE(SUM(totalAmount),0) AS s FROM orders WHERE DATE(orderDateTime)=? AND status='completed'", [today]);
    const [[r3]] = await pool.execute("SELECT COALESCE(SUM(totalAmount),0) AS s FROM orders WHERE status='completed'");
    const [[r4]] = await pool.execute("SELECT COUNT(*) AS c FROM orders WHERE status='pending'");
    const [[r5]] = await pool.execute("SELECT COUNT(*) AS c FROM products WHERE is_available=1");
    const [statusCounts] = await pool.execute('SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status');
    return json(res, {
      today_orders:   parseInt(r1.c),
      today_sales:    parseFloat(r2.s),
      total_sales:    parseFloat(r3.s),
      pending_orders: parseInt(r4.c),
      product_count:  parseInt(r5.c),
      status_counts:  statusCounts,
    });
  }

  if (action === 'recent_orders') {
    const [rows] = await pool.execute(
      'SELECT o.orderID, o.customer_name, o.totalAmount, o.status, o.orderDateTime, o.order_type, e.name AS employee_name FROM orders o LEFT JOIN employees e ON o.EmployeeID = e.EmployeeID ORDER BY o.orderDateTime DESC LIMIT 10'
    );
    return json(res, rows);
  }

  if (action === 'sales_chart') {
    const days = parseInt(q.days || 7);
    const [rows] = await pool.execute(
      "SELECT DATE(orderDateTime) AS date, COALESCE(SUM(totalAmount),0) AS total FROM orders WHERE DATE(orderDateTime) >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND status='completed' GROUP BY DATE(orderDateTime) ORDER BY date ASC",
      [days]
    );
    return json(res, rows);
  }

  if (action === 'top_products') {
    const [rows] = await pool.execute(
      "SELECT p.name, SUM(oi.quantity) AS total_sold, SUM(oi.quantity * oi.price) AS revenue FROM order_items oi JOIN products p ON oi.productID = p.productID JOIN orders o ON oi.orderID = o.orderID WHERE o.status='completed' GROUP BY oi.productID ORDER BY total_sold DESC LIMIT 8"
    );
    return json(res, rows);
  }

  if (action === 'order_status_pie') {
    const [rows] = await pool.execute('SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status');
    return json(res, rows);
  }

  json(res, { error: 'Unknown action' });
}

// ── Inventory ──────────────────────────────────────────────────────────────
async function handleInventory(req, res, action, session, q) {
  if (!requireAdmin(session, res)) return;

  if (action === 'list') {
    const lowOnly = q.low_stock === '1';
    const [rows] = lowOnly
      ? await pool.execute('SELECT * FROM products WHERE quantity <= 10 ORDER BY quantity ASC')
      : await pool.execute('SELECT * FROM products ORDER BY category, name');
    return json(res, rows);
  }

  if (action === 'summary') {
    const [[row]] = await pool.execute(
      "SELECT COUNT(*) AS total_products, SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) AS out_of_stock, SUM(CASE WHEN quantity > 0 AND quantity <= 10 THEN 1 ELSE 0 END) AS low_stock, SUM(CASE WHEN quantity > 10 THEN 1 ELSE 0 END) AS in_stock FROM products"
    );
    return json(res, row);
  }

  if (action === 'update_stock') {
    const d = await getBody(req);
    await pool.execute(
      'UPDATE products SET quantity = ? WHERE productID = ?',
      [parseInt(d.quantity), parseInt(d.productID)]
    );
    return json(res, { success: true });
  }

  json(res, { error: 'Unknown action' });
}

// ── Reports ────────────────────────────────────────────────────────────────
async function handleReports(req, res, action, session, q) {
  if (!requireAdmin(session, res)) return;

  const now      = new Date();
  const dateFrom = q.date_from || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const dateTo   = q.date_to   || now.toISOString().slice(0, 10);

  if (action === 'sales') {
    const period = q.period || 'daily';
    let groupBy, label;
    if (period === 'weekly') {
      groupBy = 'YEARWEEK(orderDateTime,1)';
      label   = "CONCAT(YEAR(orderDateTime),'-W',LPAD(WEEK(orderDateTime,1),2,'0'))";
    } else if (period === 'monthly') {
      groupBy = "DATE_FORMAT(orderDateTime,'%Y-%m')";
      label   = "DATE_FORMAT(orderDateTime,'%Y-%m')";
    } else {
      groupBy = 'DATE(orderDateTime)';
      label   = 'DATE(orderDateTime)';
    }
    const [rows] = await pool.execute(
      `SELECT ${label} AS period, COUNT(*) AS order_count, COALESCE(SUM(totalAmount),0) AS revenue FROM orders WHERE DATE(orderDateTime) BETWEEN ? AND ? AND status='completed' GROUP BY ${groupBy} ORDER BY period ASC`,
      [dateFrom, dateTo]
    );
    return json(res, rows);
  }

  if (action === 'product_ranking') {
    const [rows] = await pool.execute(
      "SELECT p.name, p.category, SUM(oi.quantity) AS total_sold, COALESCE(SUM(oi.quantity * oi.price),0) AS revenue FROM order_items oi JOIN products p ON oi.productID = p.productID JOIN orders o ON oi.orderID = o.orderID WHERE DATE(o.orderDateTime) BETWEEN ? AND ? AND o.status='completed' GROUP BY oi.productID ORDER BY total_sold DESC",
      [dateFrom, dateTo]
    );
    return json(res, rows);
  }

  if (action === 'category_performance') {
    const [rows] = await pool.execute(
      "SELECT p.category, COUNT(DISTINCT o.orderID) AS order_count, SUM(oi.quantity) AS total_sold, COALESCE(SUM(oi.quantity * oi.price),0) AS revenue FROM order_items oi JOIN products p ON oi.productID = p.productID JOIN orders o ON oi.orderID = o.orderID WHERE DATE(o.orderDateTime) BETWEEN ? AND ? AND o.status='completed' GROUP BY p.category ORDER BY revenue DESC",
      [dateFrom, dateTo]
    );
    return json(res, rows);
  }

  if (action === 'export_csv') {
    const [rows] = await pool.execute(
      "SELECT o.orderID AS `Order ID`, o.customer_name AS Customer, o.order_type AS Type, o.totalAmount AS `Total`, o.status AS Status, o.orderDateTime AS `Date & Time`, COALESCE(e.name,'—') AS Employee FROM orders o LEFT JOIN employees e ON o.EmployeeID = e.EmployeeID WHERE DATE(o.orderDateTime) BETWEEN ? AND ? ORDER BY o.orderDateTime DESC",
      [dateFrom, dateTo]
    );
    const headers = rows.length ? Object.keys(rows[0]) : ['Order ID', 'Customer', 'Type', 'Total', 'Status', 'Date & Time', 'Employee'];
    let csv = headers.join(',') + '\n';
    for (const row of rows)
      csv += Object.values(row).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',') + '\n';

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sales_${dateFrom}_to_${dateTo}.csv"`,
    });
    return res.end(csv);
  }

  json(res, { error: 'Unknown action' });
}

// ── Main server ────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const q        = parsed.query;

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const session = getSession(req);

  try {
    if (pathname === '/api/auth.php')      return await handleAuth(req, res, q.action || '', session);
    if (pathname === '/api/products.php')  return await handleProducts(req, res, q.action || 'list', session, q);
    if (pathname === '/api/orders.php')    return await handleOrders(req, res, q.action || 'list', session, q);
    if (pathname === '/api/dashboard.php') return await handleDashboard(req, res, q.action || 'stats', session, q);
    if (pathname === '/api/inventory.php') return await handleInventory(req, res, q.action || 'list', session, q);
    if (pathname === '/api/reports.php')   return await handleReports(req, res, q.action || 'sales', session, q);

    // Static files
    let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory())
      filePath = path.join(filePath, 'index.html');

    serveStatic(res, filePath);
  } catch (err) {
    console.error(err);
    json(res, { error: 'Server error: ' + err.message }, 500);
  }
});

server.listen(PORT, () => {
  console.log('✓ Roots Coffee & Craft running at http://localhost:' + PORT);
  console.log('  Admin login  → http://localhost:' + PORT + '/admin/login.html');
  console.log('  Kitchen      → http://localhost:' + PORT + '/kitchen/index.html');
  console.log('  Cashier/POS  → http://localhost:' + PORT + '/cashier/index.html');
});
