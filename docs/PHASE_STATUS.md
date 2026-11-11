# CampusHub — Phase Progress Tracker

> Update this file at the end of every work session.  
> Format: `[x]` = complete · `[-]` = in progress · `[ ]` = not started

**Last updated:** 2026-11-10 · **Backend:** email/OTP account workflow implemented locally; deployment Gmail credentials still need configuration · **Frontend:** invitation status and resend UI implemented

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

## Frontend deployment and assignment workflow follow-up — 2026-11-04

### Frontend pushed separately

- Frontend production API: `https://campushub-backend-nbgc.onrender.com/api`.
- Assignment creation moved from lecturer unit pages to the dedicated `/assignments/new/[offeringId]` route.
- Existing assignment edit and delete controls are shown only on the dedicated lecturer assignment detail page.
- Unit pages retain assignment review and submissions management.

### Backend work required

| Priority | Backend follow-up | Completion criteria |
|---|---|---|
| P0 | Allow the deployed frontend origin | Add the final Vercel origin to Render environment variables for both `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`; verify browser requests and credentialed authentication from that origin succeed. |
| P1 | Fix quiz submission edit validation | Move malformed-answer validation outside the JSON decode `except` block in `apps/academics/views.py`. Reject non-dictionaries and invalid/nonexistent question or option values with a structured 400 response and integration tests. |
| P1 | Preserve accurate assignment submission timestamps | Update `submitted_at` when a file or quiz submission is edited, or add and expose a separate `updated_at` field and UI label. Add tests covering create, edit, and due-date result calculations. |
| P1 | Verify assignment creation contract for the dedicated frontend route | Confirm the current offering assignment POST endpoint accepts both JSON and multipart payloads, validates lecturer ownership, supported file types and size, quiz questions, due dates and maximum points. Preserve consistent error shapes for frontend display. |
| P1 | Support lecturers in multiple departments | The deployed model currently stores only one home department through `User.department`. Add a lecturer-department association (or preserve assignments through teaching/unit associations), expose department IDs in lecturer responses and account create/update payloads, and add tests. Frontend already provides one home department and identifies teaching departments separately through unit teaching assignments. |
| P0 | Persist and return department school relationships | `apps/academics/views.py` currently creates departments without assigning `school_id`, and both department list/detail responses omit the department's school fields. Frontend department creation sends `school_id`, but it is ignored. Add `school_id` handling to create/update/detail/list payloads, validate that the school exists and set `Department.school`, and return at least `school_id` plus `school__name` for every department. Existing departments with a null school must remain detectable and should be assigned by an admin or migration. |
| P1 | Resolve the academics migration branch | There is an untracked generated merge migration at `campushub-backend/apps/academics/migrations/0014_merge_20261104_1444.py`, joining `0012_enrollment_is_class_prefect` and `0013_preserve_legacy_grade_release_dates`. Run Django migration checks after backend changes are finalized, keep this merge migration only if it is generated consistently, and verify the full migration chain from a clean database. |
| 5 | At-risk students, placement outcomes, and ICS export | `[x]` | `[x]` | `[x]` |
| 6 | Profile pictures + lecturer placements | `[x]` | `[x]` | `[x]` |
| 7 | Messaging (DM + group chat) | `[x]` | `[x]` | `[x]` |
| Fix | Assignment list leak (security) | `[x]` | n/a | `[x]` |
| Fix | Users admission/course contract | `[x]` | n/a | `[x]` |
| Fix | profile_picture_url everywhere + prefect toggle | `[x]` | `[x]` | `[x]` |
| Upgrade | Next.js 16.4.4 security patch | n/a | `[x]` | `[x]` |

---

## Existing backend feature frontend integration

The frontend now consumes the existing backend routes for:

- Lecturer at-risk students and enrollment class-prefect toggling on each offering roster.
- Department-filtered placement outcomes for placement officers and super admins.
- Authenticated ICS calendar export from student and lecturer calendars.
- Profile picture upload through `/auth/me/profile-picture/` using `profile_picture` multipart field.
- Direct and offering group messaging, including polling, read status, sending, and message deletion.
- Lecturer accepted-placement outcomes and registrar student onboarding with a required programme (`course_id`).

Backend follow-up: the lecturer offering roster currently omits each enrollment's `is_class_prefect` value. The frontend calls the existing toggle endpoint and reflects the returned state after a change, but cannot display the persisted state on first load. Include `is_class_prefect` in the roster response to make the initial roster state accurate. Continue enforcing all role and ownership rules on the backend; frontend navigation and role filters are not authorization.

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

## Academic administration workflows — 2026-10-27

- Added the admin-managed academic hierarchy: schools contain departments, and departments own degree programmes (retaining the existing `Course` model and API for compatibility).
- Added reusable units that can be shared across departments and programmes. A programme-unit offering can have multiple lecturers, and lecturers can teach offerings across programmes.
- Added admin screens for schools, departments, programmes, units and lecturer assignments. Programme admissions are managed by exact student admission number; students can view their enrolments but cannot self-enrol or drop programmes.
- Existing departments are preserved by migration under an `UNASSIGNED` school for admins to review and reassign. Apply the new migrations during deployment with `python manage.py migrate`.
- Added school/unit/enrolment counts to admin overview and kept academic-directory management on its dedicated pages. Inactive programmes and units remain reviewable; inactive offerings do not grant lecturers access.
- Academic term management, attendance, grades, fee billing and formal admissions applications remain outside the current product scope. Weekly unit class sessions are managed with explicit term start/end dates.
- Validation: backend `pytest` — **51 passed**; Django system check — passed; `makemigrations --check --dry-run` — no changes detected; frontend `npm run test` — **16 passed**; `npx tsc --noEmit` — passed; `npm run build` — passed; ESLint — no errors (one existing warning in `src/lib/api.ts`); `git diff --check` — passed.*** End Patch

## One programme per student — 2026-10-27

- Student creation and editing use a single programme dropdown. The selected programme determines the student's department and school; admins no longer assign those separately.
- Student directory responses show the student's single current programme and its school/department. Changing the programme moves the previous current enrolment to dropped history, and the admissions workflow follows the same rule.
- Added a data migration that retains the latest current enrolment and marks older active/completed enrolments as dropped, followed by a database constraint enforcing at most one current programme per student.
- Validation: backend `pytest` — **53 passed**; Django system check and migration consistency check — passed; frontend tests — **16 passed**; TypeScript check and production build — passed; ESLint — no errors (one existing warning in `src/lib/api.ts`).*** End Patch

