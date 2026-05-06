<?php
require_once 'db.php';
requireAdmin();

$action = $_GET['action'] ?? 'list';

switch ($action) {

    case 'list':
        $lowOnly = (int)($_GET['low_stock'] ?? 0);
        if ($lowOnly) {
            $stmt = $pdo->query("SELECT * FROM products WHERE quantity <= 10 ORDER BY quantity ASC");
        } else {
            $stmt = $pdo->query("SELECT * FROM products ORDER BY category, name");
        }
        echo json_encode($stmt->fetchAll());
        break;

    case 'summary':
        $stmt = $pdo->query(
            "SELECT
                COUNT(*) AS total_products,
                SUM(CASE WHEN quantity <= 0                THEN 1 ELSE 0 END) AS out_of_stock,
                SUM(CASE WHEN quantity > 0 AND quantity <= 10 THEN 1 ELSE 0 END) AS low_stock,
                SUM(CASE WHEN quantity > 10               THEN 1 ELSE 0 END) AS in_stock
             FROM products"
        );
        echo json_encode($stmt->fetch());
        break;

    case 'update_stock':
        $d    = input();
        $stmt = $pdo->prepare("UPDATE products SET quantity = ? WHERE productID = ?");
        $stmt->execute([(int)$d['quantity'], (int)$d['productID']]);
        echo json_encode(['success' => true]);
        break;

    default:
        echo json_encode(['error' => 'Unknown action']);
}
