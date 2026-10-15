# CampusHub — Phase Progress Tracker

> Update this file at the end of every work session.  
> Format: `[x]` = complete · `[-]` = in progress · `[ ]` = not started

| Phase | Slice | Backend (Titus) | Frontend (Mark) | Merged to main |
|-------|-------|-----------------|-----------------|----------------|
| 0 | Config & Setup | `[x]` | `[x]` | `[x]` |  
| 1A | Auth Backend | `[x]` | `[ ]` | `[x]` |
| 1B | Auth Frontend | `[x]` | `[x]` | `[x]` |
| 2A/B | Academics | `[x]` | `[ ]` | `[ ]` |
| 3A/B | Resources | `[x]` | `[ ]` | `[ ]` |
| 4A/B | Placements | `[ ]` | `[ ]` | `[ ]` |
| 5A/B | Applications | `[ ]` | `[ ]` | `[ ]` |
| 6A/B | Polish & Deploy | `[ ]` | `[ ]` | `[ ]` |

---

## Phase 0 — Completed ✅

**Date:** 2026-10-12 / 2026-10-13

**What was done:**
- Monorepo created: `CampusHub-Monorepo/`
- Next.js 16 frontend scaffolded with Tailwind + TypeScript + App Router
- Django backend scaffolded with VSA structure: `apps/accounts/`, `apps/academics/`, `apps/resources/`, `apps/placements/`, `apps/common/`
- Settings split into `config/settings/base.py`, `dev.py`, `prod.py`
- `AUTH_USER_MODEL = 'accounts.User'` set before first migration
- Custom User model with `role` field, email as USERNAME_FIELD
- Department stub model in `apps/academics/`
- PostgreSQL 18 database `campushub_db` created with `campushub_user`
- `.env` and `.env.example` configured (python-decouple)
- `makemigrations` + `migrate` ran cleanly
- Git tag `v0.1.0-setup` pushed

---

## Phase 1A — Completed ✅

**Date:** 2026-10-13 (initial) · 2026-10-14 (DRF removed, auth rewritten)

**Update 2026-10-14: DRF removed.** Auth was rewritten with plain Django
(`JsonResponse`) + PyJWT. `djangorestframework` and `djangorestframework-simplejwt`
are gone from `requirements.txt` and `INSTALLED_APPS`, and the `REST_FRAMEWORK`
settings block is deleted. The model and migrations are unchanged.

**Backend tasks:**
- [x] Custom User model with `role` field + `UserManager`
- [x] `makemigrations accounts` + `migrate` runs cleanly
- [x] `POST /api/auth/register/` — plain Django view, manual validation, always assigns `student` role
- [x] `POST /api/auth/token/` — email + password, returns access (30 min) + refresh (7 days) JWT via PyJWT
- [x] `POST /api/auth/token/refresh/` — validates refresh token, returns new access token
- [x] `GET /api/auth/me/` — returns authenticated user profile (Bearer token)
- [x] `PATCH /api/auth/me/` — updates whitelisted profile fields
- [x] `@jwt_required` decorator for protected views (in `jwt_utils.py`)
- [x] UserAdmin registered with CampusHub fieldset
- [x] Smoke-tested all endpoints (register, token, me, refresh, 401 without token)
- [ ] Auth tests (pytest-django) — deferred
- [ ] Postman collection for auth endpoints — deferred

**Files created/changed:**
- `apps/accounts/jwt_utils.py` (new: token creation/decoding, decorators)
- `apps/accounts/views.py` (rewritten, plain Django)
- `apps/accounts/urls.py` (rewritten)
- `apps/accounts/admin.py`
- `config/settings/base.py` (JWT_SECRET, JWT_ACCESS_MINUTES, JWT_REFRESH_DAYS; DRF removed)
- `config/urls.py`
- `requirements.txt` (PyJWT added, DRF packages removed)

**Files removed:**
- `apps/accounts/serializers.py`
- `apps/accounts/utils.py` (session-based `api_login_required`)

**Known gaps:** no logout/token revocation, no refresh-token rotation.

---

## Phase 1B — Completed ✅

**Date:** 2026-10-14

**What was done:**
- Installed axios for API requests
- Created `lib/api.ts` with JWT interceptors (attach token, auto-refresh on 401)
- Created `types/index.ts` for TypeScript interfaces
- Created `context/AuthContext.tsx` to manage user state, `login()`, `logout()`
- Wrapped app in AuthProvider in `layout.tsx`
- Built Login page (`/login`)
- Built Register page (`/register`) with auto-login via `AuthContext.login()`
- Built protected Dashboard page (`/dashboard`) showing full user profile
- Updated root page to redirect to `/dashboard`
- Fixed bug: dashboard used `user.full_name` but API returns `first_name` + `last_name` — patched (`27e8dac`)

**Frontend tasks:**
- [x] `src/lib/api.ts` Axios instance with JWT interceptor
- [x] `src/types/index.ts` TypeScript interfaces
- [x] Login page (`/login`)
- [x] Register page (`/register`)
- [x] Protected route wrapper
- [x] Auth context / user state management
- [x] Dashboard profile card (`/dashboard`)

**API contract:** login with `{email, password}` returns `{access, refresh}`. Send
`Authorization: Bearer <access>` on protected requests. On 401, call
`/api/auth/token/refresh/` with `{refresh}` to get a new access token.

---

## Phase 2A — Completed ✅

**Date:** 2026-10-15

