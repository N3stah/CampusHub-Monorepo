# CampusHub — Phase Progress Tracker

> Update this file at the end of every work session.  
> Format: `[x]` = complete · `[-]` = in progress · `[ ]` = not started

| Phase | Slice | Backend (Mark) | Frontend (Titus) | Merged to main |
|-------|-------|---------------|-------------------|----------------|
| 0 | Config & Setup | `[x]` | `[x]` | `[x]` |
| 1A | Auth Backend | `[x]` | `[ ]` | `[x]` |
| 1B | Auth Frontend | `[x]` | `[x]` | `[x]` |
| 2A/B | Academics | `[x]` | `[x]` | `[x]` |
| 3A/B | Resources | `[x]` | `[x]` | `[x]` |
| 4A/B | Placements | `[x]` | `[x]` | `[x]` |
| 5A/B | Applications | `[x]` | `[x]` | `[x]` |
| 6A/B | Polish & Deploy | `[ ]` | `[ ]` | `[ ]` |
| Test | Auth Tests | `[x]` | `[ ]` | `[x]` |
| MVP | Role-based accounts & endpoint integration | `[x]` | `[x]` | `[ ]` (`development_branch`) |

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

## Phase 2B — Completed ✅

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
- Updated landing and registration pages; public sign-up is student-only.
- API client sends bearer tokens only to the configured API origin.
- Resource download links restricted to HTTP(S) URLs on the configured API origin.

**Validation completed:**
- `npx tsc --noEmit` — passed.
- `npm run build` — passed.
- `npm run lint` — no errors.

**Follow-up required:**
- Run end-to-end browser integration against the team's configured PostgreSQL database.
- Token storage in `localStorage` — move to HttpOnly cookies requires coordinated backend change.
- Continue production security hardening; the role-based access and resource-download checks delivered so far are recorded in the MVP section below.

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
- *Fix:* Added missing `models.py` file accidentally left out of initial commit

**Files changed:**
- `apps/resources/models.py`, `apps/resources/views.py`, `apps/resources/urls.py`, `apps/resources/admin.py`
- `apps/resources/migrations/0001_initial.py`
- `config/urls.py`

