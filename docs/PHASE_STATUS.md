# CampusHub — Phase Progress Tracker

> Update this file at the end of every work session.  
> Format: `[x]` = complete · `[-]` = in progress · `[ ]` = not started

| Phase | Slice | Backend (Mark) | Frontend (Titus) | Merged to main |
|-------|-------|---------------|-------------------|----------------|
| 0 | Config & Setup | `[x]` | `[x]` | `[x]` |
| 1A | Auth Backend | `[x]` | `[ ]` | `[ ]` |
| 1B | Auth Frontend | `[ ]` | `[ ]` | `[ ]` |
| 2A/B | Academics | `[ ]` | `[ ]` | `[ ]` |
| 3A/B | Resources | `[ ]` | `[ ]` | `[ ]` |
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
- [x] `@jwt_required` and `@role_required` decorators for protected views
- [x] UserAdmin registered with CampusHub fieldset
- [x] Smoke-tested all endpoints (register, token, me, refresh, 401 without token)
- [ ] Auth tests (pytest-django)
- [ ] Postman collection for auth endpoints (deferred to 1B)

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

## Phase 1B — Not Started

**Frontend tasks (Partner):**
- [ ] `src/lib/api.ts` Axios instance with JWT interceptor
- [ ] `src/types/index.ts` TypeScript interfaces
- [ ] Login page (`/login`)
- [ ] Register page (`/register`)
- [ ] Protected route wrapper
- [ ] Auth context / user state management

**API contract:** login with `{email, password}` returns `{access, refresh}`. Send
`Authorization: Bearer <access>` on protected requests. On 401, call
`/api/auth/token/refresh/` with `{refresh}` to get a new access token.

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

---

## Active Branches

| Branch | Owner | Status | PR # |
|--------|-------|--------|------|
| `main` | Both | Protected | — |
| `development_branch` | Both | Active — Phase 1A (plain Django + PyJWT) pushed | — |
| `docs/erd-and-design` | Mark | Open — Phase 1A committed | — |
| `feature/accounts-frontend` | Partner | Not started | — |