**What was done:**
- Created Department, Course, and Enrollment models in apps/academics/models.py
- Implemented plain Django views (JsonResponse, csrf_exempt, require_http_methods) for:
  - GET /api/academics/departments/
  - GET /api/academics/courses/ (with ?department filter)
  - GET /api/academics/courses/<id>/
  - GET/POST /api/academics/enrollments/ (jwt_required, student role check)
  - DELETE /api/academics/enrollments/<id>/ (jwt_required, set status to dropped)
- Wired up academics URLs in config/urls.py
- Applied migrations and registered models in admin
- All endpoints tested successfully with curl

---

---

## Phase 2B — Frontend Completed ✅

**Date:** 2026-10-15
**Branch:** `feature/frontend-student-and-staff-pages`
**Commits pushed:** `548c0f1` (portal workflows), `3c2f121` (landing and registration)

**Student workflows delivered:**
- Student dashboard with active courses, course announcements, placement opportunities, and application statuses.
- My Courses page backed by `GET /api/academics/enrollments/`.
- Course detail page with course and lecturer information, resources, resource downloads, and lecturer announcements.
- Placement application form with a cover note and optional CV upload.

**Lecturer and placement workflows delivered:**
- Searchable lecturer directory; admin create, edit, deactivate, and reactivate controls.
- Placement listing page; officer/admin create, edit, and remove controls.
- Officer/admin application review table with pending, shortlisted, accepted, and rejected status updates.
- Admin overview with stats, management links, role-access summary, and recent activity.

**Shared frontend and basic security work:**
- Role-aware portal navigation and page access checks.
- Reusable paginated directory table and API response/error helpers.
- Loading, retry, error, and empty states across API-backed screens.
- Updated landing and registration pages; public sign-up is explicitly student-only and explains that staff accounts must be provisioned by an administrator.
- API client sends bearer tokens only to the configured API origin.
- Resource download links are restricted to HTTP(S) URLs on the configured API origin.

**Validation completed:**
- `npx tsc --noEmit` — passed.
- `npm run build` — passed.
- `npm run lint` — no errors; one warning remains for the existing full-page redirect in `lib/api.ts`.

**Follow-up required outside this frontend phase:**
- Integrate-test each page against the backend and align endpoint paths and payloads with the implemented API contracts.
- Implement or complete any remaining backend routes, and enforce role and ownership permissions server-side. Frontend role checks only control what the UI displays.
- Token storage remains in `localStorage`; moving to secure HttpOnly cookies requires a coordinated backend authentication change.
- The security hardening edits made after the feature commits are currently local and must be committed/pushed separately if they are to be included in the shared branch.


## Phase 3A — Completed ✅

**Date:** 2026-10-15

**What was done:**
- Created Resource and Announcement models in apps/resources/models.py
- Implemented plain Django views (JsonResponse, csrf_exempt, require_http_methods) for:
  - GET/POST /api/resources/courses/<course_id>/resources/ (jwt_required, file upload validation)
  - GET/DELETE /api/resources/courses/<course_id>/resources/<id>/ (jwt_required, uploader/admin delete)
  - GET/POST /api/resources/courses/<course_id>/announcements/ (jwt_required)
  - GET /api/resources/courses/<course_id>/announcements/<id>/ (jwt_required)
- Added permission helper functions (enrolled student / lecturer / admin)
- Wired up resources URLs in config/urls.py under /api/resources/
- Applied migrations and registered models in admin
- All endpoints tested successfully with curl (upload, list, delete)


---

## Blocker Log

| Date | Blocker | Resolution |
|------|---------|-----------|
| 2026-10-12 | `.idea/` committed to GitHub | Removed with `git rm --cached`, updated `.gitignore` |
| 2026-10-12 | `pip install uv` failed (PEP 668) | Used `python3 -m venv venv` instead |
| 2026-10-13 | `AUTH_USER_MODEL` refers to empty model | Wrote full User model + Department stub before `manage.py check` |
| 2026-10-13 | `migrate` failing — password auth error | PostgreSQL 18 on Ubuntu 26.04 listens on port **5434** (not 5432). Fix: `DB_PORT=5434` in `.env` |
| 2026-10-13 | `permission denied for schema public` | PostgreSQL 15+ removes CREATE from public schema by default. Fix: `GRANT ALL ON SCHEMA public TO campushub_user;` |
| 2026-10-14 | DRF/sessions auth pushed, but spec requires plain Django + PyJWT | Rewrote auth with PyJWT, removed DRF and session decorator |
| 2026-10-14 | Mixed Python versions (3.11 vs 3.14) across the team | Standardised on Python 3.14; recreate `.venv` with `py -3.14` |
| 2026-10-14 | `development_branch` missing `manage.py`, `config/settings/*`, models and migrations | Added in the auth commit; teammates must `git pull` |
| 2026-10-14 | `.pyc` files tracked in git, `requirements.txt` committed as UTF-16 (PowerShell `>`) | Untracked `__pycache__`; regenerate with `pip freeze \| Set-Content -Encoding ascii requirements.txt` |
| 2026-10-14 | `.env.save` with DB password accidentally committed | `git rm --cached`, rotated DB password, added `.env.save` to `.gitignore` |
| 2026-10-14 | Dashboard `Full Name` blank — used `user.full_name` but API returns `first_name` + `last_name` | Fixed in `27e8dac` — template now renders `{user.first_name} {user.last_name}` |

---

## Active Branches

| Branch | Owner | Status | PR # |
|--------|-------|--------|------|
| `main` | Both | HEAD at `27e8dac` — Phase 1A + 1B complete | — |
| `phase-2a-academics-backend` | Titus | Next — not started | — |
| `phase-2b-academics-frontend` | Mark | Blocked on 2A | — |