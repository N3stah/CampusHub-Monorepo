# CampusHub — Phase Progress Tracker

> Update this file at the end of every work session.  
> Format: `[x]` = complete · `[-]` = in progress · `[ ]` = not started

| Phase | Slice | Backend (Mark) | Frontend (Titus) | Merged to main |
|-------|-------|---------------|-------------------|----------------|
| 0 | Config & Setup | `[x]` | `[x]` | `[x]` |
| 1A/B | Auth & Users | `[-]` | `[ ]` | `[ ]` |
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
- Django backend scaffolded: `config/`, `apps/accounts/`, `apps/courses/`, `apps/placements/`
- Root `.gitignore` configured (excluding venv, .env, node_modules, .idea)
- `.idea/` PyCharm config removed from version control
- PostgreSQL 18 verified running on Ubuntu
- Python 3.14 + Node 22 confirmed
- Django 6.1.2, DRF 3.18.3, SimpleJWT 5.5.1, psycopg2-binary installed
- Initial commit pushed to `main`

**Git tag to push:** `v0.1.0-setup`

**Remaining Phase 0 tasks:**
- [ ] Rename Django apps to match VSA structure (`apps/accounts/`, `apps/academics/`, `apps/resources/`, `apps/placements/`, `apps/common/`)
- [ ] Split settings into `config/settings/base.py` · `dev.py` · `prod.py`
- [ ] Set `AUTH_USER_MODEL = 'accounts.User'` before first migration
- [ ] Create `campushub_db` PostgreSQL database
- [ ] Create `.env` and `.env.example` files
- [ ] Push git tag: `git tag v0.1.0-setup && git push origin v0.1.0-setup`

---

## Phase 1 — In Progress 🔄

**Target date:** Week 8 (Oct 5–Oct 9, 2026)

**Backend tasks (Mark):**
- [ ] Custom User model with `role` field + `UserManager`
- [ ] `makemigrations accounts` + `migrate` runs cleanly
- [ ] `POST /api/auth/register/` endpoint
- [ ] `POST /api/auth/token/` (SimpleJWT)
- [ ] `POST /api/auth/token/refresh/`
- [ ] `GET /api/auth/me/` (authenticated user profile)
- [ ] Postman collection for auth endpoints

**Frontend tasks (Partner):**
- [ ] `src/lib/api.ts` Axios instance with JWT interceptor
- [ ] `src/types/index.ts` TypeScript interfaces
- [ ] Login page (`/login`)
- [ ] Register page (`/register`)
- [ ] Protected route wrapper
- [ ] Auth context / user state management

---

## Blocker Log

> Record anything that blocked progress here so your AI assistant can help.

| Date | Blocker | Resolution |
|------|---------|-----------|
| 2026-10-12 | `.idea/` committed to GitHub | Removed with `git rm --cached`, updated `.gitignore` |
| 2026-10-12 | `pip install uv` failed (PEP 668) | Used `python3 -m venv venv` instead — correct approach |
| 2026-10-12 | Git remote URL had `< >` angle brackets | Ran `git remote add origin https://...` without brackets |

---

## Active Branches

| Branch | Owner | Status | PR # |
|--------|-------|--------|------|
| `main` | Both | Protected | — |
| `docs/erd-and-design` | Mark | Open | — |
| `feature/accounts-backend` | Mark | Not started | — |
| `feature/accounts-frontend` | Partner | Not started | — |
