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
├── tests/              # Automated regression tests (node --test)
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
- Prefer safe DOM construction (`createElement`, `textContent`) over `innerHTML` for all user-controlled values. Where `innerHTML` is unavoidable, escape all user-controlled values before inserting them into HTML via `innerHTML`. Use the shared `escapeHtml()` helper rather than raw string concatenation.
- Validate all URLs assigned to `href` or `src` with `isSafeUrl()` (allows `http://` and `https://` only).
- Sanitize CSS values assigned to `style` attributes with `isSafeCssValue()` before assignment.
- Add `rel="noopener noreferrer"` to all `target="_blank"` links.

## Security

### Completed Work

**Bug 1: Hardcoded Supabase API key with public write access**
- **Step 1 (Complete)**: Exposed key rotated in code; centralised config created; inline declarations removed.
- **Step 2 (Complete)**: Replaced password gates with Supabase Auth (email/password). Role checking via `profiles` table. Dashboards gate `init()` behind authenticated session + role check.
- **Step 3 (Complete)**: Locked down RLS policies. Public access is read-only for published content (or all content where no publish flag exists). All writes restricted to authenticated users with verified roles via `user_has_role()` helper.
- **Step 4 (Complete)**: Refactored admin and analytics dashboards to use `supabaseClient.from()` for all reads/writes. Removed raw `fetch()` helpers and `sbHeaders()`. Public pages continue to use the anon-key global for minimum required reads.
- **Step 5 (Complete)**: Fixed `sbGet` and `sbFetchAna` query-string filter parsing to support PostgREST operator syntax (e.g., `page=eq.hub`, `ts=gte.12345`).
- **Step 6 (Complete)**: Fixed pre-existing JavaScript syntax errors in `brunelly-admin.html` inline script block (unescaped single quotes inside single-quoted string literals).

**Bug 2: Hardcoded admin password in client-side JavaScript / sessionStorage auth bypass**
- **Status (Complete)**: Resolved during Bug 1 Step 2. The hardcoded password (`var PASS = 'brunelly2026'`) and insecure `sessionStorage.setItem('cms_auth','1')` bypass were removed in commit `3a77ab0`.
- Both `brunelly-admin.html` and `brunelly-analytics.html` now use Supabase Auth with server-side session validation and role-based access control.
- **Defensive hardening (Steps 1–13, Complete)**: Eliminated residual injection vectors and brittle patterns across both dashboards. This includes XSS remediation via `escapeHtml()` and `isSafeUrl()`, event delegation replacing inline handlers, comprehensive `.catch()` error handling, `sbDelete()` filter support, analytics cache correctness, and automated test coverage with `node --test`. See `BUG2_PR_DESCRIPTION.md` for full details.

**Bug 3: Stored XSS vulnerability via unsafe innerHTML in admin panel article rendering**
- **Status (Complete)**: Refactored `renderArticles` in `brunelly-admin.html` to eliminate `innerHTML` string concatenation for untrusted article data.
- Introduced centralised `buildArticleRow()` helper that constructs each table row using `document.createElement`, `document.createTextNode`, and `textContent`. No user-controlled values pass through `innerHTML`.
- All URL-bearing attributes (`img.src`, `a.href`) are validated with `isSafeUrl()` before assignment; unsafe URLs fall back to plain text or placeholder elements.
- Added `tests/article-render.test.js` with mock-DOM XSS regression tests that exercise the exact production helper, verifying malicious payloads (`<script>`, `<img onerror>`, `javascript:` URLs) are rendered only as inert text and unsafe URLs are rejected.

### Defensive Security Hardening (Complete)
All hardening steps on the Bug 2 branch are complete. Residual injection vectors and brittle patterns have been eliminated.

