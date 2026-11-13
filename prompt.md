# Prompt: Build a Comprehensive CampusHub System Testing Workbook

You are acting as a **senior QA lead, school-management systems analyst, and Excel test-workbook designer**. Your task is to inspect the CampusHub-Monorepo and create a comprehensive, usable Excel workbook named **`CampusHub_System_Testing_Matrix.xlsx`** for manually testing the complete system across all user roles.

The workbook will be used by school staff and project stakeholders to verify that CampusHub works correctly and realistically—not just that pages load. It must help a tester follow workflows, check permissions, verify that records are saved, capture evidence, and report defects.

## 1. Non-negotiable instructions

1. **Inspect the repository before writing test cases.** Use the actual application routes, navigation, role definitions, frontend components, backend/API endpoints, permission checks, models, and existing tests as evidence.
2. **Do not modify application code, configuration, migrations, environment files, or production data.** The deliverable is the testing workbook (and, if needed, a short findings summary).
3. **Never read, copy, reproduce, or expose secrets.** Do not inspect or include `.env`, `.env.local`, credentials, tokens, private keys, real personal data, or production account details. If environment configuration is relevant, mention it generically without revealing values.
4. **Do not invent features or expected behavior.** A visible navigation item or frontend mockup is not proof that the feature works or is backed by an API. Verify each claim in the code.
5. Classify each discovered feature as one of:
   - **Implemented and testable** — route/UI and required behavior exist in the repository.
   - **Partially implemented** — some workflow exists, but an important step, persistence, permission, or UI state is missing or unclear.
   - **UI-only / demo / placeholder** — sample data, local-only state, or an unfinished screen appears to stand in for a working feature.
   - **Not implemented / broken link** — route, action, or service is missing or demonstrably unavailable.
   - **Needs product decision** — reasonable expected behavior cannot be established from the code.
6. When behavior is uncertain, make a **Needs Verification** test or record it as an open question. Explain the uncertainty and cite repository evidence. Do not silently convert assumptions into acceptance criteria.
7. Prefer a real `.xlsx` workbook created directly in the workspace. If spreadsheet creation is impossible, produce a separate, clearly named CSV per sheet and explain the limitation.
8. Use realistic fictional school scenarios and synthetic data only. Use reserved example domains such as `example.test`; do not use real people or addresses.
9. Keep the workbook readable for non-technical testers, but retain enough technical traceability for developers to reproduce defects.

## 2. Repository discovery required

Before creating the workbook:

1. Inventory all supported account roles from the actual role choices, authentication/user model, role guards, and role-aware redirects. Include every real role, not just roles listed in a dashboard.
2. Inventory all frontend routes and navigation entries. For each role, compare:
   - what navigation exposes;
   - what the route itself permits;
   - what the associated backend endpoint permits;
   - what data/actions are actually available.
3. Inspect the core user journeys and relevant models/API behavior. Look for:
   - create/read/update/deactivate/delete operations;
   - search, filters, sorting, pagination, status transitions, and empty states;
   - validation and error handling;
   - role-specific data scoping;
   - audit events and notifications;
   - email/invitation behavior;
   - file upload/download behavior;
   - persistence versus local state or sample data.
4. Review relevant existing tests. Use them as supporting evidence, not as proof that all user-visible behavior is correct.
5. Identify workflow prerequisites and dependencies. For example, a student may need an active programme enrolment before registering for offered units; only include such a dependency when repository behavior confirms it.
6. Record any mismatch or apparent defect found during inspection in an **Implementation Findings** section of the workbook or a clearly identified section on the **Start Here** sheet. Include severity/impact, affected role, route, evidence, and the test case that verifies it.
7. Use repository-relative evidence references such as `campushub-frontend/src/app/...`, `campushub-backend/apps/...`, symbol/function names, and test file names. Include line numbers only if they can be reliably determined.

## 3. Workbook sheets

Create these sheets with the exact names below. Format each as a useful Excel table with filters, frozen header rows, wrapped text, readable widths, consistent styles, and sensible print/page settings. Avoid excessively wide layouts where practical; freeze useful identifier columns as well as headers when that improves usability.

### Sheet 1 — `Start Here`

Include:

- Workbook purpose, scope, version/date prepared, and a note that cases are based on repository evidence and should be updated as the application changes.
- A clear warning: **use a test/staging environment, synthetic data, and test accounts only; do not test destructive actions on production.**
- A simple execution procedure:
  1. Prepare test accounts and prerequisite records.
  2. Execute P0 and P1 tests first.
  3. Follow dependencies and cross-role handoffs.
  4. Record status, actual result, tester/date, evidence, and defect ID.
  5. Retest failed cases after fixes.
- Status definitions:
  - **Not Run** — no execution has occurred.
  - **Pass** — actual behavior matches all expected results.
  - **Fail** — behavior differs from expected or a defect is confirmed.
  - **Blocked** — cannot execute because a prerequisite, environment, account, or dependency is unavailable; include the blocker.
  - **Needs Verification** — repository evidence or product requirements do not establish the expected behavior; clarify before treating it as pass/fail.
- Priority definitions:
  - **P0 Critical** — core access, security/privacy, data integrity, or a launch-blocking workflow.
  - **P1 High** — major role workflow or business operation fails, with no practical workaround.
  - **P2 Normal** — non-critical workflow, usability issue, edge case, or limited workaround exists.
- Severity definitions:
  - **Critical / High / Medium / Low**, describing impact of a defect rather than test urgency.
- Instructions for evidence, safe cleanup, defect logging, and rerunning a test.
- A **Coverage and Open Questions** section that summarizes:
  - roles found;
  - modules inspected;
  - features missing, partial, UI-only, or unclear;
  - any product decisions needed;
  - any limitations in repository analysis.
- A legend for all workbook status and priority colors.

### Sheet 2 — `Test Cases`

One row per independently executable scenario. Use stable IDs grouped by module, such as `AUTH-001`, `ADMIN-001`, `ICT-001`, `REG-001`, `ADMIT-001`, `FIN-001`, `LECT-001`, `STU-001`, `MSG-001`, and `LIB-001`. Use other prefixes when the discovered roles/features require them.

Include these columns:

1. Test Case ID
2. Priority
3. Test Type (positive, negative, boundary, permission, usability/accessibility, cross-role, regression)
4. Role
5. Feature / Module
6. Implementation Status (implemented, partial, UI-only/demo, not implemented/broken, needs product decision)
7. Scenario / Activity
8. Preconditions
9. Test Account / Role Setup
10. Test Data
11. Numbered Manual Steps
12. Expected Result by Step
13. Expected Final State / Persistence
14. Negative Check / Permission Boundary
15. Related Role / Handoff
16. Page / Route
17. API / Endpoint (when verified)
18. Repository Evidence (file, route, symbol, or existing test)
19. Status (dropdown)
20. Actual Result / Notes
21. Evidence Link / Screenshot Reference
22. Tester
23. Test Date
24. Defect ID
25. Retest Status / Date
26. Dependencies (Test Case IDs or setup record)

Case-writing standards:

- Write exact, numbered, executable steps and observable expected results. Do not write vague checks such as “test admissions” or “verify messaging.”
- For important workflows, assert both the visible result and the expected saved state, API outcome, or downstream visibility where feasible.
- Separate permission checks from happy-path checks. Include direct-route and direct-API denial tests where the application has meaningful authorization boundaries.
- Include realistic negative paths: missing/invalid data, duplicate submission, unsupported status transition, unauthorized role, no matching results, network/API error, and recovery/retry as applicable.
- Include empty, loading, success, and error states when implemented and observable.
- For pagination/filter/search, verify that results/counts match the criteria, navigation between pages works, and filters do not leak across roles.
- State setup explicitly. If a test requires a specific academic period, programme, offering, enrollment, or role, identify it.
- Include expected email/notification outcomes only where code establishes them. Record queued/sent/failed outcomes distinctly.
- If an expected behavior is unclear, mark **Needs Verification**, write the unresolved question, and do not claim pass/fail behavior.
- Include regression tests for known repository mismatches or partial workflows, clearly labeling them as findings rather than silently asserting intended behavior.

### Sheet 3 — `Role Activity Map`

One row per discovered role and meaningful activity. Include:

- Role
- Role description / purpose (only if supported by the product)
- Module
- Activity
- Permission (Allowed / Denied / Read-only / Conditional / Needs Verification)
- Relevant page / route
- Related API endpoint (if verified)
- Data scope (own records, assigned records, campus-wide, etc., only when established)
- Allowed action
- Explicit denied action / boundary
- Linked Test Case IDs
- Implementation status
- Repository evidence
- Notes / unresolved questions

