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

feature/frontend-student-and-staff-pages
## Phase 2B — Frontend Progress (In Progress)

**Date:** 2026-10-15
**Branch:** `feature/frontend-student-and-staff-pages`
**Commits pushed:** `548c0f1` (portal workflows), `3c2f121` (landing and registration)

**Student workflows implemented:**
- Student dashboard with active courses, course announcements, placement opportunities, and application statuses.
- My Courses page backed by `GET /api/academics/enrollments/`.
- Course detail page with course and lecturer information, resources, resource downloads, and lecturer announcements.
- Placement application form with a cover note and optional CV upload.

**Lecturer and placement workflows implemented:**
- Searchable lecturer directory; admin create, edit, deactivate, and reactivate controls.
- Placement listing page; officer/admin create, edit, and remove controls.
- Officer/admin application review table with pending, shortlisted, accepted, and rejected status updates.
- Admin overview with stats, management links, role-access summary, and recent activity.

**Shared frontend work:**
- Role-aware portal navigation and page access checks.
- Reusable paginated directory table and API response/error helpers.
- Loading, retry, error, and empty states across API-backed screens.
- Updated landing and registration pages.

**Validation completed:**
- `npx tsc --noEmit` — passed.
- `npm run build` — passed.
- `npm run lint` — no errors; two warnings remain in existing files (`register/page.tsx` and `lib/api.ts`).

**Remaining work / integration blockers:**
- Frontend changes are pushed to `feature/frontend-student-and-staff-pages`; they are not yet merged to `main`.
- Academics backend currently supports enrollment and course detail, but resource and announcement endpoints are not implemented.
- Lecturer directory CRUD, placement CRUD, and application review endpoints are not yet implemented in the backend.
- Add and verify server-side role and ownership permissions for management, downloads, and application status changes. Frontend role checks only control the UI.
- Test the complete student and staff workflows against the backend once the remaining endpoints are available.


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

## Updated Backend Compatibility Check — 2026-10-21

- Checked the pulled workspace at `d60fe70` (`feature/frontend-security-basics`) against Django's resolved URL configuration.
- Registered API routes currently cover auth (`/api/auth/`), academics (`/api/academics/`), and course resources/announcements (`/api/resources/`).
- Corrected frontend GET paths for course resources and announcements to use the registered `/resources/courses/<id>/...` prefix, and aligned announcement timestamps with the backend's `created_at` response field.
- Removed lecturer dashboard/course-detail calls to the unregistered `/lecturers/<id>/` profile endpoint; the lecturer dashboard uses `/academics/courses/` and the authenticated user's profile instead.
- Removed success claims that course upload/announcement sends notifications; this backend revision has no notification endpoint or notification hooks.
- Not present in the resolved API routes: placement/application workflows, notifications, users/lecturers management, admin stats/logs. Their frontend screens cannot successfully integrate against this pulled backend until the matching routes are included. Course/department CRUD and lecturer rosters are also absent.
- Validation: Django system check passed; migration check reports no changes; 16 auth tests passed. Full pytest collection currently fails with an import-file mismatch between `apps/accounts/tests.py` and the `apps/accounts/tests` package. Frontend TypeScript check and production build passed; lint passed with the existing warning in `src/lib/api.ts`.

## Admin Academics and Lecturer Course CRUD — Frontend/Backend Contract

The frontend now includes an admin workspace for department/course management and lecturer assignment, plus lecturer controls for creating, editing, and deleting course resources and announcements. The admin department/course mutations, lecturer directory/account APIs, resource updates, and announcement updates/deletes are not available in the currently pulled backend. The UI reports API errors rather than treating unsupported operations as successful.

### Admin departments and courses

- Keep `GET /api/academics/departments/` and `GET /api/academics/courses/`; return JSON arrays (or the standard paginated `{count, results}` shape) including the IDs and fields used by the admin selectors.
- Implement admin-only department endpoints:
  - `POST /api/academics/departments/` with `{name, code, head_id}` (`head_id` nullable).
  - `GET`, `PATCH`, and `DELETE /api/academics/departments/<id>/`.
  - Validate unique department codes and that a non-null `head_id` refers to an active lecturer. Make DELETE a safe deactivation operation; preserve departments referenced by courses/enrollments/resources, and add an `is_active` field/migration if required.
