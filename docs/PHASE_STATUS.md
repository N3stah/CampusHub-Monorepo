# CampusHub — Phase Progress Tracker

> Update this file at the end of every work session.  
> Format: `[x]` = complete · `[-]` = in progress · `[ ]` = not started

| Phase | Slice | Backend (Titus) | Frontend (Mark) | Merged to main |
|-------|-------|-----------------|-----------------|----------------|
| 0 | Config & Setup | `[x]` | `[x]` | `[x]` |  
| 1A | Auth Backend | `[x]` | `[ ]` | `[x]` |
| 1B | Auth Frontend | `[x]` | `[x]` | `[x]` |
| 2A/B | Academics | `[x]` | `[-]` | `[ ]` |
| 3A/B | Resources | `[x]` | `[-]` | `[ ]` |
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
- Added a department-filtered student course catalog with enrollment and drop actions.
- Corrected course resource/announcement URLs and response field names; resource download now reads the file URL from the implemented resource detail endpoint.
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

## Backend work still pending for frontend integration

**Updated:** 2026-10-16

The frontend currently references several APIs that are not present in the Django URL configuration. These features will show an API-unavailable error until the corresponding backend work is completed.

### Already implemented and now wired to the frontend

| Endpoint | Frontend use | Contract notes |
|----------|--------------|----------------|
| `GET /api/auth/me/` and `PATCH /api/auth/me/` | Authenticated profile; PATCH permits `first_name`, `last_name`, and `phone_number` | GET currently omits department name, GPA, active state, and phone number. |
| `GET /api/academics/departments/` | Department filter in the student course catalog | Returns an array of department objects. |
| `GET /api/academics/courses/` and `GET /api/academics/courses/<id>/` | Course catalog and detail | List supports `?department=<id>`; catalog contains active courses only. |
| `GET/POST /api/academics/enrollments/` and `DELETE /api/academics/enrollments/<id>/` | Student course list, enroll, and drop | GET/POST are JWT-protected. A dropped enrollment cannot currently be reactivated through POST. |
| `GET /api/resources/courses/<course_id>/resources/` and `GET /api/resources/courses/<course_id>/resources/<id>/` | Course resources and download URL resolution | JWT-protected; the resource detail response supplies `file_url`. |
| `GET /api/resources/courses/<course_id>/announcements/` | Course announcements and student dashboard updates | Response timestamp field is `created_at`. |

### Backend endpoints/features still required

| Priority | Frontend feature waiting on backend | Suggested API contract |
|----------|-------------------------------------|------------------------|
| High | Lecturer directory and lecturer detail | `GET /api/lecturers/`, `GET /api/lecturers/<id>/`; support search/filter and return profile fields plus taught courses. |
| High | Lecturer account management | Admin-only `POST /api/lecturers/`, `PATCH /api/lecturers/<id>/` for profile/active state; validate department and securely create accounts. |
| High | Placement listing and management | `GET/POST /api/placements/`, `GET/PATCH/DELETE /api/placements/<id>/`; enforce officer/admin write permissions and expose active opportunities to students. |
| High | Student placement application submission | `POST /api/placements/<id>/apply/` multipart contract for `cover_note` and optional `cv_file`; enforce student identity, deadline, duplicate-application, and file validation rules. |
| High | Student application history and staff review | `GET /api/applications/` (student sees own applications; officer/admin sees reviewable records), plus officer/admin-only `PATCH /api/applications/<id>/status/` validating pending/shortlisted/accepted/rejected transitions. |
| Medium | Admin overview | `GET /api/admin/stats/` and `GET /api/admin/logs/`; define and document response schemas, pagination, and audit-log visibility. |
| Medium | Student directory currently at `/users/` | `GET /api/users/` with role/search filtering; restrict to admin/officer and avoid exposing sensitive fields unnecessarily. |
| Medium | Profile completeness and ownership | Return the user fields consumed by directory/profile UI where permitted, and enforce ownership/role checks on every management endpoint (not just frontend navigation). |
| Medium | Enrollment recovery | Define whether students may re-enroll after dropping; if yes, update an existing dropped enrollment to active instead of returning a duplicate-enrollment error. |
| Medium | Secure resource delivery | Confirm whether direct `MEDIA_URL` URLs may be public. If resources must be private, provide an authenticated download response/stream or short-lived download URL. |

### Backend verification still required

- Add automated tests for auth, academics, resource/announcement access control, and all new management/application endpoints; the phase entries above only record manual smoke tests where noted.
- Exercise success and failure cases for JWT expiry/refresh, invalid input, wrong-role access, ownership boundaries, duplicate enrollment/application, deadlines, and missing resources.
- Confirm API fields and status codes against the contracts above, particularly error payloads (`error` versus `detail`), and document pagination behavior.
- Run the integrated frontend against a migrated backend with representative student, lecturer, officer, and admin accounts; do not treat UI role checks as authorization.
- Frontend validation on 2026-10-16: `npx tsc --noEmit` and `npm run build` passed; `npm run lint` completed with zero errors and two pre-existing warnings.


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