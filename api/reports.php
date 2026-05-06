<?php
require_once 'db.php';
requireAdmin();

$action   = $_GET['action']    ?? 'sales';
$dateFrom = $_GET['date_from'] ?? date('Y-m-01');
$dateTo   = $_GET['date_to']   ?? date('Y-m-d');

switch ($action) {

    case 'sales':
        $period = $_GET['period'] ?? 'daily';

        switch ($period) {
            case 'weekly':
                $groupBy = "YEARWEEK(orderDateTime,1)";
                $label   = "CONCAT(YEAR(orderDateTime),'-W',LPAD(WEEK(orderDateTime,1),2,'0'))";
                break;
            case 'monthly':
                $groupBy = "DATE_FORMAT(orderDateTime,'%Y-%m')";
                $label   = "DATE_FORMAT(orderDateTime,'%Y-%m')";
                break;
            default:
                $groupBy = "DATE(orderDateTime)";
                $label   = "DATE(orderDateTime)";
        }

        $stmt = $pdo->prepare(
            "SELECT $label AS period,
                    COUNT(*) AS order_count,
                    COALESCE(SUM(totalAmount),0) AS revenue
             FROM orders
             WHERE DATE(orderDateTime) BETWEEN ? AND ?
               AND status = 'completed'
             GROUP BY $groupBy
             ORDER BY period ASC"
        );
        $stmt->execute([$dateFrom, $dateTo]);
        echo json_encode($stmt->fetchAll());
        break;

    case 'product_ranking':
        $stmt = $pdo->prepare(
            "SELECT p.name, p.category,
                    SUM(oi.quantity) AS total_sold,
                    COALESCE(SUM(oi.quantity * oi.price),0) AS revenue
             FROM order_items oi
             JOIN products p ON oi.productID = p.productID
             JOIN orders   o ON oi.orderID   = o.orderID
             WHERE DATE(o.orderDateTime) BETWEEN ? AND ?
               AND o.status = 'completed'
             GROUP BY oi.productID
             ORDER BY total_sold DESC"
        );
        $stmt->execute([$dateFrom, $dateTo]);
        echo json_encode($stmt->fetchAll());
        break;

    case 'category_performance':
        $stmt = $pdo->prepare(
            "SELECT p.category,
                    COUNT(DISTINCT o.orderID) AS order_count,
                    SUM(oi.quantity)           AS total_sold,
                    COALESCE(SUM(oi.quantity * oi.price),0) AS revenue
             FROM order_items oi
             JOIN products p ON oi.productID = p.productID
             JOIN orders   o ON oi.orderID   = o.orderID
             WHERE DATE(o.orderDateTime) BETWEEN ? AND ?
               AND o.status = 'completed'
             GROUP BY p.category
             ORDER BY revenue DESC"
        );
        $stmt->execute([$dateFrom, $dateTo]);
        echo json_encode($stmt->fetchAll());
        break;

    case 'export_csv':
        $stmt = $pdo->prepare(
            "SELECT o.orderID AS 'Order ID',
                    o.customer_name AS 'Customer',
                    o.order_type    AS 'Type',
                    o.totalAmount   AS 'Total (₱)',
                    o.status        AS 'Status',
                    o.orderDateTime AS 'Date & Time',
                    COALESCE(e.name,'—') AS 'Employee'
             FROM orders o
             LEFT JOIN employees e ON o.EmployeeID = e.EmployeeID
             WHERE DATE(o.orderDateTime) BETWEEN ? AND ?
             ORDER BY o.orderDateTime DESC"
        );
        $stmt->execute([$dateFrom, $dateTo]);
        $rows = $stmt->fetchAll();

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="sales_' . $dateFrom . '_to_' . $dateTo . '.csv"');

        $out = fopen('php://output', 'w');
        if (!empty($rows)) fputcsv($out, array_keys($rows[0]));
        foreach ($rows as $row) fputcsv($out, $row);
        fclose($out);
        exit;

    default:
        echo json_encode(['error' => 'Unknown action']);
}