- Implement admin-only course mutations:
  - `POST /api/academics/courses/` with `{title, code, department_id, lecturer_id, credits, description}` (`lecturer_id` nullable).
  - `PATCH` and `DELETE /api/academics/courses/<id>/` alongside the existing GET detail.
  - Validate unique course codes, positive/valid credits, active department and lecturer references. DELETE should deactivate rather than cascade-delete courses and their enrollments/resources.
- All endpoints must authorize by role server-side and return field-specific JSON validation errors suitable for the frontend.

### Lecturer directory and account administration

- Implement admin-only `GET /api/lecturers/` with `{id, first_name, last_name, email, username, department, title, bio, office_hours, is_active}` for the directory and course/department assignment selectors.
- Implement admin-only `POST /api/lecturers/` and `PATCH /api/lecturers/<id>/`. The create payload includes identity fields, `role: "lecturer"`, optional `department`, and required `password`; update accepts editable profile fields, optional replacement password, and `is_active` for deactivate/reactivate.
- Validate email/username uniqueness, role constraints, password policy, and department references. Do not expose password hashes or allow non-admin account/role escalation.

### Lecturer-owned course content CRUD

- Keep existing resource `GET/POST /api/resources/courses/<course_id>/resources/` and `GET/DELETE /api/resources/courses/<course_id>/resources/<id>/`.
- Add `PATCH /api/resources/courses/<course_id>/resources/<id>/` accepting multipart `title`, `description`, and optional replacement `file`. Retain the file-size/type checks for replacement uploads.
- Keep existing announcement `GET/POST /api/resources/courses/<course_id>/announcements/` and GET detail. Add `PATCH` and `DELETE /api/resources/courses/<course_id>/announcements/<id>/`, accepting JSON `{title, body}` for PATCH.
- Restrict mutations to the assigned course lecturer (for announcements and resource creation/update) and resource uploader where applicable, plus admins. Students retain read-only access only when enrolled; lecturers may read courses they teach. Return 403/404/400 responses consistently, and ensure failed mutations do not alter records/files.
- The current resource DELETE permission checks uploader/admin, so the frontend surfaces permission failures for a lecturer attempting to delete another uploader's file. Decide whether assigned lecturers should also be allowed to delete course resources and align the backend policy and UI with that decision.
- Do not promise notifications on announcement creation until a notification mechanism and corresponding backend contract are implemented.

### Lecturer roster (separate endpoint required)

- Add `GET /api/academics/courses/<course_id>/enrollments/`, restricted to the assigned lecturer or admin, returning enrolled students with stable IDs, names, email (if permitted), and enrollment status/date. The current enrollment list returns only the authenticated user's enrollments and cannot serve as a lecturer roster.

### Admin department and multi-course assignment pages

- The admin frontend now has dedicated `/admin/departments` and `/admin/courses` pages linked from the administration overview and admin navigation.
- For department member lists, support `GET /api/users/?role=student&department_id=<id>` and `GET /api/lecturers/?department_id=<id>`. Responses should include the directory fields needed by the frontend and support pagination consistently.
- Support admin-only `PATCH /api/users/<id>/` and `PATCH /api/lecturers/<id>/` department reassignment with `{department: <department_id>}`. Validate that the destination department exists and is active; return field-specific errors. The department page refreshes the selected department roster after a successful move.
- The course page supports selecting several courses and assigning/unassigning the same lecturer in one operation. Add admin-only `POST /api/academics/courses/assign-lecturer/` accepting `{course_ids: number[], lecturer_id: number | null}`. Validate every course and lecturer before writing, apply the changes atomically (all-or-nothing), and return the updated course assignments. A lecturer must be active and eligible for the selected courses.
- The page also uses the department/course mutation endpoints listed above for course creation, editing, and safe deactivation.

### Verification required

- Add API tests for allowed admin CRUD, assigned-lecturer content mutations, uploader restrictions, student read-only access, invalid references/duplicate codes, and role-denial cases.
- Add tests for department-filtered rosters, student/lecturer department reassignment, atomic multi-course lecturer assignment, and rejection of mixed valid/invalid course IDs.
- Verify safe deactivation and that related records/files remain intact.
- Re-run Django checks/tests and frontend typecheck/build after backend implementation; the current frontend branch can only be fully exercised against a backend implementing these contracts.