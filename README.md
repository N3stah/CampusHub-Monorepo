# CampusHub 🎓

A full-stack university student portal built as a capstone project at **The Nairobi National Polytechnic** (Diploma in Computer Science, Level 6).

> Internship project at **Spin Mobile LLC**, Nairobi — October 2026

---

## What is CampusHub?

CampusHub is a centralised web portal for university students, lecturers, and placement officers. It handles student authentication, academic records, resource management, industrial attachment (placement) tracking, and notifications — all in one place.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 6.1 (Plain Django + PyJWT, no DRF) |
| Database | PostgreSQL 18 |
| Frontend | Next.js 16 + TypeScript + Tailwind CSS |
| Architecture | Vertical Slice Architecture (VSA) |
| Deployment | Render (Backend) + Vercel (Frontend) |

---

## API Endpoints

The API is fully documented in [`campushub-backend/docs/openapi.json`](campushub-backend/docs/openapi.json). All endpoints are JSON-only (`JsonResponse`), use Bearer JWT auth, and return standard error shapes `{"error": "..."}`.

| Group | Base Path | Description |
|-------|-----------|-------------|
| Auth | `/api/auth/` | Register, Login (token), Refresh, Me |
| Users | `/api/users/` | Admin user management (CRUD, roles) |
| Lecturers | `/api/lecturers/` | Lecturer directory management |
| Admin | `/api/admin/` | Stats and audit logs |
| Academics | `/api/academics/` | Departments, Courses, Enrollments, Bulk assign |
| Resources | `/api/resources/` | File uploads, announcements, downloads |
| Placements | `/api/placements/` | Job listings and applications |
| Notifications | `/api/notifications/` | User notifications, unread counts |
| Health | `/api/health/` | Render health check |

---

## User Roles

| Role | Description |
|------|-------------|
| `student` | Access own records, resources, enroll, apply for placements |
| `lecturer` | Upload resources, post announcements, view course rosters |
| `officer` | Manage placement listings, review applications, post placements |
| `admin` | Full CRUD on all entities, manage users and departments |

---

## Local Development Setup

### Prerequisites
- Python 3.14+
- Node.js 22+
- PostgreSQL 18

### Backend

```bash
# 1. Clone the repo
git clone https://github.com/N3stah/CampusHub-Monorepo.git
cd CampusHub-Monorepo/campushub-backend

# 2. Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create .env file (copy from .env.example and fill in values)
cp .env.example .env

# 5. Create PostgreSQL database
sudo -u postgres psql -c "CREATE DATABASE campushub_db;"
sudo -u postgres psql -c "CREATE USER campushub_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE campushub_db TO campushub_user;"
sudo -u postgres psql -d campushub_db -c "GRANT ALL ON SCHEMA public TO campushub_user;"

# 6. Run migrations
python manage.py migrate

# 7. (Optional) Seed demo data
python manage.py seed_data

# 8. Start development server
python manage.py runserver
```

> **Note:** On Ubuntu 26.04, PostgreSQL 18 listens on port **5434** by default, not 5432. Set `DB_PORT=5434` in your `.env`.

### Frontend

```bash
cd ../campushub-frontend
npm install
npm run dev
```

---

## Management Commands

- `python manage.py seed_data`: Populates the DB with demo users (Admin, Officer, Lecturers, Students), departments, courses, and placements. Safe to run multiple times.
- `python manage.py import_students path.csv`: Imports students from a CSV file with row-level validation.
- `python manage.py cleanup_notifications --days 30`: Deletes read notifications older than N days.

---

## Deployment

### Backend (Render)
1. Create a Web Service pointing to the `campushub-backend/` directory.
2. Set the environment variables (see `config/settings/prod.py`).
3. Render will automatically run `pip install`, `collectstatic`, and `migrate` on deploy.
4. To seed the production database, use the Render Shell and run `python manage.py seed_data`.

### Frontend (Vercel)
1. Import the repository to Vercel.
2. Set the Root Directory to `campushub-frontend`.
3. Set the `NEXT_PUBLIC_API_URL` environment variable to your live Render backend URL.
4. Deploy.

---

## Documentation

- [`docs/ERD.md`](docs/ERD.md): Database design document with Mermaid ERD, normalization write-up, and raw SQL queries.
- [`docs/PHASE_STATUS.md`](docs/PHASE_STATUS.md): Detailed phase tracker and blocker log.
- [`campushub-backend/docs/openapi.json`](campushub-backend/docs/openapi.json): Minimal OpenAPI 3 spec.

---

## Team

| Role | Name | GitHub |
|------|------|--------|
| Backend Developer | Mark Manoti | [@N3stah](https://github.com/N3stah) |
| Frontend Developer | Titus | [@koech](https://github.com/Koech028) |

---

## License

Academic project — The Nairobi National Polytechnic / Spin Mobile LLC internship, 2026.
