# CampusHub — Phase Progress Tracker

> Update this file at the end of every work session.  
> Format: `[x]` = complete · `[-]` = in progress · `[ ]` = not started

| Phase | Slice | Backend (Mark) | Frontend (Titus) | Merged to main |
|-------|-------|---------------|-------------------|----------------|
| 0 | Config & Setup | `[x]` | `[x]` | `[x]` |
| 1A | Auth Backend | `[x]` | `[ ]` | `[ ]` |
| 1B | Auth Frontend | `[x]` | `[x]` | `[ ]` |
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

**Date:** 2026-10-13

**Backend tasks (Mark):**
- [x] Custom User model with `role` field + `UserManager`
- [x] `makemigrations accounts` + `migrate` runs cleanly
- [x] `POST /api/auth/register/` — creates user, password write-only
- [x] `POST /api/auth/token/` — returns access + refresh JWT
- [x] `POST /api/auth/token/refresh/` — wired via SimpleJWT
- [x] `GET /api/auth/me/` — returns authenticated user profile
- [x] UserAdmin registered with CampusHub fieldset
- [ ] Postman collection for auth endpoints (deferred to 1B)

**Files created:**
- `apps/accounts/serializers.py`
- `apps/accounts/views.py`
- `apps/accounts/urls.py`
- `apps/accounts/admin.py` (updated)
- `config/urls.py` (updated)

---

## Phase 1B — Completed ✅

**Date:** 2026-10-14

**What was done:**
- Installed axios for API requests
- Created lib/api.ts with JWT interceptors (attach token, auto-refresh on 401)
- Created types/index.ts for TypeScript interfaces
- Created context/AuthContext.tsx to manage user state, login(), logout()
- Wrapped app in AuthProvider in layout.tsx
- Built Login page (/login)
- Built Register page (/register) with auto-login
- Built protected Dashboard page (/dashboard)
- Updated root page to redirect to /dashboard

**Frontend tasks (Partner):**
- [x] `src/lib/api.ts` Axios instance with JWT interceptor
- [x] `src/types/index.ts` TypeScript interfaces
- [x] Login page (`/login`)
- [x] Register page (`/register`)
- [x] Protected route wrapper
- [x] Auth context / user state management

---

## Blocker Log

| Date | Blocker | Resolution |
|------|---------|-----------|
| 2026-10-12 | `.idea/` committed to GitHub | Removed with `git rm --cached`, updated `.gitignore` |
| 2026-10-12 | `pip install uv` failed (PEP 668) | Used `python3 -m venv venv` instead |
| 2026-10-13 | `AUTH_USER_MODEL` refers to empty model | Wrote full User model + Department stub before `manage.py check` |
| 2026-10-13 | `migrate` failing — password auth error | PostgreSQL 18 on Ubuntu 26.04 listens on port **5434** (not 5432). Fix: `DB_PORT=5434` in `.env` |
| 2026-10-13 | `permission denied for schema public` | PostgreSQL 15+ removes CREATE from public schema by default. Fix: `GRANT ALL ON SCHEMA public TO campushub_user;` |

---

## Active Branches

| Branch | Owner | Status | PR # |
|--------|-------|--------|------|
| `main` | Both | Protected | — |
| `docs/erd-and-design` | Mark | Open — Phase 1A committed | — |
| `feature/accounts-frontend` | Partner | Not started | — |