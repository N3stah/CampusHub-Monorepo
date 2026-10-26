# CampusHub — Phase Progress Tracker

> Update this file at the end of every work session.  
> Format: `[x]` = complete · `[-]` = in progress · `[ ]` = not started

**Last updated:** 2026-10-21 · **Backend:** complete and deployed to Render · **Frontend (Titus):** in progress

| Phase | Slice | Backend (Mark) | Frontend (Titus) | Merged to main |
|-------|-------|---------------|-------------------|----------------|
| 0 | Config & Setup | `[x]` | `[x]` | `[x]` |
| 1A | Auth Backend | `[x]` | `[ ]` | `[x]` |
| 1B | Auth Frontend | `[x]` | `[x]` | `[x]` |
| 2A/B | Academics | `[x]` | `[x]` | `[x]` |
| 3A/B | Resources | `[x]` | `[x]` | `[x]` |
| 4A/B | Placements & Applications | `[x]` | `[x]` | `[x]` |
| 5A/B | Notifications | `[x]` | `[x]` | `[x]` |
| Test | Auth Tests | `[x]` | `[ ]` | `[x]` |
| MVP | Role-based accounts & endpoint integration | `[x]` | `[x]` | `[x]` |
| Fix | Fix & Review (post-MVP cleanup) | `[x]` | n/a | `[x]` |
| Hotfix | Restore dropped `user_urls` include | `[x]` | n/a | `[x]` |
| Deploy-prep | Pre-deploy hardening | `[x]` | n/a | `[x]` |
| Completion | Backend completion (Groups A–D) | `[-]` Groups A, C, D done · Group B partial | n/a | `[x]` |
| 6A | Deploy backend to Render | `[x]` | n/a | `[x]` |
| 6B | Frontend polish & deploy to Vercel | n/a | `[-]` | `[ ]` |

---

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

---

## Post-MVP Fix & Review — Completed ✅

**Date:** 2026-10-18 to 2026-10-19

- Reviewed the frontend-driven backend changes and cleaned up the issues found (duplicate test modules, an unreachable `except json.JSONDecodeError` that was shadowed by `except ValueError` in `update_application_status`, and an empty-body crash, now `json.loads(request.body or b'{}')`).
- Notifications `mark_all_read` raised a `TypeError` by unpacking the integer returned by `.update()`. Fixed in `6ba6e62`.

## Phase 5A — Notifications — Completed ✅

- `Notification` model (recipient CASCADE, actor SET_NULL, verb, message, link, is_read, created_at) with the composite index `(recipient, is_read, -created_at)`.
- `NotificationService.notify()` with a 5-minute dedupe window, and `notify_bulk()` using `bulk_create`.
- Hooks on resource creation, announcement creation and application status changes.
- Endpoints: list (`?unread=true`), unread count, mark one read, mark all read.

## Hotfix — dropped `user_urls` include — Completed ✅

Phase 5A commit `9dbea41` removed the `user_urls` include from `config/urls.py`, so `/api/users/`, `/api/lecturers/` and `/api/admin/stats|logs/` returned 404 on `main`. Restored in `57cd8f9`. `apps/common/tests/test_reachability.py` now hits every mounted route group so this class of regression fails the test suite.

## Pre-Deploy Hardening — Completed ✅

- `apps/common/api_root.py`: single `API_URL_GROUPS` list (plus `/api/health/` and the status-code constants). `config/urls.py` consumes it.
- Custom JSON `handler500/404/403` in `apps/common/error_views.py` (no HTML error pages).
- `django-ratelimit` on `register` and `token` (10/min per IP) with JSON 429.
- Console `LOGGING`, WhiteNoise placed directly after `SecurityMiddleware`, `CSRF_TRUSTED_ORIGINS` and CORS configured from environment variables in `prod.py`.
- N+1 queries removed from the resource and announcement lists (`select_related`).
- Production: `DEBUG=False`, HSTS (1 year), SSL redirect, secure cookies.

## Backend Completion — Groups A–D