---

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
- Created `Placement` and `Application` models in `apps/placements/models.py`
- Added `deadline_must_be_future` custom validator in `apps/placements/validators.py`
- Implemented `ApplicationService` with `@transaction.atomic` + `select_for_update()` to prevent race conditions during concurrent application submission
- Active applications (pending/shortlisted/accepted) counted against `slots_available` — rejected applications free up slots automatically
- Implemented 8 plain Django endpoints:
  - `GET/POST /api/placements/` (officer/admin create)
  - `GET/PATCH/DELETE /api/placements/<id>/` (officer/admin update/soft-delete)
  - `POST /api/placements/<id>/apply/` (student only, calls `ApplicationService.submit`)
  - `GET /api/applications/` (students see own; officers see their placements'; admins see all)
  - `PATCH /api/applications/<id>/status/` (officer/admin, calls `ApplicationService.update_status`)
- Complex business rules enforced:
  - `slots_available` cannot be reduced below active application count during `PATCH`
  - `UNIQUE(student, placement)` constraint at DB level prevents duplicate applications
  - Officers can only update applications for placements they personally posted
- All 12 curl smoke tests passed (create, apply, duplicate prevention, status update, role enforcement)
- Committed and merged to main

**Files changed:**
- `apps/placements/models.py`, `apps/placements/validators.py`, `apps/placements/services.py`
- `apps/placements/views.py`, `apps/placements/urls.py`, `apps/placements/admin.py`
- `apps/placements/migrations/0001_initial.py`
- `config/urls.py`

---

## MVP — Role-based Accounts and Core Workflows — Completed on `development_branch`

**Updated:** 2026-10-16
**Latest commit:** `d69be6c` (standalone bootstrap refactor)

**Backend and access-control work delivered:**
- Public registration always creates a `student`; it never trusts a client-supplied role. Supported application roles are `student`, `lecturer`, `officer` (placement officer), and `admin`.
- Admin-only `GET/POST /api/users/` and `GET/PATCH/DELETE /api/users/<id>/` support account search, role assignment, profile updates, password changes, and safe soft-deactivation/reactivation. Deactivation preserves related records; self-deactivation and removal/demotion of the last active superuser are blocked.
- Placement officers can read student accounts only. They cannot create, update, or deactivate accounts.
- Lecturer directory endpoints support list/create/detail/update; only admins may create or update lecturer profiles. Lecturer data includes department, course list, title, bio, and office hours.
- `GET /api/admin/stats/` provides admin overview counts and `GET /api/admin/logs/` returns recent audit activity. Account, lecturer, placement, and application changes write audit events.
- User management is mounted under `/api/`; authentication remains under `/api/auth/`.
- `UserManager.create_superuser()` defaults to the application `admin` role and enforces Django staff/superuser flags. Admin-role accounts created through user management are not automatically Django superusers.
- The one-off `campushub-backend/create_admin.py` script is local-only and git-ignored. When present beside `manage.py`, run `python create_admin.py`; it securely prompts for credentials, supports explicit promotion of an existing account, and recognizes an already configured bootstrap admin. It is not included in a clone. Without that local file, use `python manage.py createsuperuser`.

**Frontend and endpoint integration delivered:**
- The `/users` admin screen creates accounts for all four roles and supports editing, deactivation, and reactivation. Lecturer directory and `/admin` overview/activity screens are connected to their backend APIs.
- Student course pages support enrollment and dropping courses, course resources and announcements, and lecturer details. Placement listings support student applications and officer/admin management and application review.
- Placement create/update fields now match the backend contract (`requirements`, `slots_available`); application submission uses multipart cover-note and optional CV fields. Slot values are validated and cannot be reduced below active application counts.
- User-facing API requests and forms display loading, empty, success, and error states; role-aware navigation and page access checks are in place.
- The previous endpoint/payload integration follow-up is resolved for the course-resource, announcement, placement, and application flows covered by this MVP. Full live-browser verification against PostgreSQL remains outstanding.

**Database, testing, and validation:**
- Added account migrations for lecturer profile fields and audit events.
- Backend tests use isolated SQLite settings in `config.settings.test`; pytest discovery is configured in `campushub-backend/pytest.ini`.
- Validation on the pushed branch: **35 backend tests passed**; Django system check passed; `makemigrations --check --dry-run` reported no pending migrations; all migrations applied successfully using the SQLite test settings.
- Frontend TypeScript check and production build passed. ESLint passed with one existing Next.js navigation warning in `src/lib/api.ts`.
- `npm ci` reported five high-severity audit findings during setup; package manifests were not changed and those findings have not been reviewed.

**Setup and smoke test:**
1. From `campushub-backend`, run `python manage.py migrate`.
2. If the local-only standalone script is present, run `python create_admin.py` and follow the prompts. Otherwise run `python manage.py createsuperuser`.
3. Start Django, then sign in through `/login` with the bootstrapped email/password.
4. Open **User accounts** and create student, lecturer, placement-officer, and admin-role accounts. The initial bootstrap admin is the only one with Django superuser access; role-created admins have CampusHub admin access only.
5. Verify the account roles by logging in as each user; deactivate/reactivate accounts from the admin user directory as needed.
6. Run `pytest` for the isolated backend test suite.

## What Should Be Implemented — Backend Endpoints for Frontend CRUD

The endpoints below are the next backend API work needed to give future management screens complete CRUD support. Existing endpoints are listed to show what the frontend can already call; **Pending** marks work not currently provided by the backend on `development_branch`. Keep the existing `/api/` route prefix and plain Django/PyJWT conventions.

| Feature / frontend workflow | Existing backend endpoints | Pending backend endpoints |
|---|---|---|
| Departments — admin department management | `GET /api/academics/departments/` | `POST /api/academics/departments/`, `GET/PATCH/DELETE /api/academics/departments/<id>/`. Restrict writes/deactivation to admins and validate unique department codes and department-head references. |
| Courses — admin/lecturer course management | `GET /api/academics/courses/`, `GET /api/academics/courses/<id>/` | `POST /api/academics/courses/`, `PATCH/DELETE /api/academics/courses/<id>/`. Restrict writes to admins (and lecturer assignment/update only if explicitly allowed); validate department and lecturer references. Prefer deactivation over hard deletion when courses have enrollments or resources. |
| Course enrollments — student enrollment and course rosters | `GET/POST /api/academics/enrollments/`, `DELETE /api/academics/enrollments/<id>/` (student's own enrollments; delete marks dropped) | For staff roster screens, add a permission-checked `GET /api/academics/courses/<id>/enrollments/` for the assigned lecturer/admin. Add staff enrollment status changes only if the frontend requires them; students must not read or change another student's enrollment. |
| Course resources — lecturer/admin content management | `GET/POST /api/resources/courses/<course_id>/resources/`, `GET/DELETE /api/resources/courses/<course_id>/resources/<id>/` | Add `PATCH /api/resources/courses/<course_id>/resources/<id>/` to edit title/description and optionally replace the uploaded file. Preserve upload validation, delete the replaced stored file safely, and allow changes only to the uploader/assigned lecturer or admin. |
| Announcements — lecturer/admin content management | `GET/POST /api/resources/courses/<course_id>/announcements/`, `GET /api/resources/courses/<course_id>/announcements/<id>/` | Add `PATCH/DELETE /api/resources/courses/<course_id>/announcements/<id>/`. Allow changes only to the author/assigned lecturer or admin; keep enrolled-student read access. |
| Placements — officer/admin opportunity management | `GET/POST /api/placements/`, `GET/PATCH/DELETE /api/placements/<id>/` | Core CRUD is present. Before adding more routes, verify the existing role checks, field validation, and soft-delete behavior against all frontend create/edit/remove forms. |
| Applications — student application tracking and staff review | `GET /api/applications/`, `POST /api/placements/<id>/apply/`, `PATCH /api/applications/<id>/status/` | Add `GET /api/applications/<id>/` with student-owner and assigned officer/admin checks. If students can withdraw applications in the UI, add `DELETE /api/applications/<id>/` as a controlled withdrawal (not a hard delete); retain the audit trail and slot-count rules. |
| User accounts and lecturers — admin account management | `GET/POST /api/users/`, `GET/PATCH/DELETE /api/users/<id>/`, `GET/POST /api/lecturers/`, `GET/PATCH /api/lecturers/<id>/` | Core account workflows exist. Confirm lecturer deactivation via `PATCH is_active`; keep user deactivation soft and protect the last active superuser. Do not expose public role assignment. |

For each pending endpoint, implement request/response validation, authentication and role/object-level authorization, consistent JSON errors, audit events for writes, and focused tests for allowed and denied roles. Add the endpoint to its app URL config and update the matching frontend form/query only when that frontend workflow is in scope. Hard deletion should not remove records that are referenced by enrollments, applications, uploaded files, or audit events.

**Remaining beyond the MVP:**
- Run migrations and role/login tests against the team's actual PostgreSQL database, then verify student, lecturer, officer, and admin workflows with seeded accounts in a live browser.
- Add pagination, password reset/email invitation flows, and production hardening for audit events before production use.

## Blocker Log

| Date | Blocker | Resolution |
|------|---------|-----------|
| 2026-10-12 | `pip install uv` failed (PEP 668) | Used `python3 -m venv venv` instead |
| 2026-10-13 | `AUTH_USER_MODEL` refers to empty model | Wrote full User model + Department stub before `manage.py check` |
| 2026-10-13 | `migrate` failing — password auth error | PostgreSQL 18 on Ubuntu 26.04 listens on port **5434** (not 5432). Fix: `DB_PORT=5434` in `.env` |
| 2026-10-13 | `permission denied for schema public` | PostgreSQL 15+ removes CREATE from public schema by default. Fix: `GRANT ALL ON SCHEMA public TO campushub_user;` |
| 2026-10-14 | DRF/sessions auth pushed, but spec requires plain Django + PyJWT | Rewrote auth with PyJWT, removed DRF and session decorator |
| 2026-10-14 | Mixed Python versions (3.11 vs 3.14) across the team | Standardised on Python 3.14; recreate `.venv` with `py -3.14` |
| 2026-10-15 | `pytest` failed: `permission denied to create database` | Fix: `sudo -u postgres psql -p 5434 -c "ALTER USER campushub_user CREATEDB;"` |
| 2026-10-15 | Postman `Register User` returning 400 Bad Request | User already existed from curl tests. Fix: Used a fresh email in the Postman collection JSON |
| 2026-10-15 | Frontend branch had `ImportError: cannot import name 'Resource'` | Phase 3A commit missed `apps/resources/models.py`. Fix: Created `fix/resources-models-and-requirements` branch, added file, merged to main |

---

## Active Branches

| Branch | Owner | Status | PR # |
|--------|-------|--------|------|
| `main` | Both | `4b134d8` — last integrated base; role-based MVP awaits merge | — |
| `development_branch` | Both | `d69be6c` — role-based MVP and standalone-bootstrap documentation pushed; ready to merge | — |

## Frontend/backend endpoint verification — 2026-10-19

Compared the frontend calls and backend URL configuration on `development_branch` with safe requests to `http://127.0.0.1:8000`. The live API responded during the initial probes, but was unavailable on a subsequent check. No valid bearer token was available, and no application data was created or changed.

### 🟢 Responses observed

- `GET /api/academics/departments/`, `GET /api/academics/courses/`, and `GET /api/academics/courses/1/` returned `200` with JSON data.
- Empty-payload validation probes to `POST /api/auth/register/`, `POST /api/auth/token/`, and `POST /api/auth/token/refresh/` returned `400`, confirming those routes responded without creating records.
- Unauthenticated requests to `GET /api/auth/me/`, `GET /api/academics/enrollments/`, and registered resource/announcement list routes returned `401 Authentication required`. This confirms the authentication guard responds; it does not verify authenticated access or successful data operations.

### <span style="color: #d1242f">🔴 Live API route mismatches to investigate</span>

The following safe `GET` requests to the live API returned `404`, although their routes are registered on `development_branch`. This points to a mismatch between the running API at `127.0.0.1:8000` and the checked-out development-branch source (for example, a stale server process, different deployed revision, or URL configuration); it does **not** mean these routes are absent from `development_branch`.

| Live request | Development-branch route |
|---|---|
| `GET /api/placements/` | `GET/POST /api/placements/` |
| `GET /api/users/` | `GET/POST /api/users/` |
| `GET /api/lecturers/` | `GET/POST /api/lecturers/` |
| `GET /api/lecturers/1/` | `GET/PATCH /api/lecturers/<id>/` |
| `GET /api/applications/` | `GET /api/applications/` |
| `GET /api/admin/stats/` | `GET /api/admin/stats/` |
| `GET /api/admin/logs/` | `GET /api/admin/logs/` |

**Follow-up:** restart or identify the API process serving port `8000`, confirm its code revision and `ROOT_URLCONF`, then repeat these safe GET checks against the development-branch server. Do not add duplicate backend routes until this deployment/source mismatch is resolved.

### Not verified end-to-end

- Authenticated success responses, role/ownership permissions, and writes (including placement/application submissions and status updates) were not tested.
- The frontend uses `PATCH /api/applications/<id>/status/`; the development-branch URL configuration registers that method. It was not called because it changes data.
- The live API later refused connections. Backend tests and `manage.py check` could not run in the available Python environment because Django is not installed there.