- **Step 1 (Complete)**: Stored XSS remediation. Added `escapeHtml()` helper to `brunelly-admin.html` and applied explicit HTML-escaping to all user-controlled values in `renderArticles`, `renderVideos`, `renderUseCases`, `renderFaqs`, `renderLeads`, `renderImages`, and `renderHeroImages`.
- **Step 2 (Complete)**: Removed all dynamic inline `onclick`/`onchange` handlers from `brunelly-admin.html` and replaced them with event delegation. Buttons and inputs now use stable `data-*` attributes (`data-action`, `data-type`, `data-index`, `data-table`, `data-id`, `data-page`). `editItem()` and `editFaqById()` now look up items from global caches instead of parsing JSON blobs embedded in HTML attributes.
- **Step 3 (Complete)**: FAQ edit-button injection issue resolved during Step 2. Broken single-quote escaping removed; FAQ question/answer values are no longer interpolated into executable JS contexts. `editFaqById()` now looks up FAQ data from global cache by stable `data-id`.
- **Step 4 (Complete)**: Added `.catch()` to all previously unhandled promise chains in `brunelly-admin.html`. User-facing operations (`toggleUC`, `saveFeatImage`, `clearFeatImage`, `saveHeroImage`, `clearHeroImage`, `saveFaq`, `deleteFaqById`, `deleteItem`) now surface errors via `showToast`. Background `seedIfEmpty` seeding routines log errors via `console.error`.
- **Step 5 (Complete)**: Extended `sbDelete()` with an optional `filter` parameter and refactored `clearLeads()` to use it instead of a raw `supabaseClient.from(...).delete()` call. Added `.catch()` with `showToast` error handling so failures are visible to the user.
- **Step 6 (Complete)**: Updated `clearData()` in `brunelly-analytics.html` to actually delete `analytics_events` records from Supabase (via `.delete().gt('id',0)`) before clearing local cache. Added admin-only DELETE RLS policy. Extended `showToast()` to support error styling so failures are visible.
- **Step 7 (Complete)**: Added `.catch()` to `exportLeads()`, `exportData()`, and `importData()` in `brunelly-admin.html` to ensure Supabase failures during import/export operations surface user-visible toast errors instead of failing silently.
- **Step 8 (Complete)**: Hardened XSS/injection defenses in `brunelly-admin.html` rendering. Added `isSafeUrl()` helper that permits only `http://` and `https://` schemes. Article URLs are now rendered as plain text when unsafe, and lead email `mailto:` links were removed in favour of plain text.
- **Step 9 (Complete)**: Applied defense-in-depth escaping to all dynamically generated `data-*` attribute values (`data-id`, `data-index`, `data-page`) in `brunelly-admin.html` using `escapeHtml()`. This prevents attribute-breakout injection even if future IDs contain quote characters.
- **Step 10 (Complete)**: Improved analytics UX alignment with authorization in `brunelly-analytics.html`. The **Clear data** button now has `id="clear-btn"` and `init()` conditionally shows it only when `window.currentRole === 'admin'`, matching the RLS policy that restricts `analytics_events` DELETE to admins.
- **Step 11 (Complete)**: Fixed cache correctness in `brunelly-analytics.html` after destructive operations. `clearData()` now resets `_eventsCache = null` and `_eventsCacheTime = 0` alongside `localStorage.removeItem`, ensuring the dashboard renders the empty state immediately instead of serving stale cached events.
- **Step 12 (Complete)**: Corrected `BUG2_PR_DESCRIPTION.md` to accurately describe the PR's actual diff/scope. Removed the false claim that `git diff main` is empty; documented the real changes across auth gating, XSS remediation, event delegation, error handling, and RLS/policy updates.
- **Step 13 (Complete)**: Introduced automated test coverage using Node.js built-in `node --test` runner (zero external dependencies). Tests cover: `escapeHtml` / `isSafeUrl` helpers, RLS policy validation via SQL parsing, role-gating logic for both dashboards, mocked Supabase Auth flows (signIn, signOut, getUserRole), and CRUD helper filter parsing (`sbGet`, `sbUpsert`, `sbUpdate`, `sbDelete`). Includes `package.json` with test script and `.github/workflows/ci.yml` for CI regression prevention.
- **Step 14 (Complete)**: Hardened the XSS regression test mock DOM in `tests/article-render.test.js`. Added an `innerHTML` setter to `mockElement()` via `Object.defineProperty()` so that any accidental `innerHTML` assignment in production rendering code flips `_innerHtmlSet` to `true`. This ensures `hasInnerHtml()` accurately detects innerHTML usage instead of silently returning `false`.
- **Step 15 (Complete)**: Added `.catch()` to the `sbGet('articles')` promise chain inside `renderArticles()` in `brunelly-admin.html`. Supabase query failures now surface a user-visible toast error (`showToast('Error loading articles: ...', 'error')`) instead of failing silently, consistent with all other CRUD operations in the file.

