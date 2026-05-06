<?php
/**
 * Roots COFFEE & CRAFT - First-Time Setup Script
 * Open this in your browser ONCE after importing roots_coffee.sql
 * Default credentials created:
 *   Admin   → username: admin    / password: admin123
 *   Cashier → username: cashier  / password: cashier123
 */

$host   = 'localhost';
$dbname = 'roots_coffee';
$user   = 'root';
$pass   = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die('<p style="color:red">DB Error: ' . htmlspecialchars($e->getMessage()) . '</p>');
}

$messages = [];

// --------------------------------------------------
// Insert default employees
// --------------------------------------------------
$employees = [
    ['Admin User',    'admin',   'admin123',   'admin'],
    ['Cashier User',  'cashier', 'cashier123', 'cashier'],
];

$stmt = $pdo->prepare("INSERT IGNORE INTO employees (name, username, password, role) VALUES (?, ?, ?, ?)");
foreach ($employees as [$name, $uname, $plain, $role]) {
    $hash = password_hash($plain, PASSWORD_DEFAULT);
    $stmt->execute([$name, $uname, $hash, $role]);
    $messages[] = "Employee <strong>$uname</strong> ($role) → password: <code>$plain</code>";
}

// --------------------------------------------------
// Insert sample products
// --------------------------------------------------
$products = [
    // Appetizers
    ['Nachos',          'Appetizer',   120.00, 50],
    ['Chicken Wings',   'Appetizer',   180.00, 30],
    ['Bruschetta',      'Appetizer',    95.00, 25],
    ['Calamari Rings',  'Appetizer',   145.00, 20],

    // Main Course
    ['Grilled Chicken', 'Main Course', 280.00, 20],
    ['Beef Burger',     'Main Course', 250.00, 25],
    ['Pasta Carbonara', 'Main Course', 220.00, 30],
    ['Club Sandwich',   'Main Course', 195.00, 25],

    // Drinks
    ['Americano',       'Drinks',       90.00, 100],
    ['Cappuccino',      'Drinks',      110.00, 100],
    ['Cold Brew',       'Drinks',      120.00,  80],
    ['Lemon Iced Tea',  'Drinks',       75.00, 100],
    ['Hot Chocolate',   'Drinks',       95.00,  60],

    // Dessert
    ['Choco Lava Cake', 'Dessert',     150.00,  20],
    ['Cheesecake',      'Dessert',     130.00,  15],
    ['Tiramisu',        'Dessert',     160.00,  15],

    // Specialty
    ['Roots Blend',     'Specialty',   160.00,  50],
    ['Caramel Macchiato','Specialty',  140.00,  50],
    ['Matcha Latte',    'Specialty',   130.00,  40],
    ['Lavender Latte',  'Specialty',   145.00,   8], // low stock for demo
];

$stmt = $pdo->prepare("INSERT IGNORE INTO products (name, category, price, quantity) VALUES (?, ?, ?, ?)");
foreach ($products as $p) {
    $stmt->execute($p);
    $messages[] = "Product: <strong>{$p[0]}</strong> ({$p[1]}) — ₱{$p[2]}";
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Roots – Setup</title>
<style>
  body { font-family: sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; }
  h1 { color: #8E3200; }
  .msg { background: #FFEBC1; border-left: 4px solid #A64B2A; padding: 8px 14px; margin: 6px 0; border-radius: 4px; font-size: 0.9rem; }
  .done { background: #d4edda; border-left-color: #28a745; margin-top: 20px; padding: 14px; border-radius: 6px; }
  a { color: #8E3200; font-weight: bold; }
</style>
</head>
<body>
<h1>☕ Roots COFFEE & CRAFT — Setup Complete</h1>
<?php foreach ($messages as $m): ?>
  <div class="msg"><?= $m ?></div>
<?php endforeach; ?>
<div class="done">
  <strong>All done!</strong> Delete or rename this file after setup.<br><br>
  → <a href="index.html">Customer Menu</a><br>
  → <a href="admin/login.html">Admin / Cashier Login</a><br>
  → <a href="kitchen/index.html">Kitchen Display</a>
</div>
</body>
</html>
