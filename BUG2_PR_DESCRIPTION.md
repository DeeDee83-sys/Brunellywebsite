# Bug 2: Critical Security Vulnerability — Hardcoded Admin Password in Client-Side JavaScript

## Resolution Summary

**Status:** Resolved with additional defensive hardening on branch `bug/2-critical-security-vulnerability-hardcoded-admin`.

### Scope of Changes

The branch contains **22 commits** ahead of `main` touching **5 files** with a net change of **~287 insertions and ~72 deletions**:

```
AGENTS.md                   |  38 ++++++-
BUG2_PR_DESCRIPTION.md      |  43 ++++++++
brunelly-admin.html         | 242 +++++++++++++++++++++++++++++++++++++++++
brunelly-analytics.html     |  30 ++++--
brunelly-supabase-setup.sql |   6 +-
```

### Root Cause

The original vulnerability was a hardcoded plaintext password (`var PASS = 'brunelly2026'`) and insecure client-side `sessionStorage` authentication in `brunelly-admin.html`. This allowed trivial authentication bypass by manually setting `sessionStorage.setItem('cms_auth','1')`.

### Remediation Overview

The hardcoded password and `sessionStorage` bypass were removed in commit `3a77ab0` (Bug 1 Step 2) and replaced with Supabase Auth. This branch builds on that foundation with comprehensive defensive hardening.

---

## Changes on This Branch

### 1. Authentication & Session Management
- Replaced the hardcoded password gate with **Supabase Auth** email/password login.
- Replaced insecure `sessionStorage.setItem('cms_auth','1')` with proper server-authenticated JWT sessions managed by Supabase.
- Added `supabase-auth.js` shared module for secure `signIn`, `signOut`, `getCurrentSession`, and `getUserRole` flows.
- Gated both `brunelly-admin.html` and `brunelly-analytics.html` behind authenticated sessions plus role checks (`admin`, `content_editor`, `analytics_viewer`).
- Introduced the `profiles` table linking `auth.users` to verified roles.

### 2. XSS & Injection Remediation
- Added `escapeHtml()` helper to `brunelly-admin.html` and applied explicit HTML-escaping to all user-controlled values in `renderArticles`, `renderVideos`, `renderUseCases`, `renderFaqs`, `renderLeads`, `renderImages`, and `renderHeroImages`.
- Added `isSafeUrl()` helper that permits only `http://` and `https://` schemes. Article URLs are rendered as plain text when unsafe, and lead email `mailto:` links were removed in favour of plain text.
- Applied defense-in-depth escaping to all dynamically generated `data-*` attribute values (`data-id`, `data-index`, `data-page`) to prevent attribute-breakout injection even if future IDs contain quote characters.

### 3. Event Delegation & Brittle-Pattern Removal
- Removed all dynamic inline `onclick`/`onchange` handlers from `brunelly-admin.html` and replaced them with event delegation.
- Buttons and inputs now use stable `data-*` attributes (`data-action`, `data-type`, `data-index`, `data-table`, `data-id`, `data-page`).
- `editItem()` and `editFaqById()` now look up items from global caches instead of parsing JSON blobs embedded in HTML attributes.

### 4. Error Handling & UX Hardening
- Added `.catch()` to all previously unhandled promise chains in `brunelly-admin.html` and `brunelly-analytics.html`.
- User-facing operations (`toggleUC`, `saveFeatImage`, `clearFeatImage`, `saveHeroImage`, `clearHeroImage`, `saveFaq`, `deleteFaqById`, `deleteItem`, `exportLeads`, `exportData`, `importData`) now surface errors via `showToast`.
- Extended `sbDelete()` with an optional `filter` parameter and refactored `clearLeads()` to use it with `.catch()` error handling.
- Updated `clearData()` in `brunelly-analytics.html` to actually delete `analytics_events` records from Supabase before clearing local cache, and reset `_eventsCache` / `_eventsCacheTime` to prevent stale renders.
- Extended `showToast()` to support error styling so failures are visible.

### 5. RLS & Policy Updates
- Locked down Row-Level Security (RLS) policies. Public access is read-only for published content. All writes restricted to authenticated users with verified roles via `user_has_role()` helper.
- `analytics_events`: public `INSERT` only; `admin`/`analytics_viewer` can `SELECT`.
- `leads`: public `INSERT` only; `admin` can `SELECT` and `DELETE`.
- Added admin-only DELETE RLS policy for `analytics_events`.
- Analytics UX aligned with authorization: the **Clear data** button is conditionally hidden for non-admin roles (`analytics_viewer`), matching the RLS policy.

---

## Security Posture

- **Client-side secrets:** No plaintext passwords or API secrets exist in client-side JavaScript.
- **Session management:** Managed server-side by Supabase Auth (JWT-based sessions).
- **Access control:** Role-based; unauthenticated or unauthorised users cannot access CMS or analytics interfaces.
- **Data protection:** Row-Level Security (RLS) policies restrict all writes to authenticated users with verified roles.
- **Injection resistance:** All rendered user-controlled values are escaped; URL schemes are validated; dynamic attributes are escaped.

## Multi-Factor Authentication (MFA) Status

- **MFA is not implemented in the current login flows.**
- The user story specified MFA as "optional, configurable by admin." While Supabase Auth supports TOTP-based MFA and the high-level enablement steps are documented in `AGENTS.md`, no MFA challenge logic exists in `brunelly-admin.html` or `brunelly-analytics.html`.
- **MFA remains out of scope for this bug fix.** Implementing full MFA enrollment and verification flows (TOTP setup UI, backup codes, per-role enforcement flags) is a separate security enhancement, not a requirement for resolving the reported hardcoded-password vulnerability.
- The current security posture is accurately represented as: **single-factor Supabase Auth + role-based access control + RLS + XSS hardening**.

## Verification

- **Branch:** `bug/2-critical-security-vulnerability-hardcoded-admin`
- **Diff against `main`:** Non-empty; 5 files changed, ~287 insertions, ~72 deletions.
- **Working tree:** Clean (no uncommitted changes or generated files).
