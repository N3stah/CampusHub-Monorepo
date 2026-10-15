# CampusHub — Phase Progress Tracker

> Update this file at the end of every work session.  
> Format: `[x]` = complete · `[-]` = in progress · `[ ]` = not started

| Phase | Slice | Backend (Mark) | Frontend (Titus) | Merged to main |
|-------|-------|---------------|-------------------|----------------|
| 0 | Config & Setup | `[x]` | `[x]` | `[x]` |
| 1A | Auth Backend | `[x]` | `[ ]` | `[x]` |
| 1B | Auth Frontend | `[x]` | `[x]` | `[x]` |
| 2A/B | Academics | `[x]` | `[-]` | `[x]` (Backend) |
| 3A/B | Resources | `[x]` | `[ ]` | `[x]` (Backend) |
| 4A/B | Placements | `[x]` | `[ ]` | `[ ]` |
| 5A/B | Applications | `[ ]` | `[ ]` | `[ ]` |
| 6A/B | Polish & Deploy | `[ ]` | `[ ]` | `[ ]` |
| Test | Auth Tests | `[x]` | `[ ]` | `[x]` |

---

## Phase 1A — Completed ✅

**Date:** 2026-10-13 (initial) · 2026-10-14 (DRF removed, auth rewritten)

**What was done:**
- Custom User model with `role` field + `UserManager`
- Rewrote auth with plain Django (`JsonResponse`) + PyJWT (removed DRF)
- `POST /api/auth/register/`, `POST /api/auth/token/`, `POST /api/auth/token/refresh/`, `GET /api/auth/me/`
- `@jwt_required` decorator for protected views
- All endpoints smoke-tested with curl

**Files changed:**
- `apps/accounts/models.py`, `apps/accounts/views.py`, `apps/accounts/urls.py`
- `apps/accounts/jwt_utils.py` (new)
- `config/settings/base.py` (DRF removed, JWT settings added)
- `requirements.txt` (PyJWT added, DRF removed)

---

## Phase 1B — Completed ✅

**Date:** 2026-10-14

**What was done:**
- Built Next.js Auth frontend (Login, Register, Dashboard)
- Axios instance with JWT interceptors (attach token, auto-refresh on 401)
- Auth Context for global user state
- Protected routes

**Files changed:**
- `campushub-frontend/src/lib/api.ts`, `src/types/index.ts`
- `campushub-frontend/src/context/AuthContext.tsx`
- `campushub-frontend/src/app/(auth)/login/page.tsx`, `register/page.tsx`
- `campushub-frontend/src/app/dashboard/page.tsx`

---

## Phase 2A — Completed ✅

**Date:** 2026-10-15

**What was done:**
- Created `Department`, `Course`, and `Enrollment` models in `apps/academics/`
- Implemented plain Django views for Academics endpoints:
  - `GET /api/academics/departments/`
  - `GET /api/academics/courses/` (with `?department` filter)
  - `GET /api/academics/courses/<id>/`
  - `GET/POST /api/academics/enrollments/` (jwt_required, student role check)
  - `DELETE /api/academics/enrollments/<id>/` (jwt_required, sets status to dropped)
- Wired up URLs in `config/urls.py` under `/api/academics/`
- Applied migrations and registered models in admin
- All endpoints tested successfully with curl

**Files changed:**
- `apps/academics/models.py`, `apps/academics/views.py`, `apps/academics/urls.py`, `apps/academics/admin.py`
- `apps/academics/migrations/0002_alter_department_options_department_head_and_more.py`
- `config/urls.py`

---

## Phase 3A — Completed ✅

**Date:** 2026-10-15

**What was done:**
- Created `Resource` and `Announcement` models in `apps/resources/`
- Implemented plain Django views for Resources endpoints:
  - `GET/POST /api/resources/courses/<course_id>/resources/` (jwt_required, file upload validation)
  - `GET/DELETE /api/resources/courses/<course_id>/resources/<id>/` (jwt_required, uploader/admin delete)
  - `GET/POST /api/resources/courses/<course_id>/announcements/` (jwt_required)
  - `GET /api/resources/courses/<course_id>/announcements/<id>/` (jwt_required)
