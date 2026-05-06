# AGENTS.md — BrunellySite

Agent-focused guidance for the Brunelly website codebase.

## Project Structure

```
code/
├── *.html              # Static pages (public site, articles, features, CMS, analytics)
├── supabase-config.js  # Centralised Supabase client configuration (URL + anon key)
├── supabase-auth.js    # Shared Supabase Auth client + role helpers
├── brunelly-supabase-setup.sql  # Database schema, tables, RLS policies, seed data
├── *.png               # Image assets
├── sitemap.xml, robots.txt, llms.txt
└── AGENTS.md           # This file
```

## Tech Stack (As-Is)

- **Frontend**: Static HTML5, CSS3, vanilla JavaScript (no build step)
- **Backend**: Supabase (PostgreSQL + Auth + REST API)
- **Hosting**: Vercel (frontend), Supabase Hosted (backend)

> **Note**: Project documentation targets React + Next.js frontend and NestJS backend, but the active repository is currently static HTML. Any framework migration is a separate initiative.

## Coding Standards

- Keep secrets out of source control. Never commit service-role keys, passwords, or API tokens.
- Centralise configuration (e.g., `supabase-config.js`) rather than duplicating values across files.
- Maintain consistent indentation (2 spaces) and brace style inside `<script>` blocks.
- Do not introduce new inline `var SUPA_URL` / `var SUPA_KEY` declarations in HTML files.
- Prefer `window.SUPA_URL` and `window.SUPA_KEY` globals loaded from `supabase-config.js`.
- Validate HTML and check JavaScript syntax before committing.

## Security

### Current Work
Bug 1: Critical security vulnerability — hardcoded Supabase API key with public write access.
- **Step 1 (Complete)**: Exposed key rotated in code; centralised config created; inline declarations removed.
- **Step 2 (Complete)**: Replaced password gates with Supabase Auth (email/password). Role checking via `profiles` table. Dashboards gate `init()` behind authenticated session + role check.
- **Step 3 (Complete)**: Locked down RLS policies. Public access is read-only for published content (or all content where no publish flag exists). All writes restricted to authenticated users with verified roles via `user_has_role()` helper.
- **Step 4 (Complete)**: Refactored admin and analytics dashboards to use `supabaseClient.from()` for all reads/writes. Removed raw `fetch()` helpers and `sbHeaders()`. Public pages continue to use the anon-key global for minimum required reads.
- **Step 3 (Pending)**: Lock down Row Level Security policies (public read-only; authenticated writes only).
- **Step 4 (Pending)**: Refactor all client-side REST calls to use authenticated sessions where required.

### Auth Architecture
- **Supabase JS client** loaded from CDN (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js`).
- **Shared module**: `supabase-auth.js` initialises `window.supabaseClient`, exposes `signIn()`, `signOut()`, `getCurrentSession()`, `getUserRole()`.
- **Session state**: `window.currentSession`, `window.currentUser`, `window.currentRole` are kept in sync via `onAuthStateChange`.
- **Role gating**:
  - `brunelly-admin.html` allows `admin` and `content_editor`.
  - `brunelly-analytics.html` allows `admin` and `analytics_viewer`.
- **Fetch helpers** (`sbHeaders()`, `sbFetchAna()`) attach the user's `access_token` when available, falling back to the anon key for unauthenticated requests.

### Key Rules
- `supabase-config.js` must contain **only** the client-safe anon/public key.
- The Supabase service-role key must **never** appear in any client-side file.
- RLS policies must deny anonymous `UPDATE` and `DELETE` on all tables.
- `user_has_role(ARRAY['admin','content_editor'])` is the centralised role-check helper used in all content-table policies.

## Database

- Schema and seed data are defined in `brunelly-supabase-setup.sql`.
- Tables: `articles`, `videos`, `use_cases`, `faqs`, `feature_images`, `hero_images`, `analytics_events`, `leads`, `profiles`.
- `profiles` table: `id` (UUID, references `auth.users`), `role` (`admin` | `content_editor` | `analytics_viewer`).
- RLS policies are now restrictive:
  - **Content tables** (`articles`, `videos`, `use_cases`, `faqs`, `feature_images`, `hero_images`): public `SELECT` only (published filter for `videos`/`use_cases`); authenticated `admin`/`content_editor` can write.
  - **analytics_events**: public `INSERT` only; `admin`/`analytics_viewer` can `SELECT`.
  - **leads**: public `INSERT` only; `admin` can `SELECT` and `DELETE`.
  - **profiles**: users read own; admins manage all.

## Git Workflow

- Branch: `bug/1-critical-security-vulnerability-hardcoded-supabase`
- Commit messages: `security(step-N): brief description`
- Ensure `.gitignore` excludes `node_modules/`, build outputs, and environment files.

## Deployment Notes

- The Supabase anon key in `supabase-config.js` is a placeholder.
- Before production deployment, generate a new anon key in the Supabase dashboard and update the placeholder value.
- Verify the old leaked key `sb_publishable_Dwq-UtleJ8vEKYDpCV4TuQ_GneAVjTD` is revoked in Supabase.
- Create users via the Supabase Auth dashboard, then insert matching rows into `profiles` with the appropriate role.