**Bug 4: Stored XSS Vulnerability via Unescaped Supabase Data on Resources Page**
- **Status (Complete)**: Remediated on branch `bug/4-stored-xss-vulnerability-via-unescaped`.
- `renderUseCases()` was refactored from unsafe string-concatenation `innerHTML` to safe DOM construction (`createElement`, `textContent`, `setAttribute`) with `isSafeCssValue()` guards for `icon_bg` and `icon_color` style values.
- `renderArticles()` was refactored to safe DOM construction; the unnecessary `escapeHtml()` on `data-id` via `setAttribute()` has been removed.
- `renderVideos()` was refactored to safe DOM construction; the unnecessary `escapeHtml()` on the YouTube thumbnail URL has been removed.
- Seed article fallback URLs in `ARTICLES_SEED` were updated to absolute URLs so they pass `isSafeUrl()` and remain clickable when Supabase is unavailable.
- Added `escapeHtml()`, `isSafeUrl()`, and `isSafeCssValue()` helpers to the page. All `href`/`src` URLs are validated before assignment; unsafe URLs fall back to plain text.
- Added `rel="noopener noreferrer"` to all `target="_blank"` links.
- Hardened `sbFetch()` to validate HTTP status (`r.ok`) before parsing JSON.
- Added `article_submissions` table to `brunelly-supabase-setup.sql` with restricted public INSERT: anonymous users can submit `suggested_url`, `submitter_email`, and `notes`, but cannot write directly to content tables. Admins review submissions and promote valid entries to `articles`.
- Added `isSafeCssValue` unit tests and updated RLS policy tests.

### Story 21: Reliable Pageview Tracking (Complete)
Replaced the legacy analytics tracking IIFE in `brunelly-features-hub.html` with a robust, consent-gated lifecycle:
- **Schema**: Added `event_id TEXT` column with unique index (`idx_analytics_event_id`) to `analytics_events` to enable PostgREST upsert deduplication.
- **Consent gate**: Tracking initializes only when `localStorage.getItem('brunelly_cookie_consent') === 'all'`.
- **Per-page ID**: `pageViewId` is generated once per page load (`crypto.randomUUID` or `Date.now()` fallback). No shared mutable `fired` boolean.
- **Immediate fire**: `trackPageview(false)` sends on load so short bounces (< 30 s) are never lost.
- **Reliable unload**: `trackPageview(true)` is wired to `visibilitychange` (hidden) and `pagehide`. It uses `fetch(keepalive: true)` with upsert headers (`Prefer: resolution=merge-duplicates`, `?on_conflict=event_id`) as the primary transport, falling back to `navigator.sendBeacon` (with `?apikey=` query param for Supabase Cloud auth) and finally synchronous `XMLHttpRequest` for very old browsers.
- **Idempotency**: Server-side unique constraint on `event_id` guarantees exactly one row per pageview even if load and unload requests race.
- **Interaction tracking**: Article clicks, video clicks, and newsletter signups continue to use standard `fetch` inserts via `trackInteraction()`.

**Bug 5: Stored XSS Vulnerability via innerHTML in FAQ Rendering on Public Pages**
- **Status**: In Progress — branch `bug/5-stored-xss-vulnerability-via-innerhtml`.
- **Step 1 (Complete)**: Replaced raw string concatenation + `innerHTML` with safe DOM construction (`createElement` + `textContent`) in `brunelly-features-hub.html` and `brunelly-pricing.html`. FAQ `id`, `question`, and `answer` values are now assigned via `setAttribute` and `textContent`, preventing execution of injected HTML/JS payloads. Accordion markup, CSS classes, and open/close behavior are preserved.
- **Step 2 (Complete)**: Introduced reusable `renderSafeFaqItem(list, faq)` helper inside each affected page's IIFE. This ensures future FAQ fields cannot be accidentally added with `innerHTML`; both visible text and `data-faq-id` attributes are handled safely through the single consistent helper pattern.
- **Step 3 (Complete)**: Added `stripHtml()` helper to `brunelly-admin.html` and applied it in `saveFaq()` to sanitize question and answer inputs before persistence. This provides defense in depth: even if safe rendering on public pages were bypassed, the database cannot contain executable HTML/JS payloads. Content editors can still author plain text FAQs normally.
- **Step 4 (Complete)**: Verified `brunelly-supabase-setup.sql` RLS policies for the `faqs` table. Public `SELECT` is enabled for public page display. `INSERT`/`UPDATE`/`DELETE` are restricted to authenticated `admin`/`content_editor` roles via `user_has_role()`. No public/anon write policy exists.

