# Frontend/backend endpoint verification

Checked 2026-10-19 against the frontend API calls, backend URL configuration, backend views, and the local API at `http://127.0.0.1:8000`. No application code or application data was changed.

## Verified working in live unauthenticated requests

| Request | Result |
|---|---|
| `GET /api/academics/departments/` | `200`; returned a JSON list |
| `GET /api/academics/courses/` | `200`; returned a JSON list |
| `GET /api/academics/courses/1/` | `200`; returned course data |
| `POST /api/auth/register/` with `{}` | `400`; expected required-fields validation, confirms route and method |
| `POST /api/auth/token/` with `{}` | `400`; expected required-fields validation, confirms route and method |
| `POST /api/auth/token/refresh/` with `{}` | `400`; expected missing-token validation, confirms route and method |

The three POST probes used invalid empty payloads and did not create or update application records.

## Routes present but not verified with an authenticated request

These existing routes were probed without a bearer token and returned `401 Authentication required`. This confirms the route and authentication guard respond, but does **not** verify successful behavior with a valid token:

- `GET`/`PATCH /api/auth/me/` (`GET` probed; returned `401`)
- `GET`/`POST /api/academics/enrollments/` and `DELETE /api/academics/enrollments/{enrollment_id}/` (`GET` probed; returned `401`)
- `GET`/`POST /api/resources/courses/{course_id}/resources/`
- `GET`/`DELETE /api/resources/courses/{course_id}/resources/{resource_id}/`
- `GET`/`POST /api/resources/courses/{course_id}/announcements/`
- `GET /api/resources/courses/{course_id}/announcements/{announcement_id}/`

The frontend currently calls different resource and announcement paths (see below). No valid user token was available to test authenticated success, role permissions, or database-dependent behavior for these APIs.

## Confirmed frontend calls returning 404

The following calls were probed against the live API without credentials and returned `404`:

| Frontend call | What is missing or mismatched |
|---|---|
| `GET /api/courses/{course_id}/resources/` | Frontend prefix differs from registered `/api/resources/courses/{course_id}/resources/` |
| `GET /api/courses/{course_id}/announcements/` | Frontend prefix differs from registered `/api/resources/courses/{course_id}/announcements/` |
| `GET /api/resources/{resource_id}/download/` | No matching download route is registered |
| `GET /api/placements/` | No placements route is registered |
| `GET /api/users/?role=student` | No users directory route is registered |
| `GET /api/lecturers/` | No lecturers route is registered |
| `GET /api/lecturers/{lecturer_id}/` | No lecturer detail route is registered |
| `GET /api/applications/` | No applications route is registered |
| `GET /api/applications/{application_id}/status/` | No application status route is registered |
| `GET /api/admin/stats/` | No JSON admin stats route is registered |
| `GET /api/admin/logs/` | No JSON admin logs route is registered |

For the last endpoint, the frontend uses `PATCH`, not `GET`; the GET probe confirms the path is not registered, and the backend URL configuration contains no applications route. Django's separate `/admin/` site does not provide the frontend's JSON stats/logs APIs.

## Backend work needed to support current frontend calls

### Placements

- [ ] `GET /api/placements/` — list/filter placements; frontend supplies `page`, `search`, and `is_active`.
- [ ] `POST /api/placements/` — create a placement.
- [ ] `PATCH /api/placements/{placement_id}/` — update a placement.
- [ ] `DELETE /api/placements/{placement_id}/` — remove a placement.
- [ ] `POST /api/placements/{placement_id}/apply/` — accept multipart `cover_note` and optional `cv_file`.

### Applications

- [ ] `GET /api/applications/` — list applications for students/reviewers with pagination and appropriate access control.
- [ ] `PATCH /api/applications/{application_id}/status/` — update an application status for authorized reviewers.

### Users and lecturers

- [ ] `GET /api/users/` — provide the student directory; support `role`, `page`, and `search`.
- [ ] `GET /api/lecturers/` — provide lecturer directory results with pagination/search.
- [ ] `POST /api/lecturers/` — create a lecturer account.
- [ ] `GET /api/lecturers/{lecturer_id}/` — provide lecturer details requested by the course detail page.
- [ ] `PATCH /api/lecturers/{lecturer_id}/` — update lecturer fields and active status.

### Administration

- [ ] `GET /api/admin/stats/` — return `active_users`, `lecturers`, `open_placements`, and `pending_applications`.
- [ ] `GET /api/admin/logs/` — return paginated audit items with `id`, `action`, `created_at`, and optional `actor`/`description`.

### Resources

- [ ] Either add frontend-compatible aliases `GET /api/courses/{course_id}/resources/` and `GET /api/courses/{course_id}/announcements/`, or change the frontend to use the existing `/api/resources/courses/{course_id}/...` prefix.
- [ ] Add `GET /api/resources/{resource_id}/download/` as called by the frontend, or change the frontend to use the existing nested resource detail route and its `file_url`.

## Contract inconsistencies to resolve

- [ ] Resource list responses use backend fields `created_at` and `file_type`; frontend types/display use `uploaded_at` and `file_name`. Align the response or frontend expectations.
- [ ] Announcement responses use backend `created_at`; the frontend type/display expects `published_at`. Align the field names.
- [ ] Backend error responses use `{"error": "..."}` in the inspected views; shared frontend error handling and the login page primarily read `detail`. Align error contracts or make the frontend recognize both.
- [ ] `/api/auth/me/` returns `id`, `email`, `username`, names, `role`, `department`, and `date_joined`; the frontend `User` type also requires `full_name`, `gpa`, and `is_active`. Confirm and align the profile contract before relying on those fields.

## Verification limits

The existing backend auth test module was not runnable in the local shell: pytest collection failed because Django is not installed in that Python environment. `python manage.py check` failed for the same reason. No dependencies were installed. Authenticated success cases, write operations, role permissions, and frontend page behavior remain unverified.
