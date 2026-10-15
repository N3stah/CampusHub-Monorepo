Capstone Project Brief: "CampusHub" - A University Departmental Resource & Placement Portal 
Program: 12-Week Academic Attachment & Internship Duration: August 17, 2026 - November 6, 2026 Target Role: Software Engineer / Full-Stack Web Developer Intern Stack: Python, Django REST Framework, PostgreSQL, Next.js (Nuxt.js variant provided), Git/GitHub, uv package manager 
1. Purpose of This Project 
This capstone is designed to be the single assessable artifact for the entire 12- week roadmap. It deliberately exercises every skill introduced week-by-week terminal/Git discipline, Python fundamentals, data structures, OOP/SOLID, SQL/normalization, HTTP/REST, Django ORM, frontend async JS, deployment — so that mentors can grade against the Evaluation Matrix without inventing separate exercises. 
The project is scoped at undergraduate internship level: ambitious enough to demonstrate production readiness, but achievable in the ~5 weeks allotted (Weeks 8-12) with incremental weekly checkpoints. 
Why "CampusHub"? It mirrors a real university need (course resources, announcements, placement listings), which makes requirement-gathering realistic and gives you a natural, non-trivial relational schema (departments, courses, students, resources, applications). It also gives you a clean excuse to implement 3+ table joins, role-based access, file uploads, and async 
CRUD — all rubric line items. 
2. Project Overview 
CampusHub is a full-stack web portal where: 
• Students browse course resources, view placement/internship listings, and submit applications. 
• Lecturers upload resources and post announcements for their courses. 
• Placement Officers create and manage internship listings and review 
applications. 
• Admins manage departments, courses, and user roles. 
The system exposes a Django REST API consumed by a Next.js (or Nuxt.js) frontend, with PostgreSQL as the datastore, deployed to the cloud. 
3. Learning Outcomes Mapped to Roadmap Weeks 
Week 
Skill Area 
How CampusHub Assesses It 
1 
Git, terminal, env 
setup 
Daily commits, branch protection, 
README.md, .gitignore, uv -managed 
env 
Python 
2 
fundamentals 
CLI management command ( seed_data) with input validation & exceptions 
Data structures, file 
CSV import of student records 
JSON 
3 
IO, Big-O 
4 
OOP & SOLID 
summary; documented complexity 
Service layer classes 
(ApplicationService, ResourceService) 
with SRP/OCP 
LO 
5 
6 
Django routing 
SQL, ERD, 
normalization, 
.env 
HTTP/REST, 
ERD, 3NF schema, raw SQL queries joining 3+ tables, secrets in .env 
DRF viewsets, status codes, Postman 
collection 
Next.js pages fetching API with 
7 
Frontend, async JS 
fetch axios, dynamic DOM rendering 
Capstone kickoff, 
8 
ORM 
Business logic, 
9 
validation 
10 
Frontend part 1 
Models, migrations, core endpoints 
Custom validators, transaction atomicity, edge-case tests 
Dashboard, list views, detail views 
11 
Frontend part 2 
Forms, loading/error states, responsive polish 
Refactor, deploy, 
12 
Cloud deploy, docs, defense deck 
defend 
4. Functional Requirements 
4.1 Core Entities (Minimum) 
• User (custom, role field: student | lecturer | officer | admin) 
• Department (name, code, faculty) 
• Course (code, title, department FK, lecturer FK) 
• Enrollment (student FK, course FK, semester) — N:M bridge 
• Resource (title, file, course FK, uploaded_by FK, uploaded_at) 
• Announcement (title, body, course FK, author FK, published_at) 
• Placement (title, company, description, deadline, officer FK) 
Application (student FK, placement FK, status, applied_at, cover_note) 
This schema forces 1:N (Department → Course), N:M (Student Course via Enrollment), and self-referential/role relationships - perfect for ERD and 
normalization assessment. 
4.2 Feature Requirements by Role 
Student 
Register/login (JWT). 
• Browse courses enrolled in; download resources. 
• View placement listings; submit application (with cover note). 
• Track application status. 
Lecturer 
• 
Upload resource (PDF/DOCX) to a course they teach. 
• Post announcement to their course. 
• View enrollment list. 
Placement Officer 
• CRUD placement listings. 
• Review applications; update status (pending → shortlisted accepted/rejected). 
Admin 
• Manage departments, courses, users, roles. 
4.3 Technical Requirements 
• Auth: JWT (SimpleJWT) with role-based permissions. 
• Pagination, filtering, search on list endpoints. 
• File uploads via Django MEDIA_ROOT (or S3-compatible in stretch goals). 
• Validation: custom validators (e.g., deadline must be future; duplicate application prevention). 
• Atomic transactions for application submission. 
• 
Environment config: django-environ reading .env; .env in .gitignore . 
• Frontend: Next.js (App Router) or Nuxt 3 - see §7 for the Nuxt variant. 
• 
Testing: ≥ 60% backend coverage via pytest-django. 
• 
Deployment: Render/Railway (backend + Postgres), Vercel (frontend). 
• Documentation: README.md with architecture diagram, setup, API table; 
OpenAPI schema via drf-spectacular. 
5. Database Design Deliverables 
1. ERD (draw.io or dbdiagram.io) — submitted Week 8. 
2. Normalization write-up-show each table in 1NF→ 3NF, identify and 
eliminate anomalies. 
3. Migration history — clean, linear, no squashed migrations. 
4. Raw SQL queries (in docs/sql/)—at least three queries joining 3+ tables: 
• Students with their enrolled courses and resource counts. 
• Placements with application counts and average applicant GPA (add a 
gpa field to Student profile). 
• Lecturers ranked by total resource uploads per department. 
6. Backend Architecture (Django) 
code 
campushub/ 
manage.py 
pyproject.toml 
#uv-managed 
.env.example 
.gitignore 
config/ 
settings/ 
base.py 
dev.py 
prod.py 
urls.py 
wsgi.py 
apps/ 
accounts/ 
academics/ 
resources/ 
placements/ 
common/ 
services/ 
# User, roles, auth 
# Department, Course, Enrollment # Resource, Announcement 
# Placement, Application 
# BaseModel, mixins, permissions 
# OOP/SOLID service layer 
application_service.py 
resource_service.py 
tests/ 
docs/ 
erd.png 
sql/ 
SOLID in practice (assessed Week 4/9): 
• 
BaseService abstract class (SRP). 
ApplicationService.submit() uses a @transaction. atomic block, validates 
via injected ApplicationValidator (DIP). 
• Notification dispatch via Notifier interface with EmailNotifier / 
ConsoleNotifier implementations (OCP/LSP). 
7. Frontend Architecture 
Ontion A 
Novt is (recommended) 
code 
NNTALIJS LIC 
campushub-frontend/ 
app/ 
(auth)/login/page.tsx 
dashboard/page.tsx 
courses/[id]/page.tsx 
placements/page.tsx 
placements/[id]/apply/page.tsx 
components/ 
Fui/ 
# Button, Card, Spinner, Alert 
layout/ 
lib/ 
api.ts 
Lauth.ts 
# axios instance, interceptors # token handling 
hooks/ 
LusePlacements.ts 
styles/ 
• 
App Router with server components for initial data, client components for interactivity. 
lib/api.ts centralizes base URL + JWT refresh interceptor. 
• Forms use React Hook Form + Zod for field-level validation (mirrors backend 
validators). 
Option B - Nuxt 3 (if you prefer Vue) 
code 
campushub-frontend/ 
pages/ 
login.vue 
dashboard.vue 
courses/[id].vue 
placements/ 
index.vue 
[id]/apply.vue 
components/ 
ui/ 
layout/ composables/ 
useApi.ts useAuth.ts 
stores/ 
# $fetch with auth 
# Pinia 
middleware/auth.global.ts 
useApi.ts Wraps $fetch with baseURL and Authorization header from 
Pinia auth store. 
middleware/auth.global.ts guards protected routes. 
• Forms via VeeValidate + Zod. 
Either path satisfies the rubric pick one and document the choice in your 
README.md. 
8. Weekly Checkpoints (Weeks 8-12) 
Week 
8 
9 
Deliverable 
Approved ERD, migrations applied, core API endpoints (auth, courses, 
placements), Postman collection 
Business logic complete, validators, 
pytest suite ≥ 60%, code review notes 
Grading Hook 
Database Design, 
Practical 
Assignments 
Code Quality, Testing 
10 
Dashboard, course list/detail, placement list rendering live data 
11 
Application form, status updates, 
loading/error states, responsive 
Frontend Integration 
End-to-End 
Functionality 
Capstone & 
Deployed URLS, README.md, OpenAPI 
12 
Deployment, Final 
docs, defense slide deck 
Defense 
9. Stretch Goals (Optional, for Distinction) 
• Email notifications on application status change (Celery + Redis). 
• PDF generation of student transcript (ReportLab). 
• Docker Compose for local dev. 
• Cl pipeline (GitHub Actions: lint + test on PR). 
• Search via PostareSOL full-text (searchVector ). 
C 
10. Evaluation Matrix Alignment 
CampusHub Evidence 
Rubric Category 
Weight 
Daily Engineering 
20% 
Discipline 
Git log with > 1 meaningful commit/day, branch-per-feature, PRS, blocker log 
Practical 
25% 
Assignments 
Code Quality & 
25% 
Architecture 
Capstone & 
20% 
Deployment 
Final Presentation 
10% 
& Defense 
Weekly checkpoints §8; CLI seed_data command; CSV→ JSON importer 
Service layer, SOLID refactor notes, normalization write-up, test coverage report 
Live URLS, README.md, OpenAPI 
schema, ERD 
15-min slide deck + live demo + Q&A on 
architectural choices 
11. Submission Package 
1. GitHub repo (backend) with protected main, PR history, README.md. 
2. GitHub repo (frontend) with same. 
3. docs/ folder: ERD, normalization write-up, SQL queries, Postman collection, 
OpenAPI JSON. 
4. Live URLs: backend API, frontend app. 
5. Defense slide deck (PDF). 
6. REFLECTION.md 
- 1 page on challenges, trade-offs, what you'd do differently. 
12. Suggested Timeline Note 
If you begin this project before Week 8 (i.e., during Weeks 1-7), treat it as a parallel thread: complete the weekly roadmap exercises as written, then port 
the relevant skill into CampusHub during the capstone window. This 
preserves the roadmap's pedagogical sequence while ensuring the capstone 
is not rushed. 
Prepared as the capstone assessment artifact for the 12-Week Academic 
Attachment & Internship Roadmap (Aug 17 - Nov 6, 2026). 