Make privilege differences explicit. Do not infer access from role hierarchy names alone; use implemented permission guards. For each role, include tests to confirm both intended access and sensitive actions it must not perform.

### Sheet 4 — `Test Data & Accounts`

Document safe, fictional data and setup instructions. Include columns such as:

- Data ID
- Data category
- Synthetic value / record name
- Role or owner
- Related records / dependencies
- Intended test use
- Setup instructions
- Cleanup / reset instructions
- Sensitive-data note

Include only data categories that exist in the repository, as applicable:

- one synthetic test account for each supported role;
- a Super Admin/admin account and any separate ICT Admin account if distinct;
- Registrar, Finance, Lecturer, Student, and all other discovered service-user roles;
- a student applicant and an admitted student;
- active/inactive students if the system supports that state;
- departments, schools, and programmes/courses;
- academic periods with planned, active/current, and completed states where valid;
- units, offerings, lecturer assignments, and registrations;
- attendance, assignments, assessment/results, or placements when supported;
- invoices, payment requests, payments, reversals, receipts, and fee structures when supported;
- books, loans, reservations, and overdue records when supported;
- hostel/room/allocation data when supported;
- message recipients, reply-enabled conversations, no-reply notifications, and notification destinations when supported;
- upload fixtures and verification records when supported.

Never put passwords, initial passwords, access tokens, or real account data in this sheet. Use a placeholder such as **“Set locally by test coordinator; do not record here.”** Explain that each tester should use a secure, local test password and follow the project’s password policy. Identify data dependencies and caution about irreversible or destructive actions.

### Sheet 5 — `Defects`

Include blank rows ready for use, filters, dropdowns where appropriate, and these columns:

- Defect ID
- Linked Test Case ID
- Summary
- Affected Role
- Module
- Environment / Build
- Preconditions
- Steps to Reproduce
- Expected Result
- Actual Result
- Severity
- Priority
- Frequency / Reproducibility
- Evidence / Screenshot / Log Reference
- Repository Evidence
- Owner
- Date Reported
- Status (Open, In Progress, Fixed, Ready for Retest, Closed, Deferred)
- Fix Version / Reference
- Retest Result
- Retest Date
- Notes

Make defect severity and test priority separate concepts. Do not put credentials, tokens, private personal data, or sensitive payloads in defect notes.

### Sheet 6 — `Execution Summary`

Provide formula-driven execution reporting based on the `Test Cases` sheet:

- Total cases.
- Count of Pass, Fail, Blocked, Not Run, and Needs Verification.
- Pass rate, defined explicitly as `Pass / (Pass + Fail)`; exclude Blocked, Not Run, and Needs Verification from the denominator.
- Execution rate, defined as `(Pass + Fail) / (Total - Blocked - Needs Verification)`, or a clearly documented alternative that avoids hiding blocked tests.
- P0/P1 total, pass, fail, blocked, and not-run counts.
- Counts by role, module, priority, and implementation status.
- A list or automatically highlighted indicator for P0/P1 failures and untested P0/P1 cases.
- A list of blocked tests and unresolved verification/product-decision items.
- Charts only where they improve readability and remain understandable when additional rows are added.

Use formulas and Excel tables or expandable ranges so newly added test rows are included. Avoid misleading percentages when the denominator is zero; display `N/A` or an equivalent clear value.

## 4. Coverage checklist

Inspect the repository to determine whether each area is implemented, partial, placeholder, missing, or uncertain. Add concrete tests for the applicable behaviors below. Do not add made-up workflows for absent features; record missing areas as findings or verification items instead.

### A. Authentication, account lifecycle, and role access

- Login with valid/invalid credentials.
- Logout and protected-route behavior after logout.
- Session expiration/refresh behavior only if implemented.
- Password change, forgotten-password, reset, forced initial-password change, and expiry behavior where implemented.
- Role-aware landing/dashboard redirects.
- Navigation visibility versus direct URL access.
- Role-specific API access, including forbidden read/write operations.
- Self-service profile updates and profile-picture behavior where implemented.
- Account creation, activation/deactivation, invitation/resend, and role assignment boundaries.
- Protecting the final Super Admin/admin account if implemented.
- Error messages that do not reveal sensitive account information.