### Auth Architecture
- **Supabase JS client** loaded from CDN (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js`).
- **Shared module**: `supabase-auth.js` initialises `window.supabaseClient`, exposes `signIn()`, `signOut()`, `getCurrentSession()`, `getUserRole()`.
- **Session state**: `window.currentSession`, `window.currentUser`, `window.currentRole` are kept in sync via `onAuthStateChange`.
- **Role gating**:
  - `brunelly-admin.html` allows `admin` and `content_editor`.
  - `brunelly-analytics.html` allows `admin` and `analytics_viewer`.
- **Fetch helpers**:
  - `sbGet(table, params)` in `brunelly-admin.html`: parses query-string params into Supabase query-builder calls. Supports `select`, `order`, `limit`, and PostgREST operators (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `is`) encoded in the value (e.g., `page=eq.hub`).
  - `sbFetchAna(params)` in `brunelly-analytics.html`: similar filter parsing for `analytics_events` queries.
  - Both helpers attach the user's `access_token` when available, falling back to the anon key for unauthenticated requests.

### Key Rules
- `supabase-config.js` must contain **only** the client-safe anon/public key.
- The Supabase service-role key must **never** appear in any client-side file.
- RLS policies must deny anonymous `UPDATE` and `DELETE` on all tables.
- `user_has_role(ARRAY['admin','content_editor'])` is the centralised role-check helper used in all content-table policies.

## Multi-Factor Authentication (MFA)

- Supabase Auth supports optional MFA (TOTP via authenticator apps).
- MFA is **not currently enforced** for any role. To enable it:
  1. Enable MFA in the Supabase Auth dashboard (Authentication → Providers → Phone/OTP or Authenticator App).
  2. Update the login flow in `brunelly-admin.html` and `brunelly-analytics.html` to challenge for a TOTP code after successful password verification.
  3. Store the `aal` (Authenticator Assurance Level) requirement per role in the `profiles` table if granular enforcement is needed.
- For now, single-factor auth is sufficient. Document any future MFA mandate as a separate security initiative.

## Database

- Schema and seed data are defined in `brunelly-supabase-setup.sql`.
- Tables: `articles`, `videos`, `use_cases`, `faqs`, `feature_images`, `hero_images`, `analytics_events`, `leads`, `article_submissions`, `profiles`.
- `profiles` table: `id` (UUID, references `auth.users`), `role` (`admin` | `content_editor` | `analytics_viewer`).
- RLS policies are now restrictive:
  - **Content tables** (`articles`, `videos`, `use_cases`, `faqs`, `feature_images`, `hero_images`): public `SELECT` only (published filter for `videos`/`use_cases`); authenticated `admin`/`content_editor` can write.
  - **analytics_events**: public `INSERT` only; `admin`/`analytics_viewer` can `SELECT`; `admin` can `DELETE`.
  - **leads**: public `INSERT` only; `admin` can `SELECT` and `DELETE`.
  - **article_submissions**: public `INSERT` only (restricted to safe fields); `admin`/`content_editor` can `SELECT`; `admin` can `DELETE`.
  - **profiles**: users read own; admins manage all.

## Git Workflow

- Active branches: `feature/21-improve-pageview-tracking-to-avoid` (Story 21 — merged to main), `bug/4-stored-xss-vulnerability-via-unescaped` (Bug 4), `bug/3-stored-xss-vulnerability-via-unsafe` (Bug 3), `bug/5-stored-xss-vulnerability-via-innerhtml` (Bug 5 — current).
- Commit message conventions:
  - Security work: `security(bug-N): brief description` or `docs(bug-N): brief description`
  - Analytics work: `analytics(story-21): brief description`
- Ensure `.gitignore` excludes `node_modules/`, build outputs, and environment files.

## Deployment Notes

- The Supabase anon key in `supabase-config.js` is a placeholder.
- Before production deployment, generate a new anon key in the Supabase dashboard and update the placeholder value.
- Verify the old leaked key `sb_publishable_Dwq-UtleJ8vEKYDpCV4TuQ_GneAVjTD` is revoked in Supabase.
- Create users via the Supabase Auth dashboard, then insert matching rows into `profiles` with the appropriate role.
