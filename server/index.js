/**
 * BRUNELLY CMS API
 * Secure backend for blog post CRUD, authentication, and asset uploads.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && require.main === module) {
  console.error('FATAL: JWT_SECRET must be set');
  process.exit(1);
}
const COOKIE_NAME = 'cms_session';
const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours

// ── Supabase clients ──────────────────────────────────────────────
let supabaseAdmin;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
} else {
  console.warn('WARN: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not set. Using stub Supabase client.');
  supabaseAdmin = {
    from: function() { throw new Error('Supabase not configured'); },
    auth: {
      signInWithPassword: function() { throw new Error('Supabase not configured'); }
    }
  };
}

// ── Middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

const allowedOrigins = (process.env.FRONTEND_ORIGIN || '').split(',').filter(Boolean);
if (allowedOrigins.length === 0) {
  allowedOrigins.push('http://localhost:3000', 'http://localhost:8080');
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
}));

// ── Static assets ─────────────────────────────────────────────────
const STATIC_DIR = path.join(__dirname, '..', 'static');
const BLOG_IMAGES_DIR = path.join(STATIC_DIR, 'blog-images');
if (!fs.existsSync(BLOG_IMAGES_DIR)) {
  fs.mkdirSync(BLOG_IMAGES_DIR, { recursive: true });
}
app.use('/static', express.static(STATIC_DIR));

// ── Auth helpers ──────────────────────────────────────────────────

function isSafeUrl(str) {
  if (str == null) return false;
  const s = String(str).trim().toLowerCase();
  return s.startsWith('http://') || s.startsWith('https://');
}

function sanitizePostgrestSearch(search) {
  return search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function escapePostgrestOrValue(value) {
  return value.replace(/,/g, '\\,').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function signSessionToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h', issuer: 'brunelly-cms' });
}

function verifySessionToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, { issuer: 'brunelly-cms' });
  } catch (err) {
    return null;
  }
}

async function getUserRole(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data.role;
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Unauthorized: no session cookie' });
  const decoded = verifySessionToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized: invalid or expired session' });
  req.userId = decoded.userId;
  req.userRole = decoded.role;
  next();
}

function requireRole(roles) {
  return function (req, res, next) {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Forbidden: insufficient privileges' });
    }
    next();
  };
}

// ── Upload configuration ──────────────────────────────────────────
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, BLOG_IMAGES_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    if (!allowed.includes(ext)) {
      return cb(new Error('Invalid file type: ' + ext));
    }
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// ── Routes ────────────────────────────────────────────────────────

/**
 * POST /cms/login
 * Exchanges Supabase Auth credentials for a server-signed HTTP-only cookie session.
 */
app.post('/cms/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return res.status(401).json({ error: error?.message || 'Invalid credentials' });
  }

  const role = await getUserRole(data.user.id);
  if (!role || (role !== 'admin' && role !== 'content_editor')) {
    return res.status(403).json({ error: 'Account not authorised for CMS access' });
  }

  const token = signSessionToken({ userId: data.user.id, role });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/'
  });

  return res.json({ success: true, role });
});

/**
 * POST /cms/logout
 */
app.post('/cms/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ success: true });
});

/**
 * GET /cms/session
 * Lightweight endpoint for the frontend to check session validity.
 */
app.get('/cms/session', requireAuth, requireRole(['admin', 'content_editor']), (req, res) => {
  res.json({ authenticated: true, userId: req.userId, role: req.userRole });
});

/**
 * GET /cms/posts
 * List blog posts. Supports ?status=draft|published filtering.
 */
app.get('/cms/posts', requireAuth, requireRole(['admin', 'content_editor']), async (req, res) => {
  const { status, search, category, limit = '100', offset = '0' } = req.query;

  let query = supabaseAdmin.from('articles').select('*', { count: 'exact' });

  if (status === 'published') {
    query = query.not('published_at', 'is', null);
  } else if (status === 'draft') {
    query = query.is('published_at', null);
  }

  if (category) {
    query = query.eq('category', category);
  }

  if (search) {
    const safeSearch = escapePostgrestOrValue(sanitizePostgrestSearch(search));
    query = query.or(`title.ilike.%${safeSearch}%,excerpt.ilike.%${safeSearch}%`);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10) - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error('GET /cms/posts error:', error);
    return res.status(500).json({ error: 'Failed to fetch posts' });
  }

  res.json({ data: data || [], count: count || 0 });
});

