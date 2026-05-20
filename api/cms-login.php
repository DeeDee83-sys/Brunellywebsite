<?php
require __DIR__ . '/config.php';

sendCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST' && isset($_GET['_method'])) {
    $method = strtoupper($_GET['_method']);
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$email = isset($data['email']) ? trim($data['email']) : '';
$password = isset($data['password']) ? $data['password'] : '';

if (!$email || !$password) {
    http_response_code(400);
    echo json_encode(['error' => 'Email and password are required']);
    exit;
}

// Authenticate with Supabase Auth REST API
$url = rtrim($supabaseUrl, '/') . '/auth/v1/token?grant_type=password';
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['email' => $email, 'password' => $password]));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'apikey: ' . $supabaseServiceKey,
    'Content-Type: application/json'
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$authData = json_decode($response, true);

if ($httpCode !== 200 || !isset($authData['access_token'])) {
    http_response_code(401);
    echo json_encode(['error' => $authData['msg'] ?? $authData['error_description'] ?? 'Invalid credentials']);
    exit;
}

$userId = $authData['user']['id'] ?? null;
$role = getUserRole($userId);

if (!$role || ($role !== 'admin' && $role !== 'content_editor')) {
    http_response_code(403);
    echo json_encode(['error' => 'Account not authorised for CMS access']);
    exit;
}

$token = signSessionToken(['userId' => $userId, 'role' => $role], $jwtSecret);

$isSecure = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ||
            (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

setcookie(COOKIE_NAME, $token, [
    'expires' => time() + COOKIE_MAX_AGE,
    'path' => '/',
    'httponly' => true,
    'secure' => $isSecure,
    'samesite' => 'Strict'
]);

echo json_encode(['success' => true, 'role' => $role]);