**Group A — missing features: done**
- `GET /api/resources/courses/<course_id>/resources/<id>/download/` with an atomic `F('download_count') + 1` (new `download_count` column and migration).
- `Announcement.is_pinned` with `ordering = ['-is_pinned', '-created_at']`.
- `GET /api/applications/<id>/` and `DELETE /api/applications/<id>/withdraw/` (owning student, pending only), which sets the new `withdrawn` status. Withdrawn applications do not count against the slot total.
- CRUD added: departments (list/create, detail/update/delete), courses (list/create, detail/update/delete), `courses/<id>/roster/`, resource update, announcement update/delete, and head-of-department assignment.
- `/api/auth/me/` deliberately does **not** accept `gpa`. GPA is admin-editable only, to prevent falsified shortlisting data.

**Group C — integrity: done**
- DB constraints: `user_gpa_range`, `user_valid_role`, `placement_slots_gte_1`, `unique_student_placement`, `application_valid_status`.
- Indexes: Enrollment(course, status), Resource(course, -created_at), Application(placement, status), Application(student, -applied_at), Notification(recipient, is_read, -created_at).
- Empty `tests.py` stubs removed (they conflicted with the `tests/` packages).

**Group D — documentation: done**
- `docs/ERD.md` v2.1 matches the real models (real table names, `head_id`, `status`, `created_at`, notifications and audit tables, fenced Mermaid diagram, SQL embedded from the verified files).
- `docs/sql/01..04_*.sql` execute against a seeded database.
- `docs/openapi.json` is hand-written and lists all 34 paths (no DRF).

**Group B — partial**
- Done: `import_students`, `cleanup_notifications --days N`, `seed_data` (idempotent), `docs/openapi.json`.
- **Not done:** the SOLID service layer from the capstone brief. Only `ApplicationService` and `NotificationService` exist. There is no `BaseService`, `ResourceService`, `EnrollmentService` or `Notifier` interface, so resource and enrollment logic still lives in the views.
- **Not done:** pagination and `?search=` filtering. `apps/common/pagination.py` defines `paginate_queryset`, but no view calls it. Lists return `{"count", "results"}` unpaged.
- Coverage is below the target (see Testing results).

## Phase 6A — Deploy Backend — Completed ✅

**Date:** 2026-10-21

- Backend deployed to Render: `https://campushub-backend-nbgc.onrender.com`.
- Verified: `curl https://campushub-backend-nbgc.onrender.com/api/health/` returns `{"status": "ok"}`.
- Gunicorn + Procfile, WhiteNoise for static files, a PostgreSQL database, secrets supplied only through Render environment variables (`.env` is never committed).
- Required environment variables: `SECRET_KEY`, `JWT_SECRET`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `DB_*`.
- Frontend (Titus) deploys to Vercel and must point `NEXT_PUBLIC_API_URL` at the Render URL. Add the Vercel domain to `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` on Render.

## Testing results — 2026-10-21

- `python manage.py check`: 0 issues. `makemigrations --check --dry-run`: no changes.
- `pytest`: **37 passed**, total coverage **63%** (the capstone brief requires 60% or more).
- Weak spots: `academics/views` 18%, `resources/views` 20%, the three management commands, `pagination.py` and `error_views.py` at 0%. The Group A endpoints have no tests yet.
- `check --deploy`: only the two optional HSTS warnings (`SECURE_HSTS_INCLUDE_SUBDOMAINS`, `SECURE_HSTS_PRELOAD`).

## Known limitations

- Uploads are validated by extension and size only (no MIME sniffing).
- Uploaded media is stored on the local filesystem. Render's disk is ephemeral, so uploaded files are lost on redeploy until object storage (S3/Cloudinary) is configured.
- Rate limits are per worker process (default local-memory cache). The django-ratelimit cache checks are silenced in settings.
- `seed_data` creates accounts with hard-coded passwords, including a superuser, and has no production guard. Do not run it on Render, or delete those accounts afterwards.
- Tokens are stored in `localStorage` on the frontend (HttpOnly cookies would need a coordinated change).
- Enrollment has no `semester`, so re-enrolling in a later term is not supported.
- The Postman collection covers Auth only.

## Next steps

