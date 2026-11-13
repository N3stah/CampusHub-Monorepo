# CampusHub Repository QA Inventory

**Prepared:** 2026-11-12  
**Repository:** `N3stah/CampusHub-Monorepo`  
**Purpose:** Factual repository inventory for preparing a manual QA workbook.  
**Scope note:** This is a source review, not runtime acceptance testing. Frontend routes and backend APIs were inspected alongside relevant tests. No environment files or secret values were read or copied. Existing workspace changes were preserved.

## Status key

- **Implemented** — code for a real UI/API workflow and persistence exists; runtime configuration may still affect delivery.
- **Partial** — some steps are implemented, but meaningful behavior or integration is missing/unclear.
- **UI-only** — current page behavior is local/demo data rather than persisted application records.
- **Not implemented** — no corresponding user-facing or backend workflow was found in the inspected source.
- **UNCLEAR** — source does not establish intended behavior or runtime integration.

## 1. Roles

`User.ROLE_CHOICES` is the authoritative set of persisted roles. The application label “Super Admin” maps to the `admin` role; Django `is_superuser` is a separate flag and should not be assumed to be set for every `admin` role account.

| Stored role | Display label | Landing route after dashboard redirect | Account provisioning observed |
|---|---|---|---|
| `student` | Student | `/dashboard`; student dashboard | Registrar creates student through `/api/users/`; Super Admin can create through account UI/API. Public registration is disabled. |
| `lecturer` | Lecturer | `/dashboard`; lecturer dashboard | Super Admin account UI/API; separate lecturer endpoint is admin-only. |
| `officer` | Placement Officer | `/dashboard`; generic portal/placement overview | Super Admin account UI/API or admin-only lecturer/account endpoints as applicable. |
| `admin` | Super Admin | `/admin` | Super Admin account UI/API; Django superuser creation is separate. |
| `ict_admin` | ICT Administrator | `/ict-admin` | Super Admin account UI/API. |
| `registrar` | Registrar / Academic Officer | `/registrar` | Super Admin account UI/API. |
| `finance` | Finance Officer | `/finance` | Super Admin account UI/API. |
| `hod` | Dean / Head of Department | `/dashboard`; generic portal/placement overview | Super Admin account API can assign valid roles; account UI excludes `hod` from its manageable roles. |
| `examination` | Examinations Officer | `/dashboard`; generic portal/placement overview | Super Admin account API can assign valid roles; account UI excludes `examination` from manageable roles. |
| `librarian` | Librarian | `/library` | Super Admin account UI/API. |
| `hostel` | Hostel Warden | `/hostels` | Super Admin account UI/API. |

**Evidence:** `campushub-backend/apps/accounts/models.py::User.ROLE_CHOICES`, `UserManager.create_superuser`; `campushub-frontend/src/lib/role-access.ts::roleLabels, manageableAccountRoles`; `campushub-frontend/src/app/dashboard/page.tsx::DashboardPage`; `campushub-frontend/src/components/PortalShell.tsx::navigation`; `campushub-backend/apps/accounts/user_views.py::user_list_create, lecturer_list_create`.

**Role caveat:** Finance, librarian, hostel, HOD, and examination are valid persisted roles; their current exposed workflows differ substantially. Do not infer the role’s complete real-world responsibilities from the label.

## 2. Authentication and account lifecycle

| Capability | Observed behavior | Status / caveat | Evidence |
|---|---|---|---|
| Public registration | Frontend explains accounts are created by Registrar/Super Admin. API `POST /api/auth/register/` returns 403. | Implemented as intentionally disabled. | `campushub-frontend/src/app/(auth)/register/page.tsx`; `campushub-backend/apps/accounts/views.py::register_view` |
| Login | Email/password, case-normalized email lookup, active-account check, generic invalid-credential response; access and refresh JWT pair returned. Login attempts are rate-limited to 10/minute per IP. | Implemented. | `apps/accounts/views.py::token_view`; `apps/accounts/jwt_utils.py::make_pair` |
| Tokens | Access JWT default lifetime is 30 minutes; refresh default lifetime is 7 days, configurable in settings. Refresh endpoint issues a new access token. Frontend stores both in local storage and retries one 401 with refresh. | Implemented; persistence is browser local storage. No server-side refresh-token revocation mechanism found in the inspected code. | `apps/accounts/jwt_utils.py`; `config/settings/base.py`; `campushub-frontend/src/lib/api.ts` |
| Logout | Client removes access/refresh tokens and routes to `/login`; no server logout/revocation endpoint in `apps/accounts/urls.py`. | Implemented client-side only. | `campushub-frontend/src/context/AuthContext.tsx::logout`; `apps/accounts/urls.py` |
| Role landing | `/dashboard` redirects admin, ICT Admin, Registrar, Finance, Librarian, and Hostel roles to their role home; student/lecturer get dedicated dashboards. Officer/HOD/Examination have no dedicated redirect in this file. | Partial: remaining roles land on generic dashboard rendering. | `campushub-frontend/src/app/dashboard/page.tsx::DashboardPage` |
| Authorization guard | `PortalShell` checks requested role client-side and redirects to dashboard; backend JWT middleware checks active account and forced password change. API permission checks vary per app. | UI route guard is not a substitute for API authorization. | `campushub-frontend/src/components/PortalShell.tsx`; `apps/accounts/jwt_utils.py::jwt_required` |
| Forced first password change | Invitations set `must_change_password` and a 48-hour expiry; JWT middleware blocks most API routes until changed. Frontend redirects to `/change-password`. | Implemented for initial credentials. | `apps/accounts/user_views.py::user_list_create, resend_user_invitation`; `apps/accounts/jwt_utils.py`; `app/(auth)/change-password/page.tsx` |
| Change password | Requires current password and Django password validators; clears forced-change state. | Implemented. | `apps/accounts/views.py::password_change_view, me_view`; `config/settings/base.py::AUTH_PASSWORD_VALIDATORS` |
| Forgot password | UI uses one-time email code endpoints. OTP is hashed, expires in 10 minutes, issuance/confirmation rate-limited to 10/minute per IP; issuance throttles repeated codes at 60 seconds. | Implemented; SMTP/provider delivery outcome depends on runtime configuration. | `app/(auth)/forgot-password/page.tsx`; `apps/accounts/views.py::password_otp_request, password_otp_confirm`; `apps/accounts/models.py::PasswordResetOTP` |
| Legacy reset link | Separate `/api/auth/password/reset/` and `/confirm/` endpoints remain mounted. Request handler logs the generated reset token and does not send it through the shown email helper; confirm handler does not call `validate_password`. Frontend `/reset-password` redirects to OTP reset. | **Suspected defect / high-priority verification:** legacy flow is disconnected from the UI and token logging may expose a credential in logs. Do not test using real accounts. | `apps/accounts/views.py::password_reset_request_view, password_reset_confirm_view`; `app/(auth)/reset-password/page.tsx` |
| Password reset models | `PasswordResetToken` uses UUID, one-use timestamp and 24-hour default expiry. `PasswordResetOTP` stores a hash, attempts, expiry, consumed timestamp. | Implemented; legacy link path’s mail/policy behavior differs from OTP path. | `apps/accounts/models.py::PasswordResetToken, PasswordResetOTP` |
| Profile | `/api/auth/me/` supports own-profile GET/PATCH for name, phone, title, bio, office hours; password change is also supported through that route. | Implemented. | `apps/accounts/views.py::me_view` |
| Profile image | Authenticated upload; extension allow-list JPG/JPEG/PNG/WebP; max 10 MiB; image is center-cropped/resized to 320x320 JPEG. | Implemented; tests exist. | `apps/accounts/views.py::upload_profile_picture`; `apps/common/file_guards.py::validate_image_upload` |
| Account creation/invites | Registrar may create only student accounts and must request initial-email delivery. Admin can assign roles; optional invite email. API reports sent/failed; invitation resend is admin-only. | Implemented, but email is not guaranteed to deliver. | `apps/accounts/user_views.py::user_list_create, resend_user_invitation`; `apps/accounts/emailing.py` |
| Deactivation | Admin can deactivate/reactivate other users through detail API; self-modification is rejected. Last-active protection checks `is_superuser`, not explicitly the `admin` role. | Implemented with a protection caveat; whether every `admin` role account is a superuser is not established by the account UI. | `apps/accounts/user_views.py::user_detail_update_deactivate` |
| Account access reset | Frontend stores bearer tokens in local storage; no browser-cookie session implementation observed. | Implemented as bearer-token client. | `campushub-frontend/src/context/AuthContext.tsx`; `src/lib/api.ts` |

