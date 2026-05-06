<?php
require_once 'db.php';

$action = $_GET['action'] ?? '';

switch ($action) {

    // --------------------------------------------------
    case 'login':
        $d = input();
        $username = trim($d['username'] ?? '');
        $password = trim($d['password'] ?? '');

        if (!$username || !$password) {
            echo json_encode(['success' => false, 'message' => 'Username and password are required']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT * FROM employees WHERE username = ?");
        $stmt->execute([$username]);
        $emp = $stmt->fetch();

        if ($emp && hash('sha256', $password) === $emp['password']) {
            $_SESSION['emp_id']   = $emp['EmployeeID'];
            $_SESSION['emp_name'] = $emp['name'];
            $_SESSION['role']     = $emp['role'];
            echo json_encode([
                'success' => true,
                'role'    => $emp['role'],
                'name'    => $emp['name'],
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
        }
        break;

    // --------------------------------------------------
    case 'logout':
        session_destroy();
        echo json_encode(['success' => true]);
        break;

    // --------------------------------------------------
    case 'check':
        if (!empty($_SESSION['emp_id'])) {
            echo json_encode([
                'logged_in' => true,
                'role'      => $_SESSION['role'],
                'name'      => $_SESSION['emp_name'],
                'id'        => $_SESSION['emp_id'],
            ]);
        } else {
            echo json_encode(['logged_in' => false]);
        }
        break;

    default:
        echo json_encode(['error' => 'Unknown action']);
}
