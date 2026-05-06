<?php
require_once 'db.php';

$action = $_GET['action'] ?? 'list';

switch ($action) {

    // --------------------------------------------------
    case 'list':
        $category  = $_GET['category']  ?? '';
        $available = $_GET['available'] ?? '';
        $sql    = "SELECT * FROM products";
        $params = [];
        $where  = [];

        if ($category !== '') {
            $where[]  = "category = ?";
            $params[] = $category;
        }
        if ($available !== '') {
            $where[]  = "is_available = ?";
            $params[] = (int)$available;
        }
        if ($where) $sql .= " WHERE " . implode(" AND ", $where);
        $sql .= " ORDER BY category, name";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        echo json_encode($stmt->fetchAll());
        break;

    // --------------------------------------------------
    case 'get':
        $id   = (int)($_GET['id'] ?? 0);
        $stmt = $pdo->prepare("SELECT * FROM products WHERE productID = ?");
        $stmt->execute([$id]);
        $row  = $stmt->fetch();
        echo $row ? json_encode($row) : json_encode(['error' => 'Not found']);
        break;

    // --------------------------------------------------
    case 'add':
        requireAdmin();
        $d = input();
        $stmt = $pdo->prepare(
            "INSERT INTO products (name, category, price, quantity, image, is_available)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            trim($d['name']),
            $d['category'],
            (float)$d['price'],
            (int)($d['quantity'] ?? 0),
            trim($d['image']  ?? ''),
            (int)($d['is_available'] ?? 1),
        ]);
        echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
        break;

    // --------------------------------------------------
    case 'update':
        requireAdmin();
        $d = input();
        $stmt = $pdo->prepare(
            "UPDATE products
             SET name=?, category=?, price=?, quantity=?, image=?, is_available=?
             WHERE productID=?"
        );
        $stmt->execute([
            trim($d['name']),
            $d['category'],
            (float)$d['price'],
            (int)$d['quantity'],
            trim($d['image'] ?? ''),
            (int)($d['is_available'] ?? 1),
            (int)$d['productID'],
        ]);
        echo json_encode(['success' => true]);
        break;

    // --------------------------------------------------
    case 'delete':
        requireAdmin();
        $id   = (int)($_GET['id'] ?? 0);
        $stmt = $pdo->prepare("DELETE FROM products WHERE productID = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
        break;

    // --------------------------------------------------
    case 'upload_image':
        requireAdmin();
        if (empty($_FILES['image'])) {
            echo json_encode(['error' => 'No file uploaded']);
            break;
        }
        $file    = $_FILES['image'];
        $ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

        if (!in_array($ext, $allowed)) {
            echo json_encode(['error' => 'Invalid file type']);
            break;
        }
        if ($file['size'] > 5 * 1024 * 1024) {
            echo json_encode(['error' => 'File too large (max 5 MB)']);
            break;
        }

        $filename = uniqid('prod_') . '.' . $ext;
        $dest     = dirname(__DIR__) . '/images/uploads/' . $filename;

        if (move_uploaded_file($file['tmp_name'], $dest)) {
            echo json_encode(['success' => true, 'path' => 'images/uploads/' . $filename]);
        } else {
            echo json_encode(['error' => 'Upload failed']);
        }
        break;

    default:
        echo json_encode(['error' => 'Unknown action']);
}