### B. Dashboards, navigation, and shared UI

- Each role’s dashboard loads the correct role-specific content.
- Dashboard stats/counts match the records represented and link to the correct filtered/searchable list where implemented.
- Navigation links open the intended route and the route authorizes the correct role.
- Search/filter/pagination, refresh, empty state, loading state, and API error state.
- Responsive layouts on desktop, tablet, and mobile widths.
- Keyboard navigation, visible focus, labels, accessible names, readable errors, and dialog/confirmation behavior on key workflows.
- Shared notifications, floating tools, Campus AI, and common shell behavior across applicable roles.

### C. Super Admin / system administration

- User and role directories, filters, search, pagination, and counts.
- Creating/editing/deactivating accounts and invitation delivery, if implemented.
- Super Admin access to all permitted users versus controls that remain restricted.
- Audit log visibility and search if implemented.
- Campus-wide statistics directories and their filters if implemented.
- System configuration and academic structure management only when present and authorized.
- Confirm destructive actions and ensure data is not accidentally deleted.
- Attempt prohibited self-deactivation or removal of the final privileged account if guarded by the application.

### D. ICT Admin / academic structure

- School, department, programme/course, unit, offering, and lecturer assignment tasks that are actually available.
- Create/read/update/deactivate/delete behavior and relationship validation.
- Duplicate codes/names, missing references, inactive records, and invalid foreign keys.
- Confirm ICT Admin does not gain Registrar, finance, or Super Admin privileges merely because of its role.
- Verify that academic structure changes are reflected in dependent lookups and user-facing forms.

### E. Admissions and Registrar

- Application creation, review, notes/updates, status transitions, rejection/offer/acceptance rules, duplicate application handling, and search/filter behavior.
- Student account creation only after admission confirmation, including required data, admission number uniqueness, programme assignment, and invitation/email outcome.
- Student directory: search by name, admission number, or email; pagination; active/inactive scope; correct limited fields; no access to unauthorized account changes.
- Programme enrollment assignment, switching, status updates, duplicate active enrollment prevention, history preservation, and student lookup by exact admission number.
- Academic period setup/updates/current-period changes, overlap handling, status transitions, and schedule visibility if Registrar has these controls.
- Semester/unit registration review and status changes.
- Credential verification, examinations, grades, or other linked Registrar activities only if the underlying workflows are functional and persisted.
- Validate the end-to-end admission → student account → programme assignment journey, observing exact prerequisites and email handling.

### F. Student workflows

- Student landing/dashboard and access to own records only.
- Profile, programme, academic period, registration, timetable, attendance, assignments, results, placement, finance, library, hostel, and other features only if implemented.
- Unit registration eligibility, active-period dates, offering/programme rules, duplicates, cancellation/drop/re-registration transitions, and confirmation.
- Attempt to view or modify another student’s information through the UI and direct endpoint.
- Notifications and deep links open the correct record/conversation and enforce the recipient’s access.
- Messaging reply restrictions and no-reply messages render as notifications if implemented.

### G. Lecturer workflows

- Assigned courses/units and student rosters are correctly scoped.
- Attendance session creation, marking, editing, duplicate handling, and student visibility if implemented.
- Assignments/material uploads, publication, due dates, submissions, feedback, and grading if implemented.
- Assessment/results entry, validation, visibility, and status/finalization rules if implemented.
- Lecturer messaging to permitted recipients, bulk-send recipient filters, replies, and notification destination if implemented.
- Attempt to access unassigned classes, other lecturers’ restricted data, student account administration, and privileged academic setup.

### H. Finance

- Fee structures, invoices, payment requests, payment records, receipts, reconciliation, reversals/voids, and status transitions only when implemented.
- Correct student/invoice association, totals, dates, currency/amount validation, duplicate payments, and auditability.
- Verify the difference between a payment request and a confirmed payment.
- Confirm finance access to necessary student lookup fields without exposing unrelated private data.
- Verify finance cannot create academic structure, change grades, or perform account administration unless explicitly authorized by code.

### I. Library

