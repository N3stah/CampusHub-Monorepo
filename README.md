# CampusHub 🎓

A full-stack university student portal built as a capstone project at **The Nairobi National Polytechnic** (Diploma in Computer Science, Level 6).

> Internship project at **Spin Mobile LLC**, Nairobi — October 2026

---

## What is CampusHub?

CampusHub is a centralised web portal for university students, lecturers, and placement officers. It handles student authentication, academic records, resource management, and industrial attachment (placement) tracking — all in one place.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 6.1 + Django REST Framework 3.18 |
| Auth | SimpleJWT (access 30 min / refresh 7 days) |
| Database | PostgreSQL 18 |
| Frontend | Next.js 16 + TypeScript + Tailwind CSS |
| Architecture | Vertical Slice Architecture (VSA) |
| Environment | python-decouple + `.env` |
| Version Control | Git + GitHub (monorepo) |

---

## Project Structure

CampusHub-Monorepo/
├── campushub-backend/ # Django REST API
│ ├── apps/
│ │ ├── accounts/ # Auth, User model, JWT
│ │ ├── academics/ # Departments, courses
│ │ ├── resources/ # Study materials
│ │ ├── placements/ # Industrial attachment
│ │ └── common/ # Shared utilities
│ ├── config/
│ │ ├── settings/
│ │ │ ├── base.py
│ │ │ ├── dev.py
│ │ │ └── prod.py
│ │ ├── urls.py
│ │ ├── wsgi.py
│ │ └── asgi.py
│ ├── docs/
│ │ ├── PHASE_STATUS.md
│ │ └── DEVELOPMENT_GUIDE.md
│ └── manage.py
├── campushub-frontend/ # Next.js 16 App Router
│ ├── src/
│ │ ├── app/
│ │ ├── components/
│ │ ├── lib/
│ │ └── types/
│ └── package.json
└── docs/
├── ERD.md
├── PHASE_STATUS.md
└── sql/


---

## API Endpoints (Phase 1A — Live)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register/` | None | Create new user account |
| POST | `/api/auth/token/` | None | Login — returns JWT pair |
| POST | `/api/auth/token/refresh/` | Refresh token | Get new access token |
| GET | `/api/auth/me/` | Bearer token | Get current user profile |
| PUT/PATCH | `/api/auth/me/` | Bearer token | Update current user profile |

---

## User Roles

| Role | Description |
|------|-------------|
| `student` | Default role. Access to own records, resources, applications |
| `lecturer` | Upload resources, view student records in their department |
| `officer` | Manage placement listings and student applications |
| `admin` | Full access via Django admin |

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
pip install -r requirements.txt --break-system-packages

# 4. Create .env file (copy from .env.example and fill in values)
cp .env.example .env

# 5. Create PostgreSQL database
sudo -u postgres psql -c "CREATE DATABASE campushub_db;"
sudo -u postgres psql -c "CREATE USER campushub_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE campushub_db TO campushub_user;"
sudo -u postgres psql -d campushub_db -c "GRANT ALL ON SCHEMA public TO campushub_user;"

# 6. Run migrations
python manage.py migrate

# 7. Start development server
python manage.py runserver
```

> **Note:** On Ubuntu 26.04, PostgreSQL 18 listens on port **5434** by default, not 5432. Set `DB_PORT=5434` in your `.env`.

### Frontend

```bash
cd ../campushub-frontend
npm install
npm run dev
```

Run the frontend checks with:

```bash
npm run lint
npm run test
npm run build
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

SECRET_KEY=your-django-secret-key
DEBUG=True
DB_NAME=campushub_db
DB_USER=campushub_user
DB_PASSWORD=your-password
DB_HOST=127.0.0.1
DB_PORT=5434


---

## Development Phases

| Phase | Feature | Backend | Frontend |
|-------|---------|---------|---------|
| 0 | Config & Setup | ✅ | ✅ |
| 1A | Auth Backend | ✅ | — |
| 1B | Auth Frontend | — | 🔄 |
| 2 | Academics | ⏳ | ⏳ |
| 3 | Resources | ⏳ | ⏳ |
| 4 | Placements | ⏳ | ⏳ |
| 5 | Applications | ⏳ | ⏳ |
| 6 | Polish & Deploy | ⏳ | ⏳ |

See [`docs/PHASE_STATUS.md`](docs/PHASE_STATUS.md) for detailed task tracking.

---

## Team

| Role | Name | GitHub |
|------|------|--------|
| Backend Developer | Mark Manoti | [@N3stah](https://github.com/N3stah) |
| Frontend Developer | Titus | [@koech](https://github.com/Koech028) |

---

## License

Academic project — The Nairobi National Polytechnic / Spin Mobile LLC internship, 2026.