## 3. Frontend routes

All pages using `PortalShell roles={...}` apply a client-side role check. API endpoint permissions remain authoritative and are listed in section 4. Pages with no explicit `roles` prop generally allow any authenticated role through the shell. Auth pages are outside the portal shell.

| Route | Source | Frontend roles | Navigation exposure | Data source / status |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` | Public | Brand link | Landing UI; inspect deployment for target. |
| `/login` | `src/app/(auth)/login/page.tsx` | Public | Login flow | Auth API; implemented. |
| `/register` | `src/app/(auth)/register/page.tsx` | Public | Login page link | Informational page; public registration disabled. |
| `/forgot-password` | `src/app/(auth)/forgot-password/page.tsx` | Public | Login link | OTP auth API; implemented. |
| `/reset-password` | `src/app/(auth)/reset-password/page.tsx` | Public | Not in nav | Redirects to `/forgot-password`; legacy API reset route is separate. |
| `/change-password` | `src/app/(auth)/change-password/page.tsx` | Authenticated | Forced redirect | Auth API; implemented. |
| `/dashboard` | `src/app/dashboard/page.tsx` | Authenticated | Overview for student, lecturer, officer, finance, HOD, examination | Role redirects plus student/lecturer dashboards; generic fallback for other roles. |
| `/admin` | `src/app/admin/page.tsx` | `admin` | Super Admin | User, lecturer, AI, logs links; implemented shell. |
| `/admin/stats` | `src/app/admin/stats/page.tsx` | `admin` | Campus stats | Stats API/directories; implemented. |
| `/admin/logs` | `src/app/admin/logs/page.tsx` | `admin` | Logs | Admin logs API; implemented. |
| `/users` | `src/app/users/page.tsx` | `admin` | User accounts | User API with account create/edit/status/invitation actions; implemented. |
| `/lecturers` | `src/app/lecturers/page.tsx` | `admin` | Lecturers | Lecturer APIs; implemented. |
| `/ict-admin` | `src/app/ict-admin/page.tsx` | `ict_admin` | ICT Administration | Academic structure entry points; writes are currently denied by APIs restricted to `admin` (see finding). |
| `/admin/schools` | `src/app/admin/schools/page.tsx` | `ict_admin` | Schools | Schools API; read works for authenticated users, writes admin-only. |
| `/admin/departments` | `src/app/admin/departments/page.tsx` | `ict_admin` | Departments | Departments API; writes admin-only. |
| `/admin/courses` | `src/app/admin/courses/page.tsx` | `ict_admin` | Programmes | Course API; writes admin-only. |
| `/admin/units` | `src/app/admin/units/page.tsx` | `ict_admin` | Units and teaching | Unit API; backend write role checks need per-action verification. |
| `/registrar` | `src/app/registrar/page.tsx` | `registrar` | Registrar office | Admissions, accounts, enrolments, registrations, periods and other links. |
| `/registrar/students` | `src/app/registrar/students/page.tsx` | `registrar` | Register student account | `/users/` student lookup plus account creation; list and onboarding implemented. |
| `/admissions` | `src/app/admissions/page.tsx` | `registrar` | Admissions | Applications API; implemented. |
| `/admin/enrollments` | `src/app/admin/enrollments/page.tsx` | `registrar` | Programme admissions | `/academics/admin/enrollments/`; Registrar endpoint support exists in current checkout. |
| `/academics/periods` | `src/app/academics/periods/page.tsx` | `registrar` | Academic periods | API; current later function supports Registrar CRUD/transition (no delete UI). |
| `/academics/registration` | `src/app/academics/registration/page.tsx` | `registrar`, `student` | Both roles | Registrar CRUD and student own-registration view; API-backed. |
| `/examinations` | `src/app/examinations/page.tsx` | `student`, `lecturer`, `examination`, `registrar` | Exams & grades | **UI-only/demo:** hard-coded sample learners and local grade preview. |
| `/verify` and `/verify/[...id]` | `src/app/verify/[[...id]]/page.tsx` | `student`, `registrar` | Credential verification | Route exists; inspect runtime data / exact workflow before treating as persisted verification. |
| `/finance` | `src/app/finance/page.tsx` | `student`, `finance` | Finance | Finance API for invoices, payments, requests and fee schedules; implementation present. |
| `/library` | `src/app/library/page.tsx` | `student`, `librarian` | Both roles | Library APIs; implemented. |
| `/hostels` | `src/app/hostels/page.tsx` | `student`, `hostel` | Both roles | Hostel APIs; implemented. |
| `/placements` | `src/app/placements/page.tsx` | `student`, `officer` | Placements | Placement API; implemented. |
| `/placements/[id]` | `src/app/placements/[id]/page.tsx` | `student`, `officer` | Not a direct nav item | Placement detail API; implemented. |
| `/placements/[id]/apply` | `src/app/placements/[id]/apply/page.tsx` | Student flow | Detail action | Placement application API and optional CV upload; implemented. |
| `/applications` | `src/app/applications/page.tsx` | `student`, `officer` | Applications | Own or posted-placement applications; implemented. |
| `/applications/[id]` | `src/app/applications/[id]/page.tsx` | `student`, `officer` | Linked from list/notifications | Detail API; API scopes to student, posting officer, or admin. |
| `/placement-outcomes` | `src/app/placement-outcomes/page.tsx` | Admin/officer shell | Placement outcomes | Outcomes API; implemented. |
| `/lecturer/units` | `src/app/lecturer/units/page.tsx` | `lecturer` | Units | Academic API; implemented. |
| `/lecturer/units/[offeringId]` | `src/app/lecturer/units/[offeringId]/page.tsx` | Lecturer | Linked from units | Offering/roster/group APIs; implemented. |
| `/lecturer/attendance` | `src/app/lecturer/attendance/page.tsx` | Lecturer | Attendance | Session attendance API; implemented. |
| `/lecturer/lessons` | `src/app/lecturer/lessons/page.tsx` | Lecturer | Lesson plan | Lessons API; implemented. |
| `/lecturer/materials` | `src/app/lecturer/materials/page.tsx` | Lecturer | Learning materials / notes | Resource APIs; implemented. |
| `/lecturer/placements` | `src/app/lecturer/placements/page.tsx` | Lecturer | Student placements | Academic placement roster API; check semantics; implemented. |
| `/assignments` | `src/app/assignments/page.tsx` | Student, lecturer | Assignments | Assignments API; implemented. |
| `/assignments/new/[offeringId]` | `src/app/assignments/new/[offeringId]/page.tsx` | Lecturer | Linked from lecturer workflow | Assignment API/file upload; implemented. |
| `/lecturer/assignments/[assignmentId]` | `src/app/lecturer/assignments/[assignmentId]/page.tsx` | Lecturer | Linked from assignment lists | Submission/grading API; implemented. |
| `/courses` | `src/app/courses/page.tsx` | Student | My courses | Academic API; implemented. |
| `/courses/[id]` | `src/app/courses/[id]/page.tsx` | Student | Linked from course list | Course detail/resources APIs; implemented. |
| `/messaging` | `src/app/messaging/page.tsx` | Authenticated page shell; nav shown to student, lecturer, admin, ICT Admin | Messages (4 roles) | Messaging APIs; broader `PortalShell` access than navigation. Broadcast roles are restricted by backend. |
| `/notifications` | `src/app/notifications/page.tsx` | Authenticated | Header bell for all logged-in users | Own notification API; deep-link handling implemented. |
| `/ai` | `src/app/ai/page.tsx` | Authenticated | Shared floating Campus AI entry | AI API, local browser conversation selection; analytics display only for admin. |
| `/profile` | `src/app/profile/page.tsx` | Authenticated | Not in main navigation | Own profile API; implemented. |

The route tree also includes auth and dynamic routes above. No missing route was established for the static `PortalShell` navigation hrefs by the discovered `src/app` route tree. Several valid routes are intentionally not in the primary nav (e.g. profile, detail pages, `/ai`); notification and Campus AI have separate shell affordances.

**Evidence:** `campushub-frontend/src/components/PortalShell.tsx::navigation`; `src/app/**/page.tsx`; `campushub-backend/apps/common/api_root.py::API_URL_GROUPS`.

## 4. Backend endpoints

All API paths below are under `/api/`. `jwt_required` requires an active user and a valid access token, except explicitly noted public authentication routes. Most app mutations write `AuditEvent` in selected workflows, not universally. Collection pagination uses common helpers or legacy pagination.

| Methods / URL family | View/function(s) | Authorization and scope | Models / notes |
|---|---|---|---|
| `GET /health/` | `common.api_root::health_check` | Public health status. | No app model. |
| `POST /auth/register/` | `accounts.views::register_view` | Public endpoint but always 403 (registration disabled). | User. |
| `POST /auth/token/`, `POST /auth/token/refresh/` | `token_view`, `token_refresh_view` | Public login/refresh; active user required for successful token issuance. | User; access/refresh JWT. |
| `GET/PATCH /auth/me/`, `POST /auth/me/profile-picture/` | `me_view`, `upload_profile_picture` | Authenticated own account only. | User. |
| `POST /auth/password/change/`, `/password/otp/request/`, `/password/otp/confirm/`, `/password/reset/`, `/password/reset/confirm/` | `password_change_view`, OTP and legacy reset views | Change requires auth; OTP/reset request and confirmation public, rate limit on OTP routes only. Legacy reset token request logs token; legacy confirm lacks password validator. | User, PasswordResetOTP, PasswordResetToken, AuditEvent. |
| `GET/POST /users/`, `GET/PATCH/DELETE /users/{id}/`, `POST /users/{id}/resend-invitation/` | `user_list_create`, `user_detail_update_deactivate`, `resend_user_invitation` | GET admin sees all, service roles see active students with role-limited fields; Registrar can create student only; admin manages user records; officer can GET student detail; resend admin-only. | User, Enrollment, AuditEvent. Student lookup excludes inactive students. |
| `GET/POST /lecturers/`, `GET/PATCH /lecturers/{id}/` | `lecturer_list_create`, `lecturer_detail_update` | GET admin/officer/lecturer; create/update admin-only. | User, Department. |
| `GET /admin/stats/`, `GET /admin/stats/directory/{metric}/`, `GET /admin/logs/` | `admin_stats`, `admin_stat_directory`, `admin_logs` | Admin-only. Stats directories include account status/role/department and academic/placement metrics; logs include activity/error logs. | User, School, Department, Course, Unit, Enrollment, Placement, Placement Application, AuditEvent/log records. |
| `GET/POST /academics/periods/`, `GET/PATCH /academics/periods/{id}/`, `PATCH /periods/{id}/set-current/` | Later definitions `period_list_create`, `period_detail_update`, `period_set_current` in `academics.views` | GET period list is broadly authenticated; create/update/set-current requires Registrar/admin. Current endpoint function names are duplicated earlier in `views.py`; Python’s later definition is the one bound at module import. | AcademicPeriod, AuditEvent. Date overlap and current-period rules; no delete in later route method list. |
| `GET/POST /academics/registrations/`, `GET/PATCH /registrations/{id}/` | `registration_list_create`, `registration_detail` | Student sees/creates own registration; Registrar/admin may manage campus registrations; detail scoped to owner or Registrar/admin. | Registration, User, AcademicPeriod, Unit, Offering, Enrollment. Duplicate per student/period/unit rejected; student eligibility checks active period/offering/programme enrollment. |
| `/academics/schools/`, `/departments/`, `/courses/`, `/units/` list/detail routes | `school_*`, `department_*`, `course_*`, `unit_*` | GET generally authenticated; CRUD mutation guards in these views check `role == 'admin'`. ICT Admin frontend uses these APIs, so writes are denied (finding). | School, Department, Course, Unit, User, Offering, assignments. |
| `POST /academics/courses/assign-lecturer/` | `course_bulk_assign_lecturer` | Admin-only. | Course, User, AuditEvent. |
| `/academics/admin/enrollments/` list/create and detail PATCH | `admin_enrollment_list_create`, `admin_enrollment_update` | Current checkout: admin/Registrar; search/status/course filters; student lookup and active course validated; status update audited. | Enrollment, User, Course, Department, School, AuditEvent. |
| `/academics/enrollments/`, `/enrollments/{id}/`, `/enrollments/{id}/prefect/` | `enrollment_list_create`, `enrollment_drop`, `toggle_prefect` | Student self-enrol/drop; prefect endpoint has role-specific guard. | Enrollment, Course, User. Exact broader endpoint guard should be confirmed for each method. |
| Academic offering/session/calendar/attendance | `/academics/offerings/{id}/`, `roster/`, `at-risk/`, `sessions/`, `/sessions/{id}/attendance/`, `/calendar/`, `/calendar.ics` | Authenticated, assignment/enrollment/lecturer scopes vary by view; students/lecturers are scoped to their academic data. | Offering, UnitTeachingAssignment, Enrollment, ClassSession, AttendanceRecord, AcademicPeriod. |
| Academic assignment/submission/group/lesson/report | `/academics/assignments/`, `/offerings/{id}/assignments/`, `/assignments/{id}/`, `/attachment/`, `/submission/`, `/submissions/`, `/submissions/{id}/download/`, `/submissions/{id}/grade/`, `/offerings/{id}/grades.csv`, `/roster.csv`, `/groups/`, `/lessons/`, `/lessons/{id}/` | Student/lecturer roles with ownership or assigned-offering restrictions; some endpoints may permit admin. See individual view guards. | Assignment, AssignmentQuestion, AssignmentSubmission, Offering, StudentGroup, Lesson, Enrollment. |
| `/academics/dashboard/student/`, `/dashboard/lecturer/`, `/lecturer/placements/` | student/lecturer dashboard, lecturer placement roster | Authenticated role-specific data; lecturer assignment scoping should be verified. | Enrollment, Offering, User, Attendance and related academic models. |
| `/admissions/applications/`, `/applications/{id}/` under admissions prefix | `admissions.views::application_list_create, application_detail` | Registrar/admin; uses transitions below and collection search/status filtering. | Admissions Application, Course, AuditEvent. |
| `/finance/fee-structures/`, detail | `fee_structure_list_create`, `fee_structure_detail` | Finance/admin only. | FeeStructure, Course, AuditEvent. |
| `/finance/invoices/`, detail | `invoice_list_create`, `invoice_detail` | Student GET own invoices; Finance/admin create/manage; detail hides other students’ invoices as 404. | Invoice, FeeStructure, Enrollment, User, Payment. |
| `/finance/payments/`, detail, `/payments/{id}/void/` | `payment_list_create`, `payment_detail`, `payment_void` | Student GET own payments; Finance/admin create/update/void; void requires confirmed payment and reason and creates one-to-one reversal. | Payment, PaymentReversal, Invoice, AuditEvent. |
| `/finance/payment-requests/` | `payment_request_list_create` | Student GET is own requests; Finance/admin GET is campus list; only Student POST creates a request for own invoice. No request update/review endpoint or payment gateway integration established in source. | PaymentRequest, Invoice, User, AuditEvent. |
| `/library/books/`, detail; `/loans/`, detail; `/reservations/`, detail | `book_*`, `loan_*`, `reservation_*` | Student catalogue and own loans/reservations; librarian/admin catalogue and circulation actions. | Book, Loan, Reservation, User, AuditEvent. |
| `/hostels/`, detail; `/rooms/`, detail; `/allocations/`, detail | `hostel_*`, `room_*`, `allocation_*` | Student reads active hostels/rooms and own allocations; Hostel Warden/admin manages; Student creates own request. | Hostel, Room, Allocation, User, AuditEvent. |
| `/placements/`, detail, `/placements/{id}/apply/` | `placement_list_create`, detail, `apply_to_placement` | Authenticated placement list; officer/admin manage; student applies; CV access has participant/owner checks. | Placement, placement Application, User, AuditEvent. |
| `/applications/`, `/applications/{id}/`, `/withdraw/`, `/status/`, `/cv/`, `/admin/placement-outcomes/` | placement application views | Student sees own; officer sees applications for own posted placements; admin sees all; officer/admin update statuses/outcomes. | Placement, Application, User, AuditEvent. |
| `/resources/courses/{course_id}/resources/`, detail/download; offerings resource/announcement routes | `resources.views` resource/announcement views | Authenticated; course/assignment/active enrollment checks; admin or assigned lecturer modifies; students access permitted offering content. | Resource, Announcement, Course, Offering, StudentGroup, Enrollment. |
| `/notifications/`, `/read-all/`, `/unread-count/`, `/{id}/read/` | notification views | Authenticated own notifications only; mark-read query scopes recipient. | Notification. |
| `/messaging/conversations/`, `/direct/`, `/recipients/`, `/broadcast/`, conversations messages/read, message delete, offering group conversation | messaging views | Authenticated; conversation access requires membership. Broadcast allowed audiences per role (section 7); direct DM limited to admin or student/lecturer course relationship. | Conversation, ConversationParticipant, Message, Notification, User, Offering, Enrollment. |
| `/ai/feed/`, `/chat/`, `/chat/{id}/`, `/tasks/`, `/task/`, `/analytics/` | AI views | JWT required; feed/chat/history/tasks execute own-user context; tasks restricted by role registry; analytics admin-only. | AIInsight, AIConversation, AIMessage, AITaskLog, academic/placement context. AI provider can fall back to mock provider when no external provider is configured. |

**Backend route aggregation:** `campushub-backend/config/urls.py` mounts `/api/`; `apps/common/api_root.py::API_URL_GROUPS` mounts each app; each app’s `urls.py` is the route source. The academics route list has 46 declarations; other endpoint families are in their app `urls.py`.

## 5. Models and persisted status

| App / model | Important fields, relationships, choices and constraints |
|---|---|
| Accounts `User` | Unique email/username/admission number; role choices listed in section 1; optional Department; GPA nullable with DB check 0–4; active/staff flags, invitation status (`not_sent/sent/failed`), `must_change_password`, initial-password expiry, profile fields/image. |
| Accounts `AuditEvent` | Nullable actor, action, description, created timestamp; newest first. |
| Accounts `PasswordResetToken` | User FK, UUID unique token, created/used/expiry; default expiry 24 hours; one-use via `used_at`. |
| Accounts `PasswordResetOTP` | User FK, hash, created/expiry, attempt count, consumed timestamp; indexed by user and newest. OTP handling enforces 6-digit input and expiry in view. |
| Academics `School` | Unique name/code, active flag, creation time. |
| Academics `Department` | Unique name/code; optional School and head (User) FKs; school/head set null on deletion. |
| Academics `Course` (programme) | Unique code, title, Department FK, optional assigned lecturer, credits, description, active flag. Department deletion cascades to courses. |
| Academics `AcademicPeriod` | Name/year/start/end; status `planned/active/completed`; `is_current`; conditional unique constraint permits one current period. View also rejects date overlaps and has transition validation. |
| Academics `Registration` | Student, period, Unit FKs; status `registered/dropped/completed`; registered date; unique student-period-unit. Student registration requires eligible active programme offering and a valid active period. Transitions in detail view: registered→dropped/completed; dropped→registered; completed terminal. |
| Academics `Unit` | Unique code, title, credits, description, active flag, many-to-many Departments. |
| Academics `Offering` | Unit/Course FKs, optional AcademicPeriod, active flag; unique unit/course. |
| Academics `UnitTeachingAssignment` | Offering/Lecturer FKs; unique offering/lecturer. |
| Academics `Enrollment` | Student/Course FKs, enrolled timestamp, status `active/dropped/completed`, prefect flag; conditional unique active enrollment per student. |
| Academics `ClassSession` | Offering, day/time/date range, location. |
| Academics `AttendanceRecord` | Session/student/date/status (`present/late/absent/excused`), note, recorder; unique session/student/date. |
| Academics `Assignment` | Offering, title/instructions, type `file/quiz`, allowed file types JSON, due date, max points, publish flag, optional attachment. |
| Academics `AssignmentQuestion` | Assignment, prompt, options JSON, correct option index; code notes correct option must not be serialized to students. |
| Academics `AssignmentSubmission` | Assignment/student unique pair; file or answer JSON; submitted/graded/released timestamps, score, feedback. |
| Academics `GroupSet`, `StudentGroup` | One GroupSet per Offering; naming `letters/numbers`, group size; groups belong to set, members many-to-many. Signal prevents one student joining multiple groups in a GroupSet. |
| Academics `Lesson` | Offering, title/description, scheduled timestamp and duration. |
| Admissions `Application` | Applicant name/email/phone, protected Course FK, notes, timestamps; status submitted/under_review/offered/accepted/rejected/withdrawn; unique email+programme. View transition graph is more restrictive than choices. |
| Finance `FeeStructure` | Course/programme protected FK, year/name/amount/due date/status active/inactive; unique name+programme+year and nonnegative amount. |
| Finance `Invoice` | Unique generated invoice number, protected student and fee FKs, positive amount, due date, status draft/issued/partially_paid/paid/overdue/cancelled. Invoice amount may not fall below confirmed payment total; status is partly derived from payment totals. |
| Finance `Payment` | Protected invoice FK, positive amount, method mpesa/bank/card/cash, unique reference, paid date, status pending/confirmed/failed/voided. Confirmed/failed transitions restricted; confirmed uses void flow. |
| Finance `PaymentReversal` | One-to-one protected Payment, actor, mandatory reason, timestamp. |
| Finance `PaymentRequest` | Invoice/student FKs, method mpesa/bank/card, phone, status pending/confirmed/failed/cancelled. |
| Library `Book` | Optional unique ISBN, title/author/category/copy count/location; available/inactive; copy count >=1. |
| Library `Loan` | Protected Book/student, borrow/due/return dates, active/returned/overdue/lost/cancelled; view enforces due/return dates and transitions. |
| Library `Reservation` | Protected Book/student, reserved/expiry dates; queued/ready/fulfilled/cancelled/expired; queue promotion logic exists. |
| Hostels `Hostel` | Unique name, location, gender policy male/female/mixed, positive capacity, active/inactive. |
| Hostels `Room` | Hostel FK, room number/capacity/status available/full/maintenance; unique hostel+room and positive capacity. |
| Hostels `Allocation` | Protected student and room FKs, year/date range; requested/allocated/checked_in/checked_out/cancelled; view enforces status graph and date overlap/capacity. |
| Placements `Placement` | Owner/poster, title/company/location/description/requirements, future deadline validator, slots >=1, active flag. |
| Placements `Application` | Student/Placement FKs, status pending/shortlisted/accepted/rejected/withdrawn, cover note, optional CV, review actor/time; unique student+placement. |
| Messaging `Conversation` | direct/group kind; optional Offering FK. |
| Messaging `ConversationParticipant` | Conversation/User; admin-in-conversation flag, join/last-read timestamps; unique participant per conversation. |
| Messaging `Message` | Conversation/sender/body, created and soft-delete timestamp. |
| Notifications `Notification` | Recipient, optional actor, verb/message/internal link, read flag, digest timestamp; indexed recipient/read/date. |
| Resources `Resource` | Course and optional Offering, uploader, title/file/type/size/download count/category. |
| Resources `Announcement` | Course/optional Offering, author, title/body/pinned/scheduled/dispatched dates, optional StudentGroup. |
| AI `AIConversation` | User-owned conversation, role context/title/timestamps. |
| AI `AIMessage` | Conversation, role user/assistant, content/provider/time. |
| AI `AIInsight` | User-owned type/content JSON/generated/expiry. |
| AI `AITaskLog` | Nullable user, task/input/output summaries/provider/success/time. |

**Evidence:** app-specific `models.py`; status transitions and validation live in corresponding `views.py`/services and are not universally encoded as database constraints.

## 6. Workflows per module

| Module | What source establishes | Status |
|---|---|---|
| Admissions | Registrar/admin create/list/update applicant records, search/filter/order, duplicate email+programme rejected, validated email and active programme required. New applications start submitted. Transition graph: submitted→under_review/withdrawn; under_review→offered/rejected/withdrawn; offered→accepted/rejected/withdrawn; terminal accepted/rejected/withdrawn. Does not itself create student login or send an application decision email in inspected view. | Implemented |
| Registrar student onboarding | Registrar creates student only; admission confirmation checkbox is frontend; chosen active course passed into account creation; backend creates programme Enrollment and generates initial sign-in credential when email is requested. Email result may be sent or failed; no queued outcome is emitted by this backend view. Registrar student list uses active, limited `/users/` results, search and pagination. | Implemented |
| Registrar programme enrollment | API supports lookup by exact admission number, active student and active course, filtered/searchable list, status change, and audit event. Duplicate active enrollment in the same programme returns conflict; changing active course drops old active enrollment first. | Implemented in current checkout |
| Registrar semester registration | Registrar can list/create/update registrations; student creates own records during valid active period for a unit offered to active enrolled programme; duplicate record conflict; history retained. | Implemented |
| Academic periods | Later view definitions support Registrar/admin create/read/update and switching current period; overlap and dates/status transitions validated. No delete route in current API. Earlier duplicate definitions remain in file and are shadowed at import. | Implemented; duplicated legacy source is confusing |
| ICT academic structure | UI exposes Schools, Departments, Programmes and Units/teaching. API list reads work for authenticated users, but shown CRUD mutations check `role == 'admin'`, not `ict_admin`. | **Partial / broken for ICT Admin writes** |
| Super Admin accounts | Admin can search/paginate roles, create/edit, resend initial invitation, deactivate/reactivate. Self-edit/deactivation denied. Backend allows lookup role filters; writes restricted admin. | Implemented |
| Campus stats | Admin stats endpoint and metric-specific searchable paginated directories for users, schools, departments, courses, units, enrolments, placements and applications. | Implemented |
| System logs / audit | Admin logs page filters activity/error and paginates. `AuditEvent` created by multiple operations; errors also represented in server log pipeline. Page renders exception traceback in expandable block, so QA should verify sensitive data is not present in logs. | Implemented; scope/data hygiene needs runtime test |
| Student dashboard/academics | Student dashboard, my courses, own schedule/registrations, resources, assignments/submissions and course group features are API-backed. Student registration rules enforced in API. | Implemented, dependent on valid setup |
| Lecturer teaching | Lecturer units, offerings, sessions, attendance, lessons, resources/announcements, groups, assignments/submissions/grading. Access generally scoped to assigned offerings, but direct endpoint permission checks should be tested. | Implemented |
| Examinations/results | `/examinations` contains three hardcoded learners and grade values; weights and grade calculations exist only in React state, and “Update grade book” says preview updated locally. No persisted exam-results endpoint/model identified in the inspected route/model inventory. | **UI-only/demo** |
| Finance | Fee structure CRUD, invoices, payment entry/status reconciliation, void with reason/reversal, student own invoice/payment views and payment requests. Confirmed payments drive invoice balances/status. Payment-request API is not evidence of an integrated payment gateway. Current finance page places “Make a payment” form in the Finance-only branch, but its invoice options load only for Student, while API request creation is student-only; Student branch does not render this form. | Partial; payment-request UI is mismatched |
| Library | Catalogue search/filter; librarian/admin manage books, loans, reservations; student own loans/reservations. Copy availability, duplicate loan/reservation, queue promotion and transitions validated. | Implemented |
| Hostel | Inventory, room capacity/occupancy, student requests, warden allocation/status workflow; overlap and room-capacity checks. Admin also accepted by backend WARDEN_ROLES, while frontend page is only student/hostel. | Implemented with role exposure difference |
| Placements | Officer/admin manage placements; student applies and may upload CV; student/officer/admin application scopes; officer/admin status review; CV access and outcomes. | Implemented |
| Messaging | Individual/group conversation APIs and bulk send. Broadcast reply-enabled messages create a distinct direct conversation per recipient; no-reply sends create notifications. Limits: 5,000 chars for chat, 255 for notification; selected recipient IDs are checked against audience. | Implemented |
| Notifications | Recipient-scoped list, unread filter/count, read-one/read-all; links navigate internally and notifications route can scroll/focus matching notification ID. | Implemented |
| Campus AI | Authenticated own-context feed and chat history; role-specific task registry and draft-only task result; analytics admin-only. Ensemble router can fall back to mock provider if no configured provider; actual provider availability/runtime persistence should be checked. | Implemented with provider-dependent behavior |
| File uploads | Profile image: jpg/jpeg/png/webp, <=10 MiB. Resources: pdf/docx/pptx/xlsx/png/jpg, <=10 MiB in view code. Placement CV: pdf/doc/docx, <=10 MiB. Assignment/submission uploads have view-specific checks; verify exact constraints before testing. | Partial evidence across upload paths |
| Reports/exports | Academic roster CSV, grades CSV and calendar ICS routes exist; placement outcomes API/page exists. | Implemented routes; export data correctness needs QA |
| Dashboards | Student and lecturer dedicated APIs; admin/hostel/finance/registrar workload metric APIs; Officer/HOD/Examination generic dashboard path. | Partial across roles |

## 7. Messaging specifics

| Sender role | Broadcast audiences allowed by backend |
|---|---|
| `admin` | Every defined role and special `all` active campus users |
| `ict_admin` | Student and Lecturer |
| `lecturer` | Student |
| All other roles | No broadcast audiences |

- Recipient directory (`GET /api/messaging/recipients/?role=...`) is audience-checked and supports search/order/pagination.
- Sends may include all users in an allowed role or an explicit non-empty list of recipient IDs, checked against active users and the selected role. `all` without explicit recipient list requires `confirm_all: true`.
- Reply-enabled broadcast creates/reuses a direct conversation per recipient, persists a Message, and creates a notification linking to `/messaging/?conversation=<id>`.
- No-reply broadcast creates notifications only; each links to `/notifications/?notification=<id>`.
- Direct messaging is allowed for `admin` participants and students/lecturers when course enrollment and lecturer teaching assignment overlap.
- Group conversations are tied to an Offering and sync assigned lecturers and actively enrolled students as participants. Students must be enrolled; lecturer must be assigned; admin is allowed.
- Conversation/message read access requires participant membership; last-read timestamps drive unread counts. Message sender or group conversation admin can delete (soft-delete).
- Conversation send creates a notification for other participants. Notifications are recipient-scoped.
- UI navigation shows Messaging to student, lecturer, admin, and ICT Admin. Registrar/Finance/etc. do not see nav link, although route shell itself has no role allow-list; APIs still deny broadcast for unsupported roles.
- Page initial state selects audience `lecturer` for admin/ICT Admin and `student` for lecturers. UI has reply toggle and super-admin confirmation control.

**Evidence:** `campushub-backend/apps/messaging/views.py::_broadcast_roles, _can_dm, broadcast_recipients, send_broadcast, group_conversation, messages, delete_message`; `apps/messaging/models.py`; `campushub-frontend/src/app/messaging/page.tsx`; `src/app/notifications/page.tsx`.

## 8. Existing tests

The repository includes backend and frontend tests. These are source filenames and their likely scopes based on names / inspected tests; they are not a claim that every behavior is covered.

| Test location | Files / coverage |
|---|---|
| `campushub-backend/apps/accounts/tests/` | `test_account_email.py` (account invitations/forced password behavior); `test_admission_course.py`; `test_auth.py`; `test_department_filter.py`; `test_password_reset.py`; `test_profile_picture.py`; `test_role_expansion.py`; `test_user_management.py`. |
| `campushub-backend/apps/academics/tests/` | `test_academic_periods.py`; `test_assignment_leak.py`; `test_assignments.py`; `test_at_risk.py`; `test_attendance.py`; `test_bulk_assign.py`; `test_dashboards.py`; `test_groups.py`; `test_ics_calendar.py`; `test_lecturer_placements.py`; `test_lessons.py`; `test_notification_triggers.py`; `test_offerings_sessions.py`; `test_profile_urls_and_prefect.py`; `test_schools_units.py`. |
| `campushub-backend/apps/ai/tests/` | `test_analytics.py`; `test_chat.py`; `test_ensemble.py`; `test_feed.py`; `test_models_and_router.py`; `test_tasks.py`; shared `conftest.py`. |
| Other backend tests | `apps/messaging/tests/test_messaging.py`; `apps/notifications/tests/test_digest.py`; `apps/resources/tests/test_resources.py`; `apps/common/tests/test_reachability.py`; `apps/services_tests.py` (integrated admissions, periods, registrations, role student lookups, finance, hostel/library/service flows). |
| `campushub-frontend/src` tests | Auth OTP UI; AI page; application list; assignments; course detail; DirectoryPage; ApiCrudWorkspace; ICT Units; lecturer assignment detail, attendance, lessons, materials; Registrar student onboarding; campus stats. Exact current test files are `src/app/(auth)/forgot-password/page.test.tsx`, `src/app/ai/page.test.tsx`, `src/app/applications/applications.test.tsx`, `src/app/assignments/page.test.tsx`, `src/app/courses/[id]/page.test.tsx`, `src/app/lecturer/{assignments/[assignmentId],attendance,lessons,materials,units/[offeringId]}/page.test.tsx`, `src/app/registrar/students/page.test.tsx`, and `src/components/{ApiCrudWorkspace,AdminCampusStats,AdminUnits,DirectoryPage}.test.tsx`, plus `src/lib/application-files.test.ts`. |

**Obvious coverage gaps:** no dedicated frontend tests discovered for finance, library, hostel, messaging/notification navigation, admissions, academic periods/registration, Super Admin users/logs, ICT structure permissions, or examinations. Backend app folders for admissions/finance/hostels/library show no app-specific `tests/*.py`; portions are covered by shared `services_tests.py`, but full transition/permission coverage is not established.

## 9. Mismatches and suspected defects

Severity is a QA triage estimate based on likely impact, not a confirmed production incident.

| ID | Severity guess | Affected role / route | Evidence | Finding and testing implication |
|---|---|---|---|---|
| INV-001 | High | ICT Admin; `/admin/schools`, `/admin/departments`, `/admin/courses`, `/admin/units` | Frontend page guards use `ict_admin`; `academics/views.py` school/department/course mutation branches check `user.role != 'admin'`; `test_schools_units.py` uses admin only. | UI promises ICT academic structure maintenance, but mutation APIs return 403 for ICT Admin. Test GET and each write separately. |
| INV-002 | High | All roles using `/examinations` | `campushub-frontend/src/app/examinations/page.tsx` contains a constant sample `students` array and `useState` grade weights; update button only updates local preview. No exam-results model/route found in `academics/models.py`/`urls.py`. | Sample names/results appear as a gradebook; no persistence or real result workflow is established. Treat as demo and do not test as real student data. |
| INV-003 | High | Password recovery; `/reset-password`, legacy reset API | `accounts.views::password_reset_request_view` logs generated reset token; legacy confirmation sets password without `validate_password`; public `reset-password` page redirects to OTP UI instead. | Legacy reset endpoints are disconnected and token is logged. Security and product owner should review before enabling/use; QA should avoid real credentials. |
| INV-004 | Medium | Registrar; `/admin/enrollments` | `AdminAdmissions.tsx` expects search, course filters, student email, department/school, course title and status PATCH. Current checkout’s `admin_enrollment_list_create` adds these response fields/filter behavior and `admin_enrollment_update` status handling; older tests cover only admin course reassignment. | Earlier API/UI mismatch is addressed in current source but backend regression coverage is narrow. Include a Registrar end-to-end search/filter/status test. |
| INV-005 | Medium | Registrar / Super Admin; admission flow | `admissions.views::application_detail` allows `submitted -> under_review`, then `under_review -> offered/rejected/withdrawn`; direct `submitted -> accepted` rejected. Student-account creation is a separate endpoint, not automatically triggered by accepted state. | Verify intended decision sequence and manual account handoff; avoid expecting automatic enrollment/email on acceptance. |
| INV-006 | Medium | Hostel Warden/admin; `/hostels` | Frontend only allows `student`,`hostel`; backend `WARDEN_ROLES = {'hostel','admin'}`. | Admin can access backend management endpoints but cannot use the page through frontend guard. Confirm intended admin access consistency. |
| INV-007 | Medium | Messaging; `/messaging` | Main nav exposes only student/lecturer/admin/ICT Admin, while page has no explicit `PortalShell roles`; all signed-in roles can potentially open route, although backend restricts broadcast and direct/group operations. | Route discoverability and user experience differ by role. Verify direct URL behavior for other roles and decide whether explicit role gate is needed. |
| INV-008 | Medium | Super Admin account lifecycle; `/users` | Last-active protection tests `is_superuser`, while UI role management includes `admin`; `UserManager.create_superuser` sets admin role, but the normal account creation path does not visibly set `is_superuser` based on role. | Confirm how deployed Super Admin accounts are provisioned and whether last-admin protection covers role-admin accounts. |
| INV-009 | Medium | Officer / Registrar account lookup; `/api/users/` | `_visible_users` grants service-role student listing; `restricted_lookup` is false for `officer` and true for Registrar/Finance/Librarian/Hostel, so Officer receives full `_user_data`, unlike other service roles. | Confirm Placement Officer needs the full student profile fields; verify data minimization and field exposure. |
| INV-010 | Low/Medium | Academic periods | `academics/views.py` defines `period_list_create` and `period_detail_update` more than once (early and later implementations). URL patterns bind module-level names after import, so the later definitions override earlier ones. | Runtime uses later definitions, but dead duplicate code is confusing and creates risk of testing/editing the wrong function. |
| INV-011 | Medium | AI users | AI router can use mock provider fallback if no real provider is configured; UI renders provider information. | AI feature may appear successful with mock responses. Test/provider status and persistence separately; do not infer production AI is enabled from a successful UI response. |
| INV-012 | Low/Medium | Credential verification; `/verify` | Route exists and is linked for Student/Registrar, but full workflow, data ownership, and backing behavior were not sufficiently established in inspected excerpts. | Mark Needs Verification until route/API behavior and trust model are inspected in detail. |
| INV-013 | Low | `/dashboard` for `officer`, `hod`, `examination` | `DashboardPage` roleHome has no redirect for these roles; generic dashboard renders PlacementOverview. | Validate that generic dashboard has meaningful correct role-specific content and does not imply a dedicated workflow. |
| INV-014 | High | Student / Finance; `/finance` | `campushub-frontend/src/app/finance/page.tsx::FinancePage` loads `studentInvoices` only when role is `student`; the “Make a payment” form is rendered only when `canManage` (Finance). `finance.views::payment_request_list_create` permits POST only for Student. | Student cannot see the request form; Finance sees an empty, disabled invoice selector and cannot submit the request as API rejects non-student. Test role-specific UX and confirm intended payment request process. |

## 10. Limitations and unresolved questions

- This file is a source-based inventory, not a running-system test. Email delivery, external AI provider availability, deployment configuration, production data, and service integrations were not exercised.
- No environment files or secret values were inspected. Runtime configuration may enable/disable SMTP, database, or AI provider behavior.
- Backend authorization varies by endpoint. The table groups related route families; a QA workbook should still have separate executable cases for every important method/role boundary.
- Full source for every long view was not reproduced in this file. For specific complex endpoint transitions, inspect the cited view and test before asserting an expected result.
- Credential verification, some examination office responsibilities, HOD workflows, and Examination Officer workflows are not established as complete end-to-end product workflows.
- The `officer` role is a Placement Officer. It has distinct broad student directory access and placement routes; scope/data-minimization expectations need owner confirmation.
- `admin` role and Django `is_superuser` are distinct concepts in code. The deployed account provisioning relationship is not established.
- Registrar programme-enrolment support is present in the inspected source; the associated test coverage is narrower than the available UI behavior.
- Suggested owner decisions before a definitive workbook expected-results column: whether ICT Admin must be allowed to mutate academic setup; whether Admin should access Hostel APIs/UI; whether non-nav roles should access Messaging by direct route; whether legacy reset-link endpoints should be removed or repaired; and what the intended examination/results workflow and verification product are.