## Lecturer unit portal — 2026-10-27

- Replaced the lecturer overview's profile/course list with assigned units and a teaching calendar. Lecturers now see only their own unit offerings, and the lecturer directory is restricted to admins (lecturers may request only their own lecturer record).
- Added the lecturer sidebar order: Overview, Units, Settings, Learning materials / notes, and Assignments. The lecturer profile shortcut and unrelated directory/placement navigation are not shown.
- Added unit workspaces with course overview, enrolled-student roster, scoped announcements, notes/topic resources, assignment creation and deadlines, class schedule, and student group generation.
- Added persistent assignments with instructions, due time, points, and publish status; student assignment lists show live countdowns, unit pages show deadlines, and assignment notifications link to the relevant unit.
- Added weekly class sessions with weekday/time, room, and term dates. Calendar events include both class occurrences and assignment deadlines and are visible to lecturers and enrolled students.
- Added automatic student groups using A–G or 1–10 labels and a configured maximum group size. Memberships are shuffled, replacing a previous set regenerates the groups, and students can view only their own group.
- Added offering-scoped announcements and Notes resource category. Students see unit materials, announcements, assignments, sessions, and their group from the enrolled programme page.
- Added backend migrations `academics.0007` and `resources.0005`. Apply them with `python manage.py migrate` before deploying these frontend workflows.
- API routes include `GET /api/academics/offerings/<id>/`, `/roster/`, `/assignments/`, `/sessions/`, `/groups/`; `GET /api/academics/assignments/`, `/calendar/`; and `GET/POST /api/resources/offerings/<id>/announcements/`. Lecturer writes require an assigned offering; student reads require an active programme enrolment.
- Research reference: Canvas/Instructure's [Assignments API](https://canvas.instructure.com/doc/api/assignments.html) models assignment due times; its [Calendar Events API](https://canvas.instructure.com/doc/api/calendar_events.html) includes dated events, start/end times, and location. CampusHub uses equivalent due-date/calendar fields within unit-scoped endpoints.
- Validation: full backend suite — **59 passed**; Django system check and migration consistency check — passed; frontend tests — **17 passed**; TypeScript check and production build — passed; ESLint — no errors (one existing warning in `src/lib/api.ts`); `git diff --check` — passed.*** End Patch

## Frontend-only academic workflow push — 2026-10-28

The current push targets `feature/my-new-feature` and contains frontend changes plus this status update only. Backend source, tests, and migrations remain outside this push and must be included in a separate backend change before deploying the complete workflows.

### Backend follow-up required

| Priority | Backend work | Completion criteria |
|---|---|---|
| P0 | Include the academic structure and unit-workspace backend changes needed by the frontend: schools/departments/courses/units, enrolments, lecturer offering assignments, scoped resources and announcements, schedules, and groups. | Commit the matching models, permission checks, views, routes, tests, and migrations (`academics.0005`–`0007`, `resources.0004`–`0005`, and required account migrations); confirm admin and student/lecturer role behavior. |
| P0 | Include assignment submission and grading APIs. | Commit assignment type/file-format validation, quiz questions and auto-marking, protected student uploads/downloads, lecturer submission review and file downloads, mark/feedback updates, and the per-unit CSV gradebook. Include `academics.0008`–`0009` and the API authorization tests. |
| P0 | Apply and verify backend migrations before enabling these frontend screens in a shared environment. | Run `python manage.py migrate`, `python manage.py makemigrations --check --dry-run`, and the backend test suite against the deployment settings; verify uploaded files use persistent storage and authenticated downloads. |
| P1 | Verify frontend/API integration against the deployed backend. | Exercise student course/unit access, file and quiz submissions, resubmission, early/late timestamps, lecturer review/download/mark/feedback, and CSV export with accounts for each role. Confirm students cannot read other students' work or quiz answer keys and lecturers cannot access unassigned offerings. |
| P1 | Reconcile any API or frontend changes found during live verification. | Document the final request/response contract and run end-to-end smoke tests after the backend commit is deployed. |*** End Patch

## Frontend/backend endpoint gap assessment — 2026-11-02

Static comparison of the frontend API calls and the backend route/view/model source in this repository. These items have **not** been verified against a live backend. Confirm the deployed backend revision before treating a route as absent; do not recreate endpoints solely because a running service returned 404.

### P0 — Make existing frontend workflows callable

| Status | Workflow | Exact work required |
|---|---|---|
| `[x]` | Lecturer lessons | The lecturer UI calls `GET/POST /api/academics/offerings/<offering_id>/lessons/` and `GET/PATCH/DELETE /api/academics/lessons/<lesson_id>/`. Added lesson model, migration 0010, routes, views, validation, and tests. |
| `[x]` | Lecturer attendance | The UI calls `GET/POST /api/academics/sessions/<session_id>/attendance/`. Added AttendanceRecord model, migration 0011, endpoints, upsert logic, and tests. |
| `[x]` | Lecturer dashboard summary | **Resolved:** Frontend now calls `/academics/dashboard/lecturer/` and `/academics/dashboard/student/`, matching the backend routes exactly (`StudentDashboard.tsx:162`, `LecturerDashboard.tsx:137`). |
| `[x]` | Assignment detail editing | The frontend uses `GET/PATCH /api/academics/assignments/<assignment_id>/`. Implemented `assignment_detail` supporting GET/PATCH/DELETE with offering-scoped lecturer authorization, field validation, and tests. |
| `[x]` | Assignment attachments | The frontend creates/replaces attachments and requests `/api/academics/assignments/<assignment_id>/attachment/`. Added `attachment` field to `Assignment` model, migration 0017 dropping NOT NULL constraint in Postgres, multipart upload handling, authenticated download endpoint, and tests. |
| `[x]` | Assignment submission response contract | **Resolved:** Backend `assignment_submission` view returns `{"submission": ...}` on both GET and POST/PATCH, matching `src/app/assignments/page.tsx` expected type. |
| `[ ]` | Student submission download | Frontend builds a download URL using the assignment ID at `/api/academics/assignments/<assignment_id>/submission/download/`; backend exposes `/api/academics/submissions/<submission_id>/download/`. Update the frontend to use the submission ID and backend route (or deliberately add a compatible assignment-scoped route), then test that students can only download their own submission and assigned lecturers can access submissions for their offering. |
| `[x]` | Group-set response shape | **Resolved:** Backend `offering_groups` returns `{"count", "results": [{"id", "name", "members": [...]}]}`; frontend consumes via `setGroups(groupPage.results)` with matching `UnitGroup` type — already aligned. |
| `[x]` | Calendar response shape and assignment deadlines | **Resolved:** `_get_calendar_events` returns dated events (not day-of-week templates) with a `kind` field (`class | assignment | lesson`) and includes assignment due dates — matches `LecturerDashboard.tsx` `item.kind` checks exactly. |

