<?php
require __DIR__ . '/config.php';

sendCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST' && isset($_GET['_method'])) {
    $method = strtoupper($_GET['_method']);
}

$decoded = requireAuth($jwtSecret);
requireRole(['admin', 'content_editor'], $decoded);

$id = $_GET['id'] ?? '';

if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'Post ID is required']);
    exit;
}

$encodedId = urlencode($id);

if ($method === 'GET') {
    $res = supabaseRequest('GET', "articles?select=*&id=eq.$encodedId");
    if ($res['code'] >= 200 && $res['code'] < 300) {
        $data = is_array($res['body']) && count($res['body']) > 0 ? $res['body'][0] : null;
        if ($data) {
            echo json_encode(['data' => $data]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Post not found']);
        }
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch post']);
    }
    exit;
}

if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $update = ['updated_at' => date('c')];

    if (isset($data['title'])) $update['title'] = trim($data['title']);
    if (isset($data['excerpt'])) $update['excerpt'] = trim($data['excerpt']);
    if (isset($data['category'])) $update['category'] = trim($data['category']);
    if (array_key_exists('url', $data)) {
        $update['url'] = $data['url'] && isSafeUrl($data['url']) ? trim($data['url']) : null;
    }
    if (array_key_exists('image', $data)) {
        $update['image'] = $data['image'] && isSafeUrl($data['image']) ? trim($data['image']) : null;
    }
    if (array_key_exists('content', $data)) {
        $update['content'] = $data['content'] ? trim($data['content']) : null;
    }
    if (array_key_exists('published_at', $data)) {
        $update['published_at'] = $data['published_at'] ?: null;
    }

    $res = supabaseRequest('PATCH', "articles?id=eq.$encodedId", $update);
    if ($res['code'] >= 200 && $res['code'] < 300) {
        echo json_encode(['data' => is_array($res['body']) && count($res['body']) > 0 ? $res['body'][0] : null]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update post']);
    }
    exit;
}

if ($method === 'DELETE') {
    $res = supabaseRequest('DELETE', "articles?id=eq.$encodedId");
    if ($res['code'] >= 200 && $res['code'] < 300) {
        echo json_encode(['success' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete post']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
