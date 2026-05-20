<?php
/**
 * BRUNELLY CMS API — Shared Configuration
 * Shared-hosting-compatible PHP backend for blog post CRUD.
 */

// ── Environment ───────────────────────────────────────────────────
$supabaseUrl = getenv('SUPABASE_URL') ?: '';
$supabaseServiceKey = getenv('SUPABASE_SERVICE_ROLE_KEY') ?: '';
$jwtSecret = getenv('JWT_SECRET') ?: '';
$frontendOrigin = getenv('FRONTEND_ORIGIN') ?: 'http://localhost:3000,http://localhost:8080';

$allowedOrigins = array_map('trim', explode(',', $frontendOrigin));

// ── Constants ─────────────────────────────────────────────────────
define('COOKIE_NAME', 'cms_session');
define('COOKIE_MAX_AGE', 60 * 60 * 24); // 24 hours
define('UPLOAD_MAX_SIZE', 5 * 1024 * 1024); // 5 MB
define('BLOG_IMAGES_DIR', __DIR__ . '/../static/blog-images/');

// ── CORS ──────────────────────────────────────────────────────────
function sendCorsHeaders() {
    global $allowedOrigins;
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin && in_array($origin, $allowedOrigins, true)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
    }
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    header('Content-Type: application/json');
}

// ── JWT helpers ───────────────────────────────────────────────────
function base64UrlEncode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode($data) {
    $padding = 4 - (strlen($data) % 4);
    if ($padding !== 4) {
        $data .= str_repeat('=', $padding);
    }
    return base64_decode(strtr($data, '-_', '+/'));
}

function signSessionToken(array $payload, string $secret): string {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload['iat'] = time();
    $payload['exp'] = time() + COOKIE_MAX_AGE;
    $payload['iss'] = 'brunelly-cms';

    $base64Header = base64UrlEncode($header);
    $base64Payload = base64UrlEncode(json_encode($payload));

    $signature = hash_hmac('sha256', "$base64Header.$base64Payload", $secret, true);
    $base64Signature = base64UrlEncode($signature);

    return "$base64Header.$base64Payload.$base64Signature";
}

function verifySessionToken(string $token, string $secret): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    $payload = json_decode(base64UrlDecode($parts[1]), true);
    if (!is_array($payload) || !isset($payload['exp']) || $payload['exp'] < time()) {
        return null;
    }
    if (!isset($payload['iss']) || $payload['iss'] !== 'brunelly-cms') {
        return null;
    }

    $expectedSignature = hash_hmac('sha256', "$parts[0].$parts[1]", $secret, true);
    $expectedSignature = base64UrlEncode($expectedSignature);

    if (!hash_equals($expectedSignature, $parts[2])) {
        return null;
    }

    return $payload;
}

// ── Auth middleware ───────────────────────────────────────────────
function requireAuth(string $jwtSecret): array {
    $cookieName = COOKIE_NAME;
    if (!isset($_COOKIE[$cookieName])) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized: no session cookie']);
        exit;
    }
    $decoded = verifySessionToken($_COOKIE[$cookieName], $jwtSecret);
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized: invalid or expired session']);
        exit;
    }
    return $decoded;
}

function requireRole(array $allowedRoles, array $decoded): void {
    if (!in_array($decoded['role'] ?? '', $allowedRoles, true)) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden: insufficient privileges']);
        exit;
    }
}

// ── Supabase REST helpers ─────────────────────────────────────────
function supabaseRequest(string $method, string $path, ?array $body = null, array $extraHeaders = []): array {
    global $supabaseUrl, $supabaseServiceKey;
    $url = rtrim($supabaseUrl, '/') . '/rest/v1/' . ltrim($path, '/');
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HEADER, true);
    $headers = array_merge([
        'apikey: ' . $supabaseServiceKey,
        'Authorization: Bearer ' . $supabaseServiceKey,
        'Content-Type: application/json',
        'Prefer: return=representation'
    ], $extraHeaders);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $error = curl_error($ch);
    curl_close($ch);

    $headerStr = substr($response, 0, $headerSize);
    $bodyStr = substr($response, $headerSize);

    $parsedHeaders = [];
    foreach (explode("\r\n", $headerStr) as $line) {
        $colonPos = strpos($line, ':');
        if ($colonPos !== false) {
            $key = strtolower(trim(substr($line, 0, $colonPos)));
            $value = trim(substr($line, $colonPos + 1));
            $parsedHeaders[$key] = $value;
        }
    }

    return [
        'code' => $httpCode,
        'body' => json_decode($bodyStr, true),
        'headers' => $parsedHeaders,
        'error' => $error ?: null
    ];
}

function getUserRole(string $userId): ?string {
    $res = supabaseRequest('GET', 'profiles?select=role&id=eq.' . urlencode($userId));
    if ($res['code'] >= 200 && $res['code'] < 300 && is_array($res['body']) && count($res['body']) > 0) {
        return $res['body'][0]['role'] ?? null;
    }
    return null;
}

// ── Validation helpers ────────────────────────────────────────────
function isSafeUrl(?string $url): bool {
    if ($url === null) return false;
    $s = strtolower(trim($url));
    return strpos($s, 'http://') === 0 || strpos($s, 'https://') === 0;
}

function sanitizePostgrestSearch(string $search): string {
    // Escape PostgREST LIKE wildcards
    return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search);
}

function escapePostgrestOrValue(string $value): string {
    // Escape commas and parentheses which have special meaning in PostgREST .or()
    return str_replace([',', '(', ')'], ['\\,', '\\(', '\\)'], $value);
}