### P1 — Decide whether backend-only routes need frontend workflows

For each route below, decide whether to add a user-facing action and connect it to the existing endpoint, or explicitly mark it out of scope. Do not add duplicate backend routes if the existing route already implements the behavior.

| Status | Existing backend capability | Decision / exact work |
|---|---|---|
| `[ ]` | Dropping an enrollment | Confirm whether staff or students need a drop action. If in scope, add the authorized action to the relevant UI and test that users cannot drop another student's enrollment; otherwise document it as backend-only. |
| `[ ]` | Bulk lecturer assignment | Decide whether admins need a bulk assignment workflow. If yes, add the admin UI, input validation, and success/error handling against the existing endpoint; otherwise document it as backend-only. |
| `[ ]` | Course roster CSV export | Decide whether lecturers/admins need CSV export. If yes, expose the existing export in the authorized roster UI and test permissions and CSV contents; otherwise document it as backend-only. |
| `[ ]` | Dashboard API routes | Identify which dashboard route responses are intended for current frontend pages. Connect each needed route and align its response type, or mark unused routes as backend-only; do not maintain unconsumed routes without an explicit product decision. |

### P0 — Contract and integration verification

- `[ ]` Maintain a route/contract checklist for each workflow above: HTTP method, path, authentication, role/object permissions, request body, success response, and error response.
- `[ ]` Add or update focused backend tests for every implemented route, including invalid input, unsupported methods, unauthorized roles, cross-student access, and cross-offering access where applicable.
- `[ ]` Add or update frontend tests for the actual request path/method and expected response shape, including loading, empty, and error states.
- `[ ]` Run backend tests, frontend tests, TypeScript checks, and lint after reconciling the contracts.
- `[ ]` After confirming the deployed revision, run authenticated integration smoke tests for student, lecturer, and admin workflows; record the tested backend revision and results here. Static source comparison alone is not evidence of live integration.*** End Patch

## Backend: Lessons, Attendance, Scheduled Announcements + Test Coverage — 2026-11-02