1. Titus: finish frontend polish and deploy to Vercel; set the CORS and CSRF origins on Render.
2. Mark: raise coverage (academics, resources, placements, commands, Group A endpoints) toward 80%.
3. Mark: guard `seed_data` (refuse when `DEBUG` is false unless `--force`, passwords from environment variables).
4. Mark: add persistent media storage, or document the limitation in the demo.
5. Mark (optional): apply pagination/search to the list views and extract `ResourceService` and `EnrollmentService`.
6. Both: run a full browser walkthrough of all four roles against the deployed stack, then the final demo.

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
| 2026-10-15 | `pytest` failed: `permission denied to create database` | Fix: `sudo -u postgres psql -p 5434 -c "ALTER USER campushub_user CREATEDB;"` |
| 2026-10-15 | Postman `Register User` returning 400 Bad Request | User already existed from curl tests. Fix: Used a fresh email in the Postman collection JSON |
| 2026-10-15 | Frontend branch had `ImportError: cannot import name 'Resource'` | Phase 3A commit missed `apps/resources/models.py`. Fix: Created `fix/resources-models-and-requirements` branch, added file, merged to main |
| 2026-10-18 | Claimed deletion of `apps/accounts/tests.py` in commit `97504a0` never happened (diffing the commit showed it) | Deleted the stubs properly in a later fix pass; `find apps -name tests.py` is now empty |
| 2026-10-19 | Phase 5A commit `9dbea41` dropped the `user_urls` include; user-management API returned 404 | Restored in `57cd8f9`; added `test_reachability.py` covering every mounted route group |
| 2026-10-19 | `mark_all_read` `TypeError` (unpacked the int returned by `.update()`) | Fixed in `6ba6e62` |
| 2026-10-20 | An external audit claimed `Resource.download_count` already existed | It did not. Added the field plus a migration in the completion pass |
| 2026-10-20 | Audit called the missing `gpa` whitelist on `/api/auth/me/` a bug | Rejected: GPA stays admin-editable only to prevent falsification; a test asserts it |
| 2026-10-21 | Render's disk is ephemeral, so uploaded media is lost on redeploy | Documented under Known limitations; persistent object storage is a next step |

---

## Active Branches

| Branch | Owner | Status | PR # |
|--------|-------|--------|------|
| `main` | Both | `acb601e` — backend complete and deployed to Render | — |

---

## Testing Architecture Note

**Date:** 2026-10-15

Tests run against in-memory SQLite (`config.settings.test`), not the dev
PostgreSQL database. Run `python manage.py test` against real Postgres
(after `ALTER USER campushub_user CREATEDB;`) only if you need to verify
Postgres-specific behavior (e.g. a raw SQL query, a DB-level constraint).

## Frontend/backend endpoint verification — 2026-10-19

Compared frontend API calls and backend URL configuration with safe requests to `http://127.0.0.1:8000`. The live API responded during initial probes but was unavailable on a later check. No valid bearer token was available, and no application data was created or changed.

### 🟢 Responses observed

- `GET /api/academics/departments/`, `GET /api/academics/courses/`, and `GET /api/academics/courses/1/` returned `200` with JSON data.
- Empty-payload validation probes to `POST /api/auth/register/`, `POST /api/auth/token/`, and `POST /api/auth/token/refresh/` returned `400`; these did not create records.
- Unauthenticated requests to `GET /api/auth/me/`, `GET /api/academics/enrollments/`, and registered resource/announcement list routes returned `401 Authentication required`. This confirms the authentication guard responded, not that authenticated access or successful operations work.

### <span style="color: #d1242f">🔴 Live API route mismatches to investigate</span>

The following safe `GET` requests returned `404` from the live API, while the routes were present in the development-branch source inspected at the time. This indicates a mismatch between the running service and source branch/revision; it does **not** establish that the endpoints need to be implemented again.

| Live request | Route registered in development-branch source |
|---|---|
| `GET /api/placements/` | `GET/POST /api/placements/` |
| `GET /api/users/` | `GET/POST /api/users/` |
| `GET /api/lecturers/` | `GET/POST /api/lecturers/` |
| `GET /api/lecturers/1/` | `GET/PATCH /api/lecturers/<id>/` |
| `GET /api/applications/` | `GET /api/applications/` |
| `GET /api/admin/stats/` | `GET /api/admin/stats/` |
| `GET /api/admin/logs/` | `GET /api/admin/logs/` |

**Follow-up:** identify which process/revision serves port `8000`, confirm its URL configuration, and repeat the GET checks against that running version. Do not add duplicate routes until the discrepancy is resolved.

## Frontend Notifications — Completed — 2026-10-19

- Added a signed-in notifications page wired to the existing notification list, unread-count, mark-read, and mark-all-read endpoints.
- Added notification navigation for student, lecturer, officer, and admin roles, with unread counts, loading/error/retry states, and safe internal links.
- No backend changes were made.
- Validation: `npx tsc --noEmit` and `npm run build` passed; `npm run lint` passed with one existing warning in `src/lib/api.ts`.