/**
 * GET /cms/posts/:id
 * Retrieve a single blog post.
 */
app.get('/cms/posts/:id', requireAuth, requireRole(['admin', 'content_editor']), async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin.from('articles').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return res.status(404).json({ error: 'Post not found' });
    console.error('GET /cms/posts/:id error:', error);
    return res.status(500).json({ error: 'Failed to fetch post' });
  }
  res.json({ data });
});

/**
 * POST /cms/posts
 * Create a new blog post.
 */
app.post('/cms/posts', requireAuth, requireRole(['admin', 'content_editor']), async (req, res) => {
  const { id, title, excerpt, category, url, image, content, published_at } = req.body;

  if (!title || !excerpt || !category) {
    return res.status(400).json({ error: 'Title, excerpt, and category are required' });
  }

  const now = new Date().toISOString();
  const payload = {
    id: id || 'post-' + Date.now(),
    title: String(title).trim(),
    excerpt: String(excerpt).trim(),
    category: String(category).trim(),
    url: url && isSafeUrl(url) ? String(url).trim() : null,
    image: image && isSafeUrl(image) ? String(image).trim() : null,
    content: content ? String(content).trim() : null,
    published_at: published_at || null,
    created_at: now,
    updated_at: now
  };

  const { data, error } = await supabaseAdmin.from('articles').insert(payload).select().single();
  if (error) {
    console.error('POST /cms/posts error:', error);
    return res.status(500).json({ error: 'Failed to create post' });
  }

  res.status(201).json({ data });
});

/**
 * PUT /cms/posts/:id
 * Update an existing blog post.
 */
app.put('/cms/posts/:id', requireAuth, requireRole(['admin', 'content_editor']), async (req, res) => {
  const { id } = req.params;
  const { title, excerpt, category, url, image, content, published_at } = req.body;

  const update = {
    updated_at: new Date().toISOString()
  };

  if (title !== undefined) update.title = String(title).trim();
  if (excerpt !== undefined) update.excerpt = String(excerpt).trim();
  if (category !== undefined) update.category = String(category).trim();
  if (url !== undefined) update.url = url && isSafeUrl(url) ? String(url).trim() : null;
  if (image !== undefined) update.image = image && isSafeUrl(image) ? String(image).trim() : null;
  if (content !== undefined) update.content = content ? String(content).trim() : null;
  if (published_at !== undefined) update.published_at = published_at || null;

  const { data, error } = await supabaseAdmin.from('articles').update(update).eq('id', id).select().single();
  if (error) {
    console.error('PUT /cms/posts/:id error:', error);
    return res.status(500).json({ error: 'Failed to update post' });
  }

  res.json({ data });
});

/**
 * DELETE /cms/posts/:id
 * Remove a blog post.
 */
app.delete('/cms/posts/:id', requireAuth, requireRole(['admin', 'content_editor']), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from('articles').delete().eq('id', id);
  if (error) {
    console.error('DELETE /cms/posts/:id error:', error);
    return res.status(500).json({ error: 'Failed to delete post' });
  }
  res.json({ success: true });
});

/**
 * POST /cms/upload
 * Upload an image to the static/blog-images folder.
 */
app.post('/cms/upload', requireAuth, requireRole(['admin', 'content_editor']), upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }
  const publicUrl = '/static/blog-images/' + req.file.filename;
  res.json({ url: publicUrl, filename: req.file.filename });
});

// ── Error handling ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// ── Health check ──────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Start ─────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('Brunelly CMS API running on port ' + PORT);
    console.log('Static assets served from ' + STATIC_DIR);
  });
}

module.exports = { app, supabaseAdmin };