### Section 1: Lesson Plan Backend (merged `231fd2b`)
- Lesson model (offering FK, title, description, scheduled_at, duration_minutes)
- Migration 0010_lesson_model
- GET/POST/PATCH/DELETE lesson endpoints with overlap validation (checks both
  Lesson and ClassSession conflicts for the lecturer's taught offerings)
- Calendar view updated to CalendarEvent shape with kind: class|assignment|lesson

### Section 2: Attendance Backend (merged `8a98416`)
- AttendanceRecord model (session FK, student FK, date, status, note, recorded_by)
  with unique constraint on (session, student, date)
- Migration 0011_attendance_record
- GET/PUT /sessions/<id>/attendance/?date=YYYY-MM-DD matching frontend AttendanceResponse
- Roster ?search= param added (filters by student name or admission number)

### Section 3: Scheduled Announcements (merged `9189b1d`)
- scheduled_for, dispatched_at, group fields on Announcement (migration 0005)
- Visibility filtering: scheduled-not-dispatched hidden; group-targeted hidden from non-members
- New management command: dispatch_scheduled_announcements (idempotent)

### Section 4: Test Coverage + Bug Fix (merged `0526ff9`)
- 17 new tests (52 -> 69 total), coverage 62% -> 72%
- Test files: test_resources, test_lessons, test_attendance, test_dashboards,
  test_notification_triggers
- Bug fix: format_attendance_session used 'room' instead of 'location'

**Tests:** 69 passed · **Coverage:** 72%

---


---

## Backend: Creative Features + Messaging — 2026-11-04

**13 PRs shipped this session.** Tests: 69 → 172 (+103). Coverage: 72% → 80%. Models: 22 → 26. Endpoints: 60+ → 87+. New app: `apps/messaging`.

### Next.js 16.4.4 Security Upgrade (PR #48)
- Upgraded from 16.4.0 to 16.4.4 (known security vulnerability)
- Verified in isolated worktree: version check, config preserved, production build passes

### Calendar Fix (PR #49)
- Calendar endpoint changed from `{'count': N, 'results': [...]}` to bare array
- Added `from`/`to` date filtering query params

### .env.local Fix
- `NEXT_PUBLIC_API_URL` was missing `/api` suffix → auth 404s on Render
- Fixed: `NEXT_PUBLIC_API_URL=https://campushub-backend-nbgc.onrender.com/api`

### Section 1: At-Risk Students (PR #51)
- `GET /api/academics/offerings/<id>/at-risk/?attendance_threshold=0.75&missed_threshold=2`
- Flags students by attendance rate < threshold OR 2+ missed assignment deadlines
- Excused absences excluded from rate; batched queries (5 total)
- 15 tests

### Section 2: Placement Outcomes (PR #52)
- `GET /api/admin/placement-outcomes/?department_id=X`
- Per-department aggregation: total, accepted, pending, shortlisted, rejected, withdrawn, unique applicants, acceptance rate
- Admin or placement officer only; single DB query with Count+Q annotations
- 10 tests

### Section 3: ICS Calendar Export (PR #53)
- `GET /api/academics/calendar.ics` — Content-Type: text/calendar
- Same event set as calendar/ (sessions, assignments, lessons)
- iCalendar format with CRLF line endings; hand-rolled serializer (no new dependency)
- Refactored calendar_view to share `_get_calendar_events` helper (no duplication)
- 10 tests

### Section 4: Notification Digest (PR #54)
- `digest_notifications` management command (`--hours` flag, default 24)
- Groups unread notifications into single `verb='digest'` summary per user
- Idempotent via `digested_at` field on Notification (nullable)
- Python-side grouping (avoids ORM distinct() + Meta ordering quirk in SQLite)
- 8 tests

### Section 5: Lecturer Placements (PR #55)
- `GET /api/academics/lecturer/placements/`
- Shows enrolled students with their accepted placement (title, company, location, deadline) or null
- 3 batched queries; admin sees all offerings
- 9 tests

### Security Fix: Assignment List Leak (PR #56)
- `assignment_list` returned ALL assignments to any non-student role (lecturers saw other lecturers' drafts)
- Now scoped: lecturer sees only own offerings, admin global, student published+active, other roles 403
- `offering_assignments` GET: students must be enrolled + see published only
- 8 tests with two lecturers + separate offerings

### Users Admission/Course Fix (PR #57)
- `PATCH /api/users/<id>/` rejected `admission_number` and `course_id` as "Unsupported fields"
- Now accepts both: admission_number (validated, duplicate-checked), course_id (sets department from programme, creates/updates enrollment transactionally)
- Response includes `admission_number` + `programme: {id, code, title}`
- 8 tests

### Section 6: Profile Pictures (PR #58 + #59)
- `ImageField` on User (`upload_to='profile_pictures/'`)
- `POST /api/auth/me/profile-picture/` — multipart upload
- Shared `apps/common/file_guards.py` (10MB max, jpg/jpeg/png/webp whitelist)
- `profile_picture_url` in `_user_dict` and `_user_data`
- **320×320 resize**: center-crop to square + LANCZOS resize + JPEG quality 85
- Reduces storage from multi-MB originals to ~20-30KB avatars
- Pillow added to requirements.txt
- 10 tests

### Section 7: Messaging (PR #60)
- New `apps/messaging` app with 3 models: Conversation, ConversationParticipant, Message
- `is_class_prefect` on Enrollment (for group chat admin)
- 7 endpoints:
  - `GET /api/messaging/conversations/` — list with unread count + latest message
  - `POST /api/messaging/conversations/direct/` — get-or-create DM (teaching relationship check)
  - `GET /api/messaging/offerings/<id>/group-conversation/` — get-or-create + sync participants
  - `GET/POST /api/messaging/conversations/<id>/messages/` — list with `?after=` polling + send
  - `DELETE /api/messaging/messages/<id>/` — soft delete (sender or group admin)
  - `PATCH /api/messaging/conversations/<id>/read/` — mark read (clears unread count)
- Permissions: students DM only their lecturers, no student-to-student DMs, group chat restricted to enrolled + assigned
- Notification trigger on new message
- Polling-based v1 (not WebSocket) — documented decision
- 15 tests

### Gap Fix: profile_picture_url Everywhere + Prefect Toggle (PR #61)
- `profile_picture_url` added to ALL user-referencing endpoints across all 5 apps (academics: at-risk, roster, lecturer-placements; messaging: sender + other user; placements: posted_by, student, reviewed_by; notifications: actor; resources: uploaded_by, author)
- `PATCH /api/academics/enrollments/<id>/prefect/` — lecturer (must teach the course) or admin only; accepts `{is_class_prefect: bool}` or empty to toggle
- 9 tests

### Section 8: AI Feed, Chat, Tasks & Analytics (PR #75, feat/ai-ensemble-pipeline)
- New `apps/ai` app: 4 models (AIConversation, AIMessage, AIInsight, AITaskLog)
- Multi-provider router (`apps/ai/router.py`): Gemini primary, NVIDIA GLM and Mistral
  (via NVIDIA) as fallback/chain providers, MockProvider for tests — falls back to
  Mock automatically when no API keys are configured
- 6 endpoints:
  - `GET /api/ai/feed/` — role-specific daily insights, cached per `AI_FEED_CACHE_HOURS`
  - `POST /api/ai/chat/`, `GET /api/ai/chat/<id>/` — multi-turn AI chat
  - `GET /api/ai/tasks/`, `POST /api/ai/task/` — role-scoped AI task execution (returns
    drafts only — nothing is auto-applied; see AITaskLog for the audit trail)
  - `GET /api/ai/analytics/` — admin-only usage/provider stats
- `retrain_at_risk_model` / `retrain_placement_model` management commands — refuse to
  train below `AI_AT_RISK_MIN_TRAINING_ROWS` (default 200) and fail gracefully with a
  clear message if scikit-learn/joblib are not installed (they are intentionally still
  commented out of `requirements.txt` until there is enough real data to train on)
- **Zero frontend integration as of this entry** — confirmed by diffing every frontend
  API call against every backend route. See Titus Frontend Guide §9 below.
- **Model IDs verified (2026-11-11):** the hardcoded model IDs in `router.py`
  (`gemini-3.8-flash`, `z-ai/glm-5.3-flash`, `mistralai/mistral-large-4-1t-a52b`)
  were confirmed against the live Google AI Studio and NVIDIA NIM catalogs — all three are
  current and valid.
  Manual API calls verified on Render: Gemini (provider: "gemini" in AI Feed + Chat), NVIDIA GLM (direct API call to integrate.api.nvidia.com succeeded), Mistral (provider: "mistral" in AI Chat + Task). No router.py changes needed.


---

## Titus Frontend Guide — New Backend Features Awaiting UI

> Each section below describes the endpoint, auth, response shape, and what UI to build.

### 1. At-Risk Students Dashboard
- **Endpoint:** `GET /api/academics/offerings/<id>/at-risk/?attendance_threshold=0.75&missed_threshold=2`
- **Auth:** Assigned lecturer or admin
- **Response:** `{"count": N, "results": [{"student_id", "student_name", "student_email", "admission_number", "attendance_rate", "attended_sessions", "total_sessions", "missed_assignments", "total_assignments", "at_risk": bool, "reasons": ["attendance", ...], "profile_picture_url"}]}`
- **UI:** Offering-scoped table, at-risk students first. Show attendance rate as a percentage bar, missed count, reasons as colored badges. Optional threshold sliders (attendance_threshold, missed_threshold).

### 2. Placement Outcomes Dashboard
- **Endpoint:** `GET /api/admin/placement-outcomes/?department_id=X`
- **Auth:** Admin or placement officer
- **Response:** `{"count": N, "results": [{"department_id", "department_name", "total_applications", "accepted", "pending", "shortlisted", "rejected", "withdrawn", "unique_applicants", "acceptance_rate"}]}`
- **UI:** Admin/officer dashboard with department cards + bar chart for acceptance rates. Optional department filter dropdown.

### 3. ICS Calendar Export
- **Endpoint:** `GET /api/academics/calendar.ics`
- **Auth:** Any authenticated user (same scope as calendar/)
- **Response:** `Content-Type: text/calendar` — iCalendar VCALENDAR/VEVENT
- **UI:** "Add to Calendar" button. Must use `fetch` with auth header → get blob → download as `.ics` file. Cannot use a plain `<a href>` (needs JWT auth).

### 4. Profile Picture Upload
- **Endpoint:** `POST /api/auth/me/profile-picture/`
- **Auth:** Any authenticated user
- **Request:** MULTIPART form data, field name: `profile_picture`
- **Response:** `{"profile_picture_url": "/media/profile_pictures/user_avatar.jpg"}`
- **IMPORTANT:**
  - This is MULTIPART, not JSON. Use `FormData`.
  - Backend auto-resizes to 320×320 JPEG. No need to resize on frontend.
  - `profile_picture_url` is RELATIVE (e.g., `/media/...`). Prepend backend domain: `${API_BASE.replace('/api', '')}${url}`
  - The URL is now in EVERY user-referencing response (roster, at-risk, messaging, placements, notifications, resources). Show avatars wherever user info appears.

### 5. Messaging UI (new surface)
- **Conversations list:** `GET /api/messaging/conversations/` — shows unread count + latest message preview. Sort by most recent.
- **Thread view:** `GET /api/messaging/conversations/<id>/messages/?after=<last_id>` — POLL every 3-5 seconds for new messages. Only fetch messages with ID > last seen.
- **Composer:** `POST /api/messaging/conversations/<id>/messages/` with `{"body": "text"}`
- **Direct DM:** `POST /api/messaging/conversations/direct/` with `{"recipient_id": N}` — creates/gets a DM (students can only DM their lecturers; lecturers can only DM their enrolled students)
- **Group chat:** `GET /api/messaging/offerings/<id>/group-conversation/` — auto-creates + syncs participants (all enrolled students + assigned lecturer). Lecturer and prefects are `is_admin=True`.
- **Delete message:** `DELETE /api/messaging/messages/<id>/` — soft delete (sender or group admin)
- **Mark read:** `PATCH /api/messaging/conversations/<id>/read/` — clears unread count
- **Polling pattern:** `setInterval` with `?after=<last_message_id>` every 3-5 seconds. Stop when conversation not visible.
- **Notifications:** New messages trigger notifications (existing system). Link notification to conversation.

### 6. Lecturer Placements Screen
- **Endpoint:** `GET /api/academics/lecturer/placements/`
- **Auth:** Lecturer or admin
- **Response:** `{"count": N, "results": [{"student_id", "student_name", "student_email", "admission_number", "course_code", "placement": {"id", "title", "company", "location", "deadline"} | null}]}`
- **UI:** Table showing student name + placement info. Students without placements show "No placement" badge.

### 7. Prefect Toggle
- **Endpoint:** `PATCH /api/academics/enrollments/<id>/prefect/`
- **Auth:** Lecturer (must teach the course) or admin
- **Request:** `{"is_class_prefect": true/false}` (optional — empty body toggles)
- **UI:** Badge/toggle on the roster page. Lecturer clicks to make a student class prefect. Prefects are `is_admin=True` in group chats (can delete others' messages).

### 8. Users Endpoint — admission_number + course_id (FIXED)
- **Changed:** `POST /api/users/` and `PATCH /api/users/<id>/` now accept `admission_number` and `course_id`.
- `admission_number`: string, validated for duplicates
- `course_id`: integer, must be an existing course. Only for student role. Sets department from the course's department. Creates/updates enrollment transactionally.
- Response now includes `admission_number` and `programme: {id, code, title}` for students.
- **UI:** The edit student modal should send `admission_number` and `course_id` (the Programme dropdown). The "Unsupported fields: admission_number, course_id" error is fixed — these fields are now accepted.


### 9. AI Feed & Chat (frontend integrated)
- **AI workspace:** `/ai`, available to Student, Lecturer, Placement Officer, and Super Admin (the role contexts currently supported by the backend).
- **Daily feed:** calls `GET /api/ai/feed/`; displays `feed.summary`, provider, `context_role`, `generated_at`, and cached state; includes a refresh action and visible endpoint errors.
- **Chat:** sends `POST /api/ai/chat/` with `{"message":"...", "conversation_id": optional}` and reads the actual backend response `{ "conversation_id": number, "message": {"id", "role", "content", "provider", "created_at"} }`. Loads history using `GET /api/ai/chat/<id>/`. The current backend has no conversation-list endpoint, so the UI retains one conversation ID per authenticated user in browser local storage and offers “New chat”; the backend enforces conversation ownership. No streaming is used.
- **Role-scoped AI tasks:** loads `GET /api/ai/tasks/` (`{"count": number, "results": [{"type", "description", "required_params"}]}`); posts `{"task_type", "params"}` to `POST /api/ai/task/`; displays the returned `{ "task_type", "draft", "provider", "warning" }`. Drafts can be copied for review but are never automatically applied or published.
- **Super Admin analytics:** calls the admin-only `GET /api/ai/analytics/`; displays total calls, calls in the last 24 hours, provider counts, model training status, and available/required training rows (plus at-risk offering coverage). The backend response does not currently include task success rate, so the UI does not claim to show one.
- **Backend scope:** feed and chat are authenticated for all roles, but `build_feed_context` and the task registry currently define only student, lecturer, officer, and admin contexts. Other frontend role types should not be given this AI navigation until backend context/task support is added.

---

### 9. AI Feed & Chat (new surface, backend complete)
- **Daily feed card:** `GET /api/ai/feed/` — role-specific insights (student: study
  suggestions/at-risk alerts; lecturer: class overview/intervention suggestions;
  officer: placement summary; admin: system overview). Cached server-side, so a
  simple "last updated" card works without client-side caching logic.
- **Chat panel:** `POST /api/ai/chat/` with `{"message": "..."}` returns
  `{"conversation_id", "response", "provider"}`. `GET /api/ai/chat/<id>/` for history.
  A simple chat UI (message list + input) is enough for v1 — no streaming required,
  the backend returns a complete response per call.
- **AI tasks:** `GET /api/ai/tasks/` lists what is available for the current role;
  `POST /api/ai/task/` executes one and returns a **draft only** — e.g. a drafted
  announcement — which the UI should let the user review and then submit through the
  *existing* normal endpoint (e.g. the real announcement composer), not a separate
  auto-publish action. This is deliberate, not a missing feature.
- **Admin analytics:** `GET /api/ai/analytics/` — a simple stats panel (calls per
  provider, task success rate) for the admin dashboard.

main
### Frontend Fixes Still Needed
- `<body suppressHydrationWarning>` — Grammarly extension causes hydration mismatch
- `/dashboard/placments` → `/placements` — URL typo
- `data-scroll-behavior="smooth"` on `<html>` — Next.js warning
- `api.ts` `/api` suffix self-heal — so a missing `/api` in `NEXT_PUBLIC_API_URL` doesn't break auth (like it did this session)

---

## Registrar, Finance, Library & Hostel CRUD Frontend — 2026-11-09

Added API-backed create, list, update, and delete screens for registrar and campus service workflows. The shared frontend workspace expects list responses as an array or `{count, results}`, and sends JSON payloads to collection/detail routes.

### Agreed API contract

| Module | Collection route | Request fields used by the frontend |
|---|---|---|
| Admissions | `/api/admissions/applications/` | `first_name`, `last_name`, `email`, `phone_number`, `programme_id`, `status`, `notes` |
| Academic periods | `/api/academics/periods/` | `academic_year`, `name`, `starts_on`, `ends_on`, `status` |
| Student unit registrations | `/api/academics/registrations/` | `student_id`, `academic_period_id`, `unit_id`, `status`, `registered_on` |
| Fee structures | `/api/finance/fee-structures/` | `name`, `programme_id`, `academic_year`, `amount`, `due_date`, `status` |
| Invoices | `/api/finance/invoices/` | `student_id`, `fee_structure_id`, `amount`, `due_date`, `status`, `description` |
| Payments | `/api/finance/payments/` | `invoice_id`, `amount`, `method`, `reference`, `paid_at`, `status` |
| Library books | `/api/library/books/` | `isbn`, `title`, `author`, `category`, `total_copies`, `location`, `status` |
| Library loans | `/api/library/loans/` | `book_id`, `student_id`, `borrowed_on`, `due_date`, `returned_on`, `status` |
| Library reservations | `/api/library/reservations/` | `book_id`, `student_id`, `reserved_on`, `expires_on`, `status` |
| Hostels | `/api/hostels/` | `name`, `location`, `gender_policy`, `capacity`, `status`, `description` |
| Hostel rooms | `/api/hostels/rooms/` | `hostel_id`, `room_number`, `capacity`, `occupied`, `status` |
| Hostel allocations | `/api/hostels/allocations/` | `student_id`, `room_id`, `academic_year`, `starts_on`, `ends_on`, `status` |

Collection routes support `GET` and `POST`; item routes use `<id>/` and support `PATCH` where applicable. Destructive deletes are disabled for historical workflows. Payments use `POST /api/finance/payments/<id>/void/`; the backend must preserve an auditable reversal rather than erase ledger history. Student views are read-only and rely on the API to scope invoices and payments to the authenticated student.

Programme enrolments continue to use existing `/api/academics/admin/enrollments/` endpoints.

**Backend status (2026-11-10):** all routes listed above are now mounted and implemented. Collection endpoints support pagination, search, allowed ordering, and the workspace filters; serializers return the relationship labels used by the UI. Student reads are scoped from the authenticated user, regardless of `scope` or submitted IDs. Public `POST /api/auth/register/` is disabled; Registrar and Super Admin provisioning remains through `/api/users/`.

### Backend behavior and implementation notes

The backend implements the server-side list behavior and related-record data expected by the frontend. Do not treat frontend role guards, hidden form fields, read-only controls, or query parameters as authorization.

#### Common list, search, lookup, and dashboard behavior

- Return collection data as either a JSON array or `{ "count": number, "results": [...] }`. For paginated responses, include nullable `next` and `previous` links. Honor `page` and `page_size` (the workspace requests 25 rows; relation lookups request up to 100).
- Honor `search` against appropriate human-readable fields and `ordering` against explicitly allowed fields, including `-` for descending order. Ignore or reject unsupported ordering keys safely.
- Honor the module filters shown in the frontend (primarily `status`, plus catalogue category and other lookup parameters). Return `count` for the filtered result set so overview cards show accurate filtered counts.
- Include display-ready relationship values in each row; at minimum: `programme_name`/programme `code` and `title`, `student_name`, `invoice_number`/`invoice_reference`, `academic_period_name`, `unit_code` and `unit_title`, `book_title`, `hostel_name`, and room number. The frontend displays these fields directly.
- Lookup GET requests include `search`, `page_size=100`, and relationship filters such as `role=student`, active periods, or active units. Return stable IDs plus the label fields requested by the frontend (`first_name`, `last_name`, `email`, `admission_number`, `code`, `title`, `academic_year`, `name`, `author`, `isbn`, etc.).
- Validate every read and write against authenticated role and object ownership. `scope=self` is a frontend query hint only: derive the student from the authenticated principal and never trust a submitted `student_id`, invoice ID, or scope parameter as proof of ownership.
- Use consistent structured 4xx responses for validation and authorization errors. The UI displays server errors and does not infer a successful write when an endpoint is unavailable.

#### Roles and access boundaries

- The account model already supports the service roles: `admin` (Super Admin), `ict_admin`, `registrar`, `finance`, `officer` (Placement Officer), `librarian`, and `hostel` (Hostel Warden), in addition to Student and Lecturer. Endpoints enforce the relevant server-side roles.
- Super Admin alone creates and assigns staff accounts/roles. ICT Admin manages academic structure (schools, departments, programmes/courses, units) but cannot see finance records or administer user accounts. Registrar manages admissions, academic periods, and registrations; Finance manages fee schedules, invoices, and payment reconciliation; Librarian manages catalogue/circulation; Hostel Warden manages accommodation inventory and allocations.
- Keep placement permissions separate and preserve existing lecturer/student access. Add server-side role and object-level tests for allowed and denied reads/writes; frontend route guards are not a security boundary.
- Define a migration plan for existing broad `admin` accounts and a recovery/bootstrap path for the first Super Admin before changing accepted account roles.

#### Module-specific behavior and validations

- **Admissions:** `/api/admissions/applications/` supports collection GET/POST and item GET/PATCH. It validates email, programme existence, duplicate email/programme applications, and legal status transitions; status changes are audited and hard delete is not exposed.
- **Academic periods and registrations:** `/api/academics/periods/` and `/api/academics/registrations/` support the current UI fields, pagination, overlap checks, status transitions, unique student/unit/period registration, active-period dates, and offering/programme eligibility. Student registration writes bind to the authenticated user; staff writes require Registrar/admin permission. Dropped/completed records are retained. The current academic model has no prerequisite or unit-capacity fields, so those checks cannot be performed yet.
- **Finance:** fee structures, invoices, payments, and `/api/finance/payment-requests/` validate amounts, programme enrollment, dates, invoice balance, duplicate/overpayment conditions, and payment methods. A payment request never creates a confirmed payment. Confirmed payments are managed by Finance/admin; `POST /api/finance/payments/<id>/void/` creates a reversal record with actor, time, reason, and a link to the payment. Student invoice/payment/request reads derive ownership from the authenticated user.
- **Library:** books, loans, and reservations derive availability from copies, active loans, lost copies, and ready holds; validate duplicate circulation and date rules; and retain status history. Students can browse books and access only their own reservations/loans; Librarian/admin manages catalogue and circulation.
- **Hostels:** hostels, rooms, and allocations derive occupancy from active allocations rather than trusting submitted `occupied`, enforce room/hostel capacity, date overlap, duplicate active requests, and legal allocation transitions. Students can browse inventory, request accommodation, and view only their requests; Warden/admin manages inventory and allocation. The User model has no gender field, so the configured hostel gender policy cannot yet be checked against a student's gender; add a verified gender attribute before enforcing that rule.
- **Dashboard summaries:** support the same status filters used by the service overview cards and ensure each returned count is computed after authorization and filtering, not by exposing unscoped aggregate totals.

#### Suggested backend acceptance tests

1. Implemented tests cover core role checks, student self-scope, application and period transitions, registration eligibility, payment request/confirmation separation and reversal, library availability, and hostel capacity.
2. Expand tests for every role/action combination, lookup search, all status/date transition edges, and audit history before treating the service modules as fully production-verified.

---

## Backend: Assignment Attachments & Detail Editing Fix — 2026-11-05

> **Note:** `0012_reconcile_legacy_database_schema.py` exists because the live Postgres
> database had drifted from the migration history (the "500 error" incident). This should
> be confirmed resolved on the actual live Render deployment, not just in local/test
> verification, before treating it as closed.


Resolved the 500 Internal Server Error when creating assignments as a lecturer, and fulfilled assignment detail and attachment endpoints.

### 1. Root Cause Resolution (500 Error on Assignment Creation)
- **Issue:** PostgreSQL `academics_assignment` table had a legacy `attachment character varying NOT NULL` constraint without a default value, while the Django `Assignment` model did not declare an `attachment` field. Creating any assignment without an attachment resulted in `IntegrityError: null value in column "attachment" of relation "academics_assignment" violates not-null constraint`, causing an unhandled 500 error.
- **Fix:** Created and applied migration `0017_assignment_attachment.py` which executes `ALTER TABLE academics_assignment ALTER COLUMN attachment DROP NOT NULL` on PostgreSQL and safely adds the field across environments.

### 2. Assignment Model & Attachment Storage
- Added `attachment = models.FileField(upload_to='assignments/%Y/%m/', null=True, blank=True)` to `Assignment` model.
- Handled multipart file uploads (`request.FILES['attachment']`) in `POST /api/academics/offerings/<id>/assignments/`.
- Updated `format_assignment` serializer to include `attachment_name` and `attachment_url`.
- Added authenticated file download endpoint `GET /api/academics/assignments/<id>/attachment/` with role-scoped permission checks.

### 3. Assignment Detail, Editing & Deletion
- Implemented `assignment_detail` view supporting `GET`, `PATCH`, and `DELETE` on `/api/academics/assignments/<id>/`:
  - `GET`: Returns full assignment details with question set (and answer keys for authorized lecturers/admins).
  - `PATCH`: Supports updating title, instructions, due date, max points, publication state, replacing attachments via multipart form data, or removing attachments via `remove_attachment=true`.
  - `DELETE`: Maintains deletion with offering-level authorization.

**Tests:** All 79 backend tests passed · All 49 frontend tests passed

---

## Account provisioning, OTP recovery & Resend email — 2026-11-11

### Frontend status

- Public self-registration has been removed. `/register` now explains that accounts must be created by an authorized campus office; the home and login pages no longer encourage student self-sign-up.
- The Registrar can create a student account at `/registrar/students` after explicitly confirming admission details. The Super Admin account screen creates staff accounts. Both flows request that the API generate initial credentials and email the user; the frontend never generates, displays, or transmits a password.
- First-login password changes are routed to `/change-password` using the `must_change_password` property returned by `GET /api/auth/me/`. The route guard also applies after a session is restored, not only after an interactive login.
- `/forgot-password` sends a one-time email code, then confirms the code and new password in a single request. `/reset-password` now directs users to this OTP flow.
- Resend API credentials are backend-only configuration. No email secret belongs in frontend environment variables or browser requests.

### Backend API implementation status

The backend provisions initial credentials and sends welcome/OTP mail through the configured Django Resend backend. Credentials are generated server-side, hashed in the database, and never returned to the frontend. Initial passwords expire after 48 hours and require a first-login change. When Resend delivery fails, the account remains created and the API returns `welcome_email_status: "failed"` so the operator does not submit a duplicate.

| Purpose | Method and route | Request | Successful response |
|---|---|---|---|
| Provision an account | `POST /api/users/` | Account fields plus `send_welcome_email: true`; no password | `201` with created account (never include a password) and `welcome_email_status: "sent"` or `"failed"` |
| Resend invitation | `POST /api/users/<id>/resend-invitation/` | Super Admin only | Sends a new temporary password if email delivery succeeds; response contains status only |
| Login profile | `GET /api/auth/me/` | Authenticated | Existing user fields plus `must_change_password` and initial-password expiry |
| Change first/regular login password | `POST /api/auth/password/change/` | Authenticated `{ "current_password": "...", "new_password": "..." }` | `200` with `must_change_password: false` |
| Request a recovery code | `POST /api/auth/password/otp/request/` | `{ "email": "..." }` | Generic `200` response regardless of whether an account exists or is eligible |
| Verify code and reset password | `POST /api/auth/password/otp/confirm/` | `{ "email": "...", "otp": "123456", "new_password": "..." }` | `200` success; generic structured error on invalid, expired, used, or excessive attempts |

All protected routes now deny access while an initial password change is pending, except `GET /api/auth/me/` and `POST /api/auth/password/change/`. Initial passwords expire after 48 hours; expired initial credentials must be reset through OTP. Frontend checks are not an authorization boundary.

Account creation and onboarding:

1. `[x]` Anonymous `POST /api/auth/register/` is disabled so the legacy public endpoint cannot bypass Registrar approval.
2. `POST /api/users/` permits Registrar creation of students only and Super Admin creation of permitted roles; Registrar cannot use the general staff directory. Resend is Super Admin-only.
3. Generate a random temporary credential, store only Django's password hash, expire it after 48 hours, require a password change at first login, and never return it in JSON, logs, analytics, or audit descriptions.
4. `POST /api/users/<id>/resend-invitation/` issues a replacement credential only after successful mail delivery. If delivery fails, the prior password remains unchanged.
5. Delivery status is stored per account and shown on the Super Admin account directory. Resend API acceptance is not a guarantee of inbox delivery; the operator can retry without revealing the credential.

OTP recovery requirements:

- Generate a cryptographically random six-digit OTP, bind it to the account and purpose, store only a secure hash, expire it after a short window (recommended 5–10 minutes), and invalidate it after one successful use or a new code request.
- Rate limit requests by IP, enforce a 60-second per-account resend cooldown and five verification attempts, and invalidate outstanding OTPs after password change/reset.
- Use a generic response and comparable processing for unknown, inactive, or ineligible emails to prevent account enumeration. Do not expose whether delivery was attempted to a particular address in the public response.
- Validate the password server-side with the project's password policy and return field-level errors that the frontend can show. JWT refresh/access tokens are stateless and are not currently revoked after a password reset; implement token versioning if immediate session invalidation is required.
- Audit password reset/change events without recording passwords, OTP values, or sensitive tokens.

Resend deployment configuration:

- Set `RESEND_API_KEY` and `DEFAULT_FROM_EMAIL` in the Render backend environment. The sender must use a domain verified with Resend, including its required DNS records.
- Keep the API key only in the backend's secret environment configuration; never put it in source control, frontend variables, API payloads, or logs.
- Current messages are plain text; do not send credentials in URLs or query strings.
- Provide clear backend health/log signals for mail failures without logging OTPs or credentials; retry mail through an outbox/background job where available.

### Backend acceptance checklist

1. Tests prove anonymous registration is blocked and role/object authorization permits Registrar student creation while denying staff creation and user-directory administration.
2. Tests prove new users receive a hashed temporary credential, `must_change_password=true`, and no credential appears in API output or logs.
3. Tests prove first login requires password change before accessing protected resources; successful change clears the flag and invalidates prior sessions/tokens as designed.
4. OTP tests cover generic responses for unknown emails, valid/invalid/expired/replayed codes, expiry, attempt limits, request/resend rate limits, email delivery failure, and reset session invalidation.
5. Mail tests use a test backend and assert welcome/recovery email content without exposing secrets in logs; the Resend backend is tested against a mocked API response. Deployment smoke-test still requires a real sender domain and API key.
6. Add migration/backfill behavior for `must_change_password` so existing users retain access (`false`) while newly provisioned accounts are required to change (`true`).

**Deployment action required:** Add the Gmail sending account and Google App Password to the backend host's secret environment configuration. Enable 2-Step Verification and generate an App Password; do not use or share the normal Google password. Set `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, and `DEFAULT_FROM_EMAIL` in Render (or the active backend host), then smoke-test both welcome and OTP email delivery. No SMTP credentials are needed in Vercel/frontend settings.
**Local validation:** The new account email/OTP tests use Django's in-memory email backend. Deployment to Gmail has not been tested until the host's App Password is configured.

## Full capstone audit, OTP fixes & deliverables — 2026-11-11

### Audit and fixes

- The preceding Titus-authored feature change imported `PasswordResetOTP` without defining its model class. Backend hotfix `87a29bf` added the model, merged the two account migration branches in `0010_merge_20261111_0937.py`, and mounted the password change and OTP request/confirm URLs.
- The OTP confirmation view called `is_usable`, but the model exposes `is_valid()`. Both valid and expired OTP submissions therefore raised `AttributeError`; the view now calls the model's validity method.
- Invitation resend tests inherited this machine's email configuration and attempted a real configured mail backend. Test settings now explicitly use the in-memory backend with no credentials, while the invitation view only changes the password after mail succeeds.
- Django system check: no issues (two configured/silenced checks). `makemigrations --check --dry-run`: no changes detected.
- Final backend test suite: **275 passed**. Coverage: **69.7%** (70% rounded), above the 60% capstone threshold.
- OpenAPI now has **119 paths and 186 operations**, with no missing, stale, or unsupported routes compared with Django's URL resolver.

### Migration history

The accounts `0008` files are independent branches and are joined by migration `0010`; the deployed history is functional and migration drift is clean. Renumbering the branch files and merge is deferred because Render may already have recorded those migration names. The academics app also has duplicate `0012` and `0014` sequence numbers with merge/reconciliation migrations; do not rename applied migrations without checking the deployed migration table and a restore plan.

### Documentation and delivery status

- `docs/ERD.md` now documents the 45 concrete CampusHub model tables, two implicit many-to-many tables, the current user roles and onboarding fields, the academic period additions, and normalization/anomaly analysis.
- `campushub-backend/docs/openapi.json`, the root README, `.env.example`, and the account migration notes were refreshed. `REFLECTION.md` has been added.
- The four required 3+ table SQL queries and the Postman authentication collection are present.
- The examinations frontend remains a local-data prototype with no backend endpoint. The backend still uses one all-powerful `admin` role while the frontend labels it Super Admin and separates ICT Admin; this is a design mismatch to resolve with the team, not changed in this audit.
- Backend feature tests are absent for admissions, finance, hostels, and library. OTP attempt count is tracked but a five-attempt lockout is not enforced. The SOLID service layer is partial (`ApplicationService` and `NotificationService` exist; `common/service_api.py` provides shared helpers, not a `ResourceService`).
- The defense slide deck remains a separate deliverable and is not in the repository.

### Deployment check

The frontend URL returned HTTP 200. The first Render API health request timed out, but a retry returned HTTP 200 with `{"status":"ok"}`. Both supplied deployment URLs responded successfully on retry.