- Book catalogue search and availability.
- Loans, returns, renewals, reservations, duplicate reservations, copy limits, overdue calculations, and status transitions where implemented.
- Correct student ownership and librarian permissions.
- Verify student access is limited to their own loans/reservations.

### J. Hostel / accommodation

- Hostel and room records, capacity, allocation, reassignment, release, and availability if implemented.
- Prevent over-capacity or duplicate allocations when supported.
- Verify student access is limited to their own accommodation records.
- Confirm hostel staff cannot alter unrelated academic, finance, or account records.

### K. Messaging and notifications

- One-to-one messages and bulk/group messaging to permitted audiences.
- Verify allowed recipient groups for each sender role, including any Super Admin-wide-send confirmation.
- Search, filter, recipient selection, empty group, duplicate recipients, partial failures, and retry behavior.
- Allow replies versus no-reply behavior.
- Verify no-reply messages are delivered as notifications rather than reply-enabled chats if that is the implemented behavior.
- Verify each notification click opens the intended chat, record, or notification destination.
- Check unread/read state and notification counts if implemented.
- Confirm recipients cannot access messages or notifications not addressed to them.
- Check UI and backend permission enforcement independently.

### L. Campus AI and other shared features

- Availability for each supported role and consistency of shared entry point.
- Correct role-specific page access and any analytics/data scope.
- Empty/error/loading states and external-service dependence, if applicable.
- Do not submit confidential student data as test prompts.
- Distinguish a navigable interface from a functioning AI service.

### M. File handling, audit, and reporting

- Upload type/size validation, rejection messages, persistence, retrieval, and authorization for each implemented file workflow.
- Verify sensitive files are not accessible to unauthorized roles or by guessing a URL.
- Audit events for sensitive mutations, correct actor/action/timestamp, and access restrictions.
- Exports/reports, filters, pagination, and data consistency, if implemented.

### N. Cross-role end-to-end scenarios

Create integrated test paths for each workflow actually supported by the repository. Candidate examples include:

- Applicant/application review → admission decision → Registrar account creation → programme enrolment → student login.
- ICT Admin academic setup → Registrar enrolment/period setup → student semester registration → lecturer sees eligible roster.
- Lecturer teaching/attendance/assessment → student sees their own attendance/results, if the application persists those steps.
- Finance invoice/payment workflow → student sees their own account status, if implemented.
- Student library/hostel workflows → relevant staff processes the corresponding request, if implemented.
- Staff sends a message or notification → recipient opens correct destination → reply is possible or blocked according to the sender’s setting.

For each end-to-end path, state prerequisites, role handoffs, expected records at each stage, failure points, and cleanup. Do not imply that a stage works if it is only a mockup.

## 5. Excel implementation details

- Use native Excel tables with filters and structured references where practical.
- Freeze headers and useful identifier columns on long sheets.
- Apply consistent, professional institutional formatting with restrained colors and strong contrast.
- Wrap long steps and expected results; top-align multi-line cells.
- Use data validation lists for:
  - Test status: Not Run, Pass, Fail, Blocked, Needs Verification.
  - Priority: P0, P1, P2.
  - Test type values used consistently.
  - Implementation status values used consistently.
  - Defect severity and defect status.
- Apply conditional formatting:
  - Pass: green.
  - Fail: red.
  - Blocked: gray or amber.
  - Needs Verification: purple or amber.
  - Not Run: neutral.
  - P0/P1 failures and untested cases: prominent highlight.
- Do not use color as the only way to communicate meaning; keep text labels visible.
- Include hyperlinks for internal workbook navigation and repository evidence where sensible. Do not include external URLs that expose secrets or private data.
- Ensure formulas work with blank rows and expanded test-case tables.
- If generating the workbook programmatically, verify that it opens successfully and that key formulas, dropdowns, filters, frozen panes, and formatting are present.
- Do not add macros or executable content.

## 6. Final response

After creating and validating the workbook, provide a concise summary containing:

- A link to `CampusHub_System_Testing_Matrix.xlsx`.
- The sheets created.
- The roles and major modules covered.
- Test-case totals by priority and implementation status.
- Any notable repository gaps, broken links, placeholders, or unresolved product decisions.
- Any validation performed on the workbook.
- A clear note that no application code or secrets were changed or included.

If blocked from creating `.xlsx`, state the exact limitation and provide the requested CSV alternative without claiming that an Excel workbook was created.
