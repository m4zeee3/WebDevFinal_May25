-- =============================================
-- Roots COFFEE & CRAFT – Complete Setup Query
-- Run this entire file in MySQL Workbench.
-- No other steps needed.
--
-- Default Logins:
--   Admin   → username: admin    / password: admin123
--   Cashier → username: cashier  / password: cashier123
-- =============================================

-- Step 1: Create & select the database
CREATE DATABASE IF NOT EXISTS roots_coffee
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE roots_coffee;

-- =============================================
-- TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS employees (
    EmployeeID  INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100)            NOT NULL,
    username    VARCHAR(50)             NOT NULL UNIQUE,
    password    VARCHAR(255)            NOT NULL,
    role        ENUM('admin','cashier') NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    productID    INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100)  NOT NULL,
    category     ENUM('Appetizer','Main Course','Drinks','Dessert','Specialty') NOT NULL,
    price        DECIMAL(10,2) NOT NULL,
    quantity     INT           NOT NULL DEFAULT 0,
    image        VARCHAR(255)  DEFAULT NULL,
    is_available TINYINT(1)    NOT NULL DEFAULT 1,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    orderID       INT AUTO_INCREMENT PRIMARY KEY,
    EmployeeID    INT           DEFAULT NULL,
    customer_name VARCHAR(100)  NOT NULL DEFAULT 'Customer',
    order_type    ENUM('online','walk-in') NOT NULL DEFAULT 'online',
    totalAmount   DECIMAL(10,2) NOT NULL,
    orderDateTime TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    status        ENUM('pending','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'pending',
    FOREIGN KEY (EmployeeID) REFERENCES employees(EmployeeID) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    orderID   INT           NOT NULL,
    productID INT           NOT NULL,
    quantity  INT           NOT NULL,
    price     DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (orderID)   REFERENCES orders(orderID)    ON DELETE CASCADE,
    FOREIGN KEY (productID) REFERENCES products(productID) ON DELETE RESTRICT
);

-- =============================================
-- EMPLOYEES
-- Passwords stored as SHA-256 hash.
--   admin123   → SHA2('admin123', 256)
--   cashier123 → SHA2('cashier123', 256)
-- =============================================

INSERT INTO employees (name, username, password, role) VALUES
('Admin User',   'admin',   SHA2('admin123',   256), 'admin'),
('Cashier User', 'cashier', SHA2('cashier123', 256), 'cashier');

-- =============================================
-- PRODUCTS (Sample Menu)
-- =============================================

INSERT INTO products (name, category, price, quantity) VALUES
-- Appetizers
('Nachos',          'Appetizer',    120.00, 50),
('Chicken Wings',   'Appetizer',    180.00, 30),
('Bruschetta',      'Appetizer',     95.00, 25),
('Calamari Rings',  'Appetizer',    145.00, 20),
-- Main Course
('Grilled Chicken', 'Main Course',  280.00, 20),
('Beef Burger',     'Main Course',  250.00, 25),
('Pasta Carbonara', 'Main Course',  220.00, 30),
('Club Sandwich',   'Main Course',  195.00, 25),
-- Drinks
('Americano',       'Drinks',        90.00, 100),
('Cappuccino',      'Drinks',       110.00, 100),
('Cold Brew',       'Drinks',       120.00,  80),
('Lemon Iced Tea',  'Drinks',        75.00, 100),
('Hot Chocolate',   'Drinks',        95.00,  60),
-- Dessert
('Choco Lava Cake', 'Dessert',      150.00,  20),
('Cheesecake',      'Dessert',      130.00,  15),
('Tiramisu',        'Dessert',      160.00,  15),
-- Specialty
('Roots Blend',     'Specialty',    160.00,  50),
('Caramel Macchiato','Specialty',   140.00,  50),
('Matcha Latte',    'Specialty',    130.00,  40),
('Lavender Latte',  'Specialty',    145.00,   8);
