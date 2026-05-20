<?php
require __DIR__ . '/config.php';

sendCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST' && isset($_GET['_method'])) {
    $method = strtoupper($_GET['_method']);
}

$decoded = requireAuth($jwtSecret);
requireRole(['admin', 'content_editor'], $decoded);

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No image file provided']);
    exit;
}

$file = $_FILES['image'];
$allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

if (!in_array($ext, $allowedExts, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid file type: .' . $ext]);
    exit;
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (strpos($mimeType, 'image/') !== 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Only image files are allowed']);
    exit;
}

if ($file['size'] > UPLOAD_MAX_SIZE) {
    http_response_code(400);
    echo json_encode(['error' => 'File too large. Max size is 5MB.']);
    exit;
}

if (!is_dir(BLOG_IMAGES_DIR)) {
    mkdir(BLOG_IMAGES_DIR, 0755, true);
}

$filename = time() . '-' . mt_rand(100000000, 999999999) . '.' . $ext;
$destPath = BLOG_IMAGES_DIR . $filename;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save uploaded file']);
    exit;
}

$publicUrl = '/static/blog-images/' . $filename;
echo json_encode(['url' => $publicUrl, 'filename' => $filename]);
