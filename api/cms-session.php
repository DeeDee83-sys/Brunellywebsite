<?php
require __DIR__ . '/config.php';

sendCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST' && isset($_GET['_method'])) {
    $method = strtoupper($_GET['_method']);
}

if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$decoded = requireAuth($jwtSecret);
requireRole(['admin', 'content_editor'], $decoded);

echo json_encode(['authenticated' => true, 'userId' => $decoded['userId'], 'role' => $decoded['role']]);
