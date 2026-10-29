# CampusHub

CampusHub is a university learning and administration portal. This Next.js app provides student, lecturer, placement officer, and administrator workflows. The API is in the sibling `campushub-backend` Django project.

## Requirements

- Node.js and npm
- Python matching the backend environment
- PostgreSQL for a local development database

## Run locally

1. Configure and start the backend using `campushub-backend/.env.example` as a reference. Set `SECRET_KEY`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` for your local environment; do not commit secrets. Install the backend requirements, apply migrations, then start Django:

   ```powershell
   cd ..\campushub-backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   Copy-Item .env.example .env
   # Edit .env with your local PostgreSQL connection and a private SECRET_KEY.
   python manage.py migrate
   python manage.py runserver
   ```

2. In another terminal, install and start the frontend:

   ```powershell
   cd campushub-frontend
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The API defaults to `http://127.0.0.1:8000/api`. To use another API URL, set `NEXT_PUBLIC_API_URL` in a local `.env.local` file in this directory.

## Checks

Run frontend checks from `campushub-frontend`:

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Run backend tests from `campushub-backend`:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

## Lecturer workflows

- **Units** contains unit overviews, course rosters, assignments, announcements, and weekly class schedules.
- **Lesson plan** schedules, edits, searches, and removes individual lessons. Lesson/class overlaps are rejected, and scheduled lessons appear on the academic calendar.
- **Attendance** takes and corrects date-specific attendance for a scheduled weekly class. Attendance is recorded per student and class date; the roster can be searched and paginated.
- **Announcements** can target an entire unit or one generated student group, be pinned, or be scheduled. Students see announcements for their audience and can track their notification read status. Schedule `python manage.py dispatch_scheduled_announcements` as a recurring backend task (for example with Windows Task Scheduler) to deliver notifications at publication time.
- **Learning materials / notes** publishes files and links materials to scheduled lessons.
- Assignment detail pages manage deadlines and attachments; submissions can be searched, previewed, marked as draft or released, and exported through the unit gradebook. Grade changes are audited.

Lecturer access is based on the authenticated user's teaching assignments and active course enrolments. Use accounts provisioned for the local database to verify role-specific flows.
