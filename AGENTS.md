# AGENTS.md — BrunellySite

Agent-focused guidance for the Brunelly website codebase.

## Project Structure

```
code/
├── *.html              # Static pages (public site, articles, features, CMS, analytics)
├── supabase-config.js  # Centralised Supabase client configuration (URL + anon key)
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
- **Step 2 (Pending)**: Replace client-side password gates with real Supabase Auth + role-based access control.
- **Step 3 (Pending)**: Lock down Row Level Security policies (public read-only; authenticated writes only).
- **Step 4 (Pending)**: Refactor all client-side REST calls to use authenticated sessions where required.

### Key Rules
- `supabase-config.js` must contain **only** the client-safe anon/public key.
- The Supabase service-role key must **never** appear in any client-side file.
- RLS policies must deny anonymous `UPDATE` and `DELETE` on all tables.

## Database

- Schema and seed data are defined in `brunelly-supabase-setup.sql`.
- Tables: `articles`, `videos`, `use_cases`, `faqs`, `feature_images`, `hero_images`, `analytics_events`, `leads`.
- RLS policies are currently permissive and will be tightened as part of the security remediation.

## Git Workflow

- Branch: `bug/1-critical-security-vulnerability-hardcoded-supabase`
- Commit messages: `security(step-N): brief description`
- Ensure `.gitignore` excludes `node_modules/`, build outputs, and environment files.

## Deployment Notes

- The Supabase anon key in `supabase-config.js` is a placeholder.
- Before production deployment, generate a new anon key in the Supabase dashboard and update the placeholder value.
- Verify the old leaked key `sb_publishable_Dwq-UtleJ8vEKYDpCV4TuQ_GneAVjTD` is revoked in Supabase.