## Frontend workflow completion — 2026-10-26

- Added placement detail and dedicated application-form pages, closing the frontend route gaps for `/placements/<id>/` and `/placements/<id>/apply/`.
- Added a student applications page for tracking decisions and withdrawing pending applications, plus an application detail page for reviewing submission details.
- Added placement-staff application navigation and CV download controls using the existing `cv_file` URL returned by the API. No backend changes were made.
- Updated student course-resource downloads to use the existing authenticated resource download endpoint.
- Connected placement and application links in lists, dashboards, and notification messages; updated role-based navigation.
- The follow-up added self-service profile editing through `/api/auth/me/`, a lecturer/admin roster view using `/api/academics/courses/<id>/roster/`, and lecturer directory access consistent with the API's read permissions.
- Added course catalog search and pagination; directory listings now handle numeric API page links, client-side pagination for full-list endpoints, and mobile card layouts.
- Added Vitest/Testing Library coverage for role policies, profile edits, student withdrawal, staff status updates, multipart application submission, file validation/download safety, and list pagination.
- Cherry-picked the verified Next.js security upgrade into the current branch as `2c07e17` (Next.js 16.4.0 → 16.4.3).
- Validation on the current checkout: `npm run test` passed (15 tests); `npx tsc --noEmit` passed; `npm run build` passed; `npm audit` reported zero vulnerabilities. ESLint reports no errors and one existing navigation warning in `src/lib/api.ts`.

### Not verified end-to-end

- Browser integration tests use mocked API responses; successful authenticated workflows have not been exercised against the running PostgreSQL-backed API with real accounts for each role.
- The earlier live API probe found route mismatches between the running service and the inspected source. Confirm the deployed process/revision before repeating role-by-role smoke tests.

## Backend follow-up after frontend workflow work — 2026-10-26

The frontend now consumes the existing profile, roster, application, resource, and placement routes. The following items are backend work or API verification; the endpoints marked **existing** should be tested/fixed rather than re-created.

| Priority | Backend follow-up | Current source evidence / expected contract |
|---|---|---|
| P0 | Protect applicant CVs | `GET /api/applications/` returns an absolute `cv_file` media URL. Add an authenticated download endpoint or private storage authorization so only the applicant, the officer who owns the placement, and admins can download. Ensure a direct `/media/cvs/...` URL cannot bypass these checks; test allowed and denied roles. |
| P0 | Verify live deployment route/revision | The 2026-10-19 probe observed 404s for registered source routes. Identify the running process/revision and repeat authenticated role tests against it before assuming routes are missing. |
| P1 | Enforce current enrollment on course files | Resource view/download permission currently checks whether an enrollment record exists. Confirm dropped enrollments should lose access, and restrict reads/downloads to active enrollments if required by school policy. Add tests for active, dropped, unrelated student, assigned lecturer, and admin. |
| P1 | Restore/manage closed placements | Placement list currently returns active listings only, while delete deactivates a listing. Provide an officer/admin way to retrieve their own/all inactive listings and reactivate them (with scope checks), or document that deactivation is irreversible. |
| P1 | Add server-side pagination | The common pagination helper exists, but core list handlers currently materialize and return full result sets or have `next: null`. Apply bounded pagination to users, lecturers, courses, placements, applications, and other growing lists; preserve search/filter parameters in page links. |
| P1 | Validate uploaded application CVs | Add server-side file size/type validation and safe filenames for CV uploads. Frontend checks improve UX but must not be trusted as enforcement. |
| P2 | Verify/test roster and profile permissions | Existing `GET /api/academics/courses/<id>/roster/` is restricted to the assigned lecturer/admin; `/api/auth/me/` supports GET/PATCH. Add or confirm tests that other lecturers/students cannot view another course's roster and users can only update the documented self-service fields. |
| P2 | Expand endpoint integration tests | Cover application detail/withdrawal/status changes, protected resource downloads, file replacement/deletion cleanup, placement close/reactivation, role/object authorization, and error response shapes. Exercise these with the configured isolated backend test settings, then run seeded-account smoke tests against PostgreSQL. |

No backend code was changed in this frontend implementation. Keep backend changes and any required API-contract updates in the backend follow-up work.*** End Patch
