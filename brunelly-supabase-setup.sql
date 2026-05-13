
-- ═══════════════════════════════════════════════════════════
-- BRUNELLY SUPABASE SCHEMA
-- Run this in Supabase SQL Editor (Database > SQL Editor)
-- ═══════════════════════════════════════════════════════════

-- ── Articles ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  excerpt     TEXT,
  category    TEXT,
  url         TEXT,
  image       TEXT,
  date        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Videos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS videos (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  youtube_url  TEXT,
  youtube_id   TEXT,
  duration     TEXT,
  published    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Use Cases ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS use_cases (
  id          TEXT PRIMARY KEY,
  icon        TEXT,
  icon_bg     TEXT,
  icon_color  TEXT,
  title       TEXT NOT NULL,
  body        TEXT,
  published   BOOLEAN DEFAULT FALSE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── FAQs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faqs (
  id          TEXT PRIMARY KEY,
  page        TEXT NOT NULL,  -- 'hub' or 'pricing'
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Feature Images ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_images (
  id          TEXT PRIMARY KEY,  -- e.g. 'understand-onboarding'
  page        TEXT NOT NULL,
  label       TEXT NOT NULL,
  hint        TEXT,
  image_url   TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Hero Images ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hero_images (
  id          TEXT PRIMARY KEY,  -- e.g. 'plan', 'code', 'chat'
  label       TEXT NOT NULL,
  hint        TEXT,
  image_url   TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Analytics Events ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id           BIGSERIAL PRIMARY KEY,
  type         TEXT NOT NULL,  -- 'pageview', 'article_click', 'video_click', 'newsletter_signup'
  ts           BIGINT NOT NULL,
  source       TEXT,
  device       TEXT,
  scroll_depth INTEGER,
  time_on_page INTEGER,
  article_id   TEXT,
  article_title TEXT,
  category     TEXT,
  video_title  TEXT,
  email        TEXT,
  page_url     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes for analytics performance ────────────────────
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(type);
CREATE INDEX IF NOT EXISTS idx_analytics_ts   ON analytics_events(ts);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_event_id ON analytics_events(event_id);

-- ── Leads ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT,
  email       TEXT NOT NULL,
  source      TEXT,           -- 'chatbot' or 'contact-form'
  page        TEXT,           -- page URL they came from
  message     TEXT,           -- contact form message if applicable
  company     TEXT,           -- contact form company if applicable
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_email      ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_source     ON leads(source);

-- ── Article Submissions (restricted public write) ─────────────────
-- Public visitors can suggest articles, but cannot write directly to
-- the articles table. This table accepts only safe, non-executable
-- fields (suggested_url, submitter_email, notes) for review by admins.
CREATE TABLE IF NOT EXISTS article_submissions (
  id              BIGSERIAL PRIMARY KEY,
  suggested_url   TEXT,
  submitter_email TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security — lock down policies ───────────────────────
ALTER TABLE articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE use_cases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_images  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_images     ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads            ENABLE ROW LEVEL SECURITY;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Public read articles"        ON articles;
DROP POLICY IF EXISTS "Public write articles"       ON articles;
DROP POLICY IF EXISTS "Public read videos"          ON videos;
DROP POLICY IF EXISTS "Public write videos"         ON videos;
DROP POLICY IF EXISTS "Public read use_cases"       ON use_cases;
DROP POLICY IF EXISTS "Public write use_cases"      ON use_cases;
DROP POLICY IF EXISTS "Public read faqs"            ON faqs;
DROP POLICY IF EXISTS "Public write faqs"           ON faqs;
DROP POLICY IF EXISTS "Public read feature_images"  ON feature_images;
DROP POLICY IF EXISTS "Public write feature_images" ON feature_images;
DROP POLICY IF EXISTS "Public read hero_images"     ON hero_images;
DROP POLICY IF EXISTS "Public write hero_images"    ON hero_images;
DROP POLICY IF EXISTS "Public insert analytics"     ON analytics_events;
DROP POLICY IF EXISTS "Public read analytics"       ON analytics_events;
DROP POLICY IF EXISTS "Public insert leads"         ON leads;
DROP POLICY IF EXISTS "Public read leads"           ON leads;
DROP POLICY IF EXISTS "Public insert article_submissions" ON article_submissions;
DROP POLICY IF EXISTS "Public read article_submissions"   ON article_submissions;

-- Helper: check if current auth user has one of the required roles
CREATE OR REPLACE FUNCTION public.user_has_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = ANY(required_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ── Content tables: public read-only, admin/editor write ──────────

-- articles
CREATE POLICY "Public read articles"
  ON articles FOR SELECT USING (true);
CREATE POLICY "Admin/editor manage articles"
  ON articles FOR ALL USING (
    auth.uid() IS NOT NULL AND user_has_role(ARRAY['admin','content_editor'])
  );

-- videos (public sees only published)
CREATE POLICY "Public read published videos"
  ON videos FOR SELECT USING (published = true);
CREATE POLICY "Admin/editor manage videos"
  ON videos FOR ALL USING (
    auth.uid() IS NOT NULL AND user_has_role(ARRAY['admin','content_editor'])
  );

-- use_cases (public sees only published)
CREATE POLICY "Public read published use_cases"
  ON use_cases FOR SELECT USING (published = true);
CREATE POLICY "Admin/editor manage use_cases"
  ON use_cases FOR ALL USING (
    auth.uid() IS NOT NULL AND user_has_role(ARRAY['admin','content_editor'])
  );

-- faqs
CREATE POLICY "Public read faqs"
  ON faqs FOR SELECT USING (true);
CREATE POLICY "Admin/editor manage faqs"
  ON faqs FOR ALL USING (
    auth.uid() IS NOT NULL AND user_has_role(ARRAY['admin','content_editor'])
  );

-- feature_images
CREATE POLICY "Public read feature_images"
  ON feature_images FOR SELECT USING (true);
CREATE POLICY "Admin/editor manage feature_images"
  ON feature_images FOR ALL USING (
    auth.uid() IS NOT NULL AND user_has_role(ARRAY['admin','content_editor'])
  );

-- hero_images
CREATE POLICY "Public read hero_images"
  ON hero_images FOR SELECT USING (true);
CREATE POLICY "Admin/editor manage hero_images"
  ON hero_images FOR ALL USING (
    auth.uid() IS NOT NULL AND user_has_role(ARRAY['admin','content_editor'])
  );

-- ── analytics_events: public insert, authenticated select only, admin delete ─────
CREATE POLICY "Public insert analytics"
  ON analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin/viewer read analytics"
  ON analytics_events FOR SELECT USING (
    auth.uid() IS NOT NULL AND user_has_role(ARRAY['admin','analytics_viewer'])
  );
CREATE POLICY "Admin delete analytics"
  ON analytics_events FOR DELETE USING (
    auth.uid() IS NOT NULL AND user_has_role(ARRAY['admin'])
  );

-- ── leads: public insert, admin read/delete only ──────────────────
CREATE POLICY "Public insert leads"
  ON leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin read leads"
  ON leads FOR SELECT USING (
    auth.uid() IS NOT NULL AND user_has_role(ARRAY['admin'])
  );
CREATE POLICY "Admin delete leads"
  ON leads FOR DELETE USING (
    auth.uid() IS NOT NULL AND user_has_role(ARRAY['admin'])
  );

-- ── article_submissions: restricted public insert, admin read ─────
-- Public write is enabled but restricted to non-executable fields.
-- Anonymous users can submit a suggested URL, email, and notes.
-- Admins review submissions and promote valid ones to the articles table.
CREATE POLICY "Public insert article_submissions"
  ON article_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin read article_submissions"
  ON article_submissions FOR SELECT USING (
    auth.uid() IS NOT NULL AND user_has_role(ARRAY['admin','content_editor'])
  );
CREATE POLICY "Admin delete article_submissions"
  ON article_submissions FOR DELETE USING (
    auth.uid() IS NOT NULL AND user_has_role(ARRAY['admin'])
  );

-- ── Seed hero image slots ─────────────────────────────────
INSERT INTO hero_images (id, label, hint) VALUES
  ('plan',   'Plan',         'Backlog/story generation interface'),
  ('code',   'Code',         'Code generation with approval gate'),
  ('chat',   'Expert Chat',  'AI chat answering a technical question'),
  ('test',   'Test',         'Bug hunter or test output'),
  ('review', 'Review',       'Analysis tools dashboard')
ON CONFLICT (id) DO NOTHING;

-- ── Seed feature image slots ──────────────────────────────
INSERT INTO feature_images (id, page, label, hint) VALUES
  ('understand-onboarding',  'brunelly-features-understand.html', 'Smart Onboarding',        'First-run onboarding experience'),
  ('understand-codebase',    'brunelly-features-understand.html', 'Codebase Intelligence',    'Codebase reading and mapping'),
  ('understand-context',     'brunelly-features-understand.html', 'Persistent Context',       'Context retention across sessions'),
  ('plan-architecture',      'brunelly-features-plan.html',       'Concept to Architecture',  'Architecture generation from brief'),
  ('plan-stories',           'brunelly-features-plan.html',       'AI Story Generation',      'User story generation'),
  ('plan-sprint',            'brunelly-features-plan.html',       'Sprint Health Monitoring', 'Sprint tracking dashboard'),
  ('build-codegen',          'brunelly-features-build.html',      'Iterative Code Generation','Step-by-step code generation'),
  ('build-pr',               'brunelly-features-build.html',      'PR Management',            'Pull request workflow'),
  ('build-approval',         'brunelly-features-build.html',      'Approval Gates',           'Human approval checkpoints'),
  ('quality-review',         'brunelly-features-quality.html',    'AI Code Reviews',          'Automated code review output'),
  ('quality-security',       'brunelly-features-quality.html',    'Security Scanning',        'Security scan results'),
  ('quality-bughunter',      'brunelly-features-quality.html',    'Bug Hunter',               'Bug detection interface'),
  ('quality-testing',        'brunelly-features-quality.html',    'Automated Testing',        'Test generation and results'),
  ('collab-chat',            'brunelly-features-collaborate.html','AI Expert Chat',           'AI chat interface'),
  ('collab-kanban',          'brunelly-features-collaborate.html','Kanban Boards',            'Kanban board view'),
  ('collab-realtime',        'brunelly-features-collaborate.html','Real-Time Collaboration',  'Team collaboration view')
ON CONFLICT (id) DO NOTHING;


-- ── Profiles (role-based access control) ──────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'content_editor', 'analytics_viewer')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE article_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile (required for login role check)
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

-- Admins can manage all profiles
CREATE POLICY "Admins can manage profiles"
  ON profiles FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Done!
SELECT 'Schema created successfully' as status;
