<?php
require_once 'db.php';

$action = $_GET['action'] ?? 'list';

switch ($action) {

    // --------------------------------------------------
    case 'place':
        $d     = input();
        $items = $d['items'] ?? [];

        if (empty($items)) {
            echo json_encode(['error' => 'Cart is empty']);
            exit;
        }

        $empID        = $_SESSION['emp_id']  ?? null;
        $customerName = htmlspecialchars(trim($d['customer_name'] ?? 'Customer'), ENT_QUOTES, 'UTF-8');
        $orderType    = $empID ? 'walk-in' : 'online';
        $total        = 0;
        $orderItems   = [];

        foreach ($items as $item) {
            $stmt = $pdo->prepare(
                "SELECT * FROM products WHERE productID = ? AND is_available = 1 AND quantity > 0"
            );
            $stmt->execute([(int)$item['productID']]);
            $product = $stmt->fetch();

            if (!$product) continue;

            $qty        = max(1, (int)$item['quantity']);
            $price      = (float)$product['price'];
            $total     += $price * $qty;
            $orderItems[] = [
                'productID' => $product['productID'],
                'quantity'  => $qty,
                'price'     => $price,
            ];
        }

        if (empty($orderItems)) {
            echo json_encode(['error' => 'No valid items in cart']);
            exit;
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                "INSERT INTO orders (EmployeeID, customer_name, order_type, totalAmount, status)
                 VALUES (?, ?, ?, ?, 'pending')"
            );
            $stmt->execute([$empID, $customerName, $orderType, $total]);
            $orderID = $pdo->lastInsertId();

            $siStmt = $pdo->prepare(
                "INSERT INTO order_items (orderID, productID, quantity, price) VALUES (?, ?, ?, ?)"
            );
            $deduct = $pdo->prepare(
                "UPDATE products SET quantity = quantity - ? WHERE productID = ?"
            );
            foreach ($orderItems as $oi) {
                $siStmt->execute([$orderID, $oi['productID'], $oi['quantity'], $oi['price']]);
                $deduct->execute([$oi['quantity'], $oi['productID']]);
            }

            $pdo->commit();
            echo json_encode(['success' => true, 'orderID' => $orderID, 'total' => $total]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(['error' => 'Order failed: ' . $e->getMessage()]);
        }
        break;

    // --------------------------------------------------
    case 'list':
        requireAuth();
        $status    = $_GET['status']    ?? '';
        $dateFrom  = $_GET['date_from'] ?? '';
        $dateTo    = $_GET['date_to']   ?? '';
        $search    = $_GET['search']    ?? '';
        $limit     = min((int)($_GET['limit']  ?? 50), 200);
        $offset    = (int)($_GET['offset'] ?? 0);

        $sql    = "SELECT o.*, e.name AS employee_name
                   FROM orders o
                   LEFT JOIN employees e ON o.EmployeeID = e.EmployeeID";
        $params = [];
        $where  = [];

        if ($status)   { $where[] = "o.status = ?";                  $params[] = $status; }
        if ($dateFrom) { $where[] = "DATE(o.orderDateTime) >= ?";    $params[] = $dateFrom; }
        if ($dateTo)   { $where[] = "DATE(o.orderDateTime) <= ?";    $params[] = $dateTo; }
        if ($search)   {
            $where[] = "(o.orderID LIKE ? OR o.customer_name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        if ($where) $sql .= " WHERE " . implode(" AND ", $where);
        $sql .= " ORDER BY o.orderDateTime DESC LIMIT $limit OFFSET $offset";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        echo json_encode($stmt->fetchAll());
        break;

    // --------------------------------------------------
    case 'get':
        requireAuth();
        $id   = (int)($_GET['id'] ?? 0);
        $stmt = $pdo->prepare(
            "SELECT o.*, e.name AS employee_name
             FROM orders o
             LEFT JOIN employees e ON o.EmployeeID = e.EmployeeID
             WHERE o.orderID = ?"
        );
        $stmt->execute([$id]);
        $order = $stmt->fetch();

        if (!$order) { echo json_encode(['error' => 'Order not found']); break; }

        $stmt = $pdo->prepare(
            "SELECT oi.*, p.name AS product_name, p.category
             FROM order_items oi
             JOIN products p ON oi.productID = p.productID
             WHERE oi.orderID = ?"
        );
        $stmt->execute([$id]);
        $order['items'] = $stmt->fetchAll();

        echo json_encode($order);
        break;

    // --------------------------------------------------
    case 'update_status':
        requireAuth();
        $d    = input();
        $stmt = $pdo->prepare("UPDATE orders SET status = ? WHERE orderID = ?");
        $stmt->execute([$d['status'], (int)$d['orderID']]);
        echo json_encode(['success' => true]);
        break;

    // --------------------------------------------------
    case 'kitchen':
        // No auth needed – public kitchen display
        $stmt = $pdo->query(
            "SELECT o.orderID, o.customer_name, o.order_type, o.orderDateTime, o.status
             FROM orders o
             WHERE o.status IN ('pending','preparing')
             ORDER BY o.orderDateTime ASC"
        );
        $orders = $stmt->fetchAll();

        // Attach items to each order
        $itemStmt = $pdo->prepare(
            "SELECT oi.quantity, p.name AS product_name
             FROM order_items oi
             JOIN products p ON oi.productID = p.productID
             WHERE oi.orderID = ?"
        );
        foreach ($orders as &$order) {
            $itemStmt->execute([$order['orderID']]);
            $order['items'] = $itemStmt->fetchAll();
        }
        unset($order);

        echo json_encode($orders);
        break;

    default:
        echo json_encode(['error' => 'Unknown action']);
}
