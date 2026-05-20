<?php
require __DIR__ . '/config.php';

sendCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST' && isset($_GET['_method'])) {
    $method = strtoupper($_GET['_method']);
}

$decoded = requireAuth($jwtSecret);
requireRole(['admin', 'content_editor'], $decoded);

if ($method === 'GET') {
    $status = $_GET['status'] ?? '';
    $search = $_GET['search'] ?? '';
    $category = $_GET['category'] ?? '';
    $limit = $_GET['limit'] ?? '100';
    $offset = $_GET['offset'] ?? '0';

    $query = 'articles?select=*';
    $extraHeaders = ['Prefer: count=exact'];

    if ($status === 'published') {
        $query .= '&published_at=not.is.null';
    } elseif ($status === 'draft') {
        $query .= '&published_at=is.null';
    }

    if ($category) {
        $query .= '&category=eq.' . urlencode($category);
    }

    if ($search) {
        $safeSearch = sanitizePostgrestSearch($search);
        $safeSearch = escapePostgrestOrValue($safeSearch);
        $query .= '&or=(title.ilike.%' . urlencode($safeSearch) . '%,excerpt.ilike.%' . urlencode($safeSearch) . '%)';
    }

    $query .= '&order=created_at.desc';
    $query .= '&limit=' . intval($limit) . '&offset=' . intval($offset);

    $res = supabaseRequest('GET', $query, null, $extraHeaders);

    if ($res['code'] >= 200 && $res['code'] < 300) {
        $count = null;
        if (isset($res['headers']['content-range'])) {
            $rangeParts = explode('/', $res['headers']['content-range']);
            $count = isset($rangeParts[1]) ? intval($rangeParts[1]) : null;
        }
        echo json_encode(['data' => $res['body'] ?? [], 'count' => $count ?? count($res['body'] ?? [])]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch posts']);
    }
    exit;
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    $title = isset($data['title']) ? trim($data['title']) : '';
    $excerpt = isset($data['excerpt']) ? trim($data['excerpt']) : '';
    $category = isset($data['category']) ? trim($data['category']) : '';

    if (!$title || !$excerpt || !$category) {
        http_response_code(400);
        echo json_encode(['error' => 'Title, excerpt, and category are required']);
        exit;
    }

    $now = date('c');
    $payload = [
        'id' => isset($data['id']) ? trim($data['id']) : 'post-' . time(),
        'title' => $title,
        'excerpt' => $excerpt,
        'category' => $category,
        'url' => isset($data['url']) && isSafeUrl($data['url']) ? trim($data['url']) : null,
        'image' => isset($data['image']) && isSafeUrl($data['image']) ? trim($data['image']) : null,
        'content' => isset($data['content']) ? trim($data['content']) : null,
        'published_at' => isset($data['published_at']) && $data['published_at'] ? $data['published_at'] : null,
        'created_at' => $now,
        'updated_at' => $now
    ];

    $res = supabaseRequest('POST', 'articles', $payload);
    if ($res['code'] >= 200 && $res['code'] < 300) {
        http_response_code(201);
        echo json_encode(['data' => is_array($res['body']) ? $res['body'][0] : $res['body']]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create post']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
