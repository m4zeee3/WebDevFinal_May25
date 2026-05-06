<?php
require_once 'db.php';
requireAdmin();

$action = $_GET['action'] ?? 'stats';

switch ($action) {

    case 'stats':
        $today = date('Y-m-d');

        $stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM orders WHERE DATE(orderDateTime)=? AND status!='cancelled'");
        $stmt->execute([$today]);
        $todayOrders = $stmt->fetchColumn();

        $stmt = $pdo->prepare("SELECT COALESCE(SUM(totalAmount),0) FROM orders WHERE DATE(orderDateTime)=? AND status='completed'");
        $stmt->execute([$today]);
        $todaySales = $stmt->fetchColumn();

        $stmt = $pdo->query("SELECT COALESCE(SUM(totalAmount),0) FROM orders WHERE status='completed'");
        $totalSales = $stmt->fetchColumn();

        $stmt = $pdo->query("SELECT COUNT(*) FROM orders WHERE status='pending'");
        $pendingOrders = $stmt->fetchColumn();

        $stmt = $pdo->query("SELECT COUNT(*) FROM products WHERE is_available=1");
        $productCount = $stmt->fetchColumn();

        $stmt = $pdo->query("SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status");
        $statusCounts = $stmt->fetchAll();

        echo json_encode([
            'today_orders'   => (int)$todayOrders,
            'today_sales'    => (float)$todaySales,
            'total_sales'    => (float)$totalSales,
            'pending_orders' => (int)$pendingOrders,
            'product_count'  => (int)$productCount,
            'status_counts'  => $statusCounts,
        ]);
        break;

    case 'recent_orders':
        $stmt = $pdo->query(
            "SELECT o.orderID, o.customer_name, o.totalAmount, o.status,
                    o.orderDateTime, o.order_type, e.name AS employee_name
             FROM orders o
             LEFT JOIN employees e ON o.EmployeeID = e.EmployeeID
             ORDER BY o.orderDateTime DESC
             LIMIT 10"
        );
        echo json_encode($stmt->fetchAll());
        break;

    case 'sales_chart':
        $days = (int)($_GET['days'] ?? 7);
        $stmt = $pdo->prepare(
            "SELECT DATE(orderDateTime) AS date,
                    COALESCE(SUM(totalAmount),0) AS total
             FROM orders
             WHERE DATE(orderDateTime) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
               AND status = 'completed'
             GROUP BY DATE(orderDateTime)
             ORDER BY date ASC"
        );
        $stmt->execute([$days]);
        echo json_encode($stmt->fetchAll());
        break;

    case 'top_products':
        $stmt = $pdo->query(
            "SELECT p.name, SUM(oi.quantity) AS total_sold,
                    SUM(oi.quantity * oi.price) AS revenue
             FROM order_items oi
             JOIN products p ON oi.productID = p.productID
             JOIN orders o   ON oi.orderID   = o.orderID
             WHERE o.status = 'completed'
             GROUP BY oi.productID
             ORDER BY total_sold DESC
             LIMIT 8"
        );
        echo json_encode($stmt->fetchAll());
        break;

    case 'order_status_pie':
        $stmt = $pdo->query(
            "SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status"
        );
        echo json_encode($stmt->fetchAll());
        break;
}