- Added permission helper functions (enrolled student / lecturer / admin)
- Wired up resources URLs in `config/urls.py` under `/api/resources/`
- Applied migrations and registered models in admin
- Tested upload, list, and delete with curl
- *Fix:* Added missing `models.py` file that was accidentally left out of the initial commit

**Files changed:**
- `apps/resources/models.py`, `apps/resources/views.py`, `apps/resources/urls.py`, `apps/resources/admin.py`
- `apps/resources/migrations/0001_initial.py`
- `config/urls.py`

---

## Phase 2B — Frontend Completed ✅

**Date:** 2026-10-15
**Branch:** `feature/frontend-student-and-staff-pages`

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

## Auth Testing — Completed ✅

**Date:** 2026-10-15

**What was done:**
- Configured `pytest-django` and `pytest-cov`
- Wrote 16 test cases covering all success/error paths for Auth endpoints
- Achieved 90% code coverage for `apps/accounts`
- Created Postman collection (`CampusHub_Auth.postman_collection.json`) with automated variable saving for tokens

**Files changed:**
- `campushub-backend/pytest.ini`
- `apps/accounts/tests/test_auth.py`
- `docs/CampusHub_Auth.postman_collection.json`

---

## Phase 4A — Completed ✅

**Date:** 2026-10-15

**What was done:**
- Created Placement and Application models in apps/placements/models.py
- Added custom validator  in validators.py
- Implemented ApplicationService with  and  to prevent race conditions during application submission
- Implemented 8 plain Django endpoints:
  - GET/POST /api/placements/ (officer/admin create)
  - GET/PATCH/DELETE /api/placements/<id>/ (officer/admin update/soft-delete)
  - POST /api/placements/<id>/apply/ (student only, calls ApplicationService.submit)
  - GET /api/applications/ (students see own, officers see their posted placements, admins see all)
  - PATCH /api/applications/<id>/status/ (officer/admin only, calls ApplicationService.update_status)
- Enforced complex business rules:
  -  cannot be reduced below active application count during PATCH.
  - Active applications (pending/shortlisted/accepted) are counted against slots.
  - Officers can only update applications for placements they posted.
- All 12 curl smoke tests passed (create, apply, duplicate prevention, status update, role enforcement).

**Files changed:**
- , , 
- , , 
- 
- 

---

---

## Blocker Log

| Date | Blocker | Resolution |
|------|---------|-----------|
| 2026-10-12 | `pip install uv` failed (PEP 668) | Used `python3 -m venv venv` instead |
| 2026-10-13 | `AUTH_USER_MODEL` refers to empty model | Wrote full User model + Department stub before `manage.py check` |
| 2026-10-13 | `migrate` failing — password auth error | PostgreSQL 18 on Ubuntu 26.04 listens on port **5434** (not 5432). Fix: `DB_PORT=5434` in `.env` |
| 2026-10-13 | `permission denied for schema public` | PostgreSQL 15+ removes CREATE from public schema by default. Fix: `GRANT ALL ON SCHEMA public TO campushub_user;` |
| 2026-10-14 | DRF/sessions auth pushed, but spec requires plain Django + PyJWT | Rewrote auth with PyJWT, removed DRF and session decorator |
| 2026-10-14 | Mixed Python versions (3.11 vs 3.14) across the team | Standardised on Python 3.14; recreate `.venv` with `py -3.14` |
| 2026-10-15 | `pytest` failed: `permission denied to create database` | Fix: `sudo -u postgres psql -c "ALTER USER campushub_user CREATEDB;"` |
| 2026-10-15 | Postman `Register User` returning 400 Bad Request | User already existed from curl tests. Fix: Used a fresh email in the Postman collection JSON |
| 2026-10-15 | Frontend branch had `ImportError: cannot import name 'Resource'` | Phase 3A commit missed `apps/resources/models.py`. Fix: Created `fix/resources-models-and-requirements` branch, added file, merged to main |

---

## Active Branches

| Branch | Owner | Status | PR # |
|--------|-------|--------|------|
| `main` | Both | HEAD at `9ffdd55` — Phase 3A Backend + Tests complete | — |
| `feature/frontend-student-and-staff-pages` | Titus | Phase 2B Frontend (In Progress) | — |
