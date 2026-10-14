# CampusHub — Development Guide

> **Architecture:** Vertical Slice Architecture (VSA) + Agentic Coding Workflow  
> **Project:** CampusHub — University Departmental Resource & Placement Portal  
> **Team:** Mark Manoti (Ubuntu · Backend and Frontend Lead) · [Partner Name] (Windows · Frontend and Backend Lead)  
> **Stack:** Django REST Framework 3.x · PostgreSQL 15+ · Next.js 16 (App Router) · TypeScript  
> **Repo:** https://github.com/N3stah/CampusHub-Monorepo  
> **Version:** v1.0 · 2026-10-13

---

## ⚡ AI CONTEXT BLOCK — Read this first if you are an AI assistant

This document is the single source of truth for the CampusHub project. Upload it to any AI session to get immediate context for pair programming, debugging, or code review.

**Quick facts for the AI:**
- Monorepo: `CampusHub-Monorepo/campushub-backend/` (Django) + `CampusHub-Monorepo/campushub-frontend/` (Next.js)
- Backend runs on `http://localhost:8000` · Frontend on `http://localhost:3000`
- Django app structure: `apps/accounts/` · `apps/academics/` · `apps/resources/` · `apps/placements/` · `apps/common/`
- Auth: JWT via SimpleJWT — access token (5 min) + refresh token (7 days)
- User roles: `student | lecturer | officer | admin` — enforced by DRF custom permissions
- All endpoints live under `/api/` prefix
- Frontend uses Axios instance from `lib/api.ts` — bearer token attached automatically via interceptor
- File uploads go to `media/` folder — `MEDIA_ROOT` set in settings, served in dev by Django's `static()` helper
- This guide uses **Vertical Slice Architecture** — each feature slice owns its models, serializers, views, URLs, and tests

**Current phase:** Check `docs/PHASE_STATUS.md` in the repository for live progress.

---

## Table of Contents

1. [Architecture Philosophy](#1-architecture-philosophy)
2. [Folder Structure](#2-folder-structure)
3. [Cross-OS Setup](#3-cross-os-setup)
4. [Git & Collaboration Rules](#4-git--collaboration-rules)
5. [Phases Overview](#5-phases-overview)
6. [Phase 0 — Project Configuration](#phase-0--project-configuration)
7. [Phase 1 — Auth & User Slice](#phase-1--auth--user-slice)
8. [Phase 2 — Academics Slice](#phase-2--academics-slice)
9. [Phase 3 — Resources Slice](#phase-3--resources-slice)
10. [Phase 4 — Placements Slice](#phase-4--placements-slice)
11. [Phase 5 — Application Workflow Slice](#phase-5--application-workflow-slice)
12. [Phase 6 — Polish, Tests & Deploy](#phase-6--polish-tests--deploy)
13. [API Contract Reference](#13-api-contract-reference)
14. [Definition of Done](#14-definition-of-done)
15. [Common Commands](#15-common-commands)

---

## 1. Architecture Philosophy

### Why Vertical Slice Architecture?

Most beginners organize code in **horizontal layers**: all models together, all views together, all serializers together. This creates a problem: to understand one feature, you jump between 5 different folders.

**Vertical Slice Architecture** organizes code by **feature** (a "slice" that cuts through all layers):

```
Horizontal (BAD for teams):         Vertical (Our approach):
models/                             apps/
  user.py                             accounts/
  course.py                             models.py       ← User only
  placement.py                          serializers.py  ← User only
views/                                  views.py        ← User only
  user_views.py                         urls.py         ← User only
  course_views.py                       tests.py        ← User only
  placement_views.py                  academics/
                                        models.py       ← Course, Enrollment
                                        serializers.py
                                        ...
```

**Benefit for your two-person team:** Mark can work on `apps/placements/` while Titus works on `campushub-frontend/app/placements/` — **zero file conflicts** because each person owns their slice.

### Agentic Coding Principles

This guide is designed so you can drop it into any AI coding session and immediately resume work. Follow these rules when working with an AI assistant:

1. **Always paste the current phase checklist** from this doc into your AI session before starting.
2. **Show the AI your actual file structure** by running `find . -type f -name "*.py" | head -50` (backend) or `find src -type f | head -50` (frontend) and pasting the output.
3. **Paste error messages in full** — never describe errors; paste the traceback.
4. **One task per AI session** — don't ask an AI to build three features at once.
5. **Always commit before switching tasks** — a clean `git status` is your safety net.

---

## 2. Folder Structure

### Backend — `campushub-backend/`

```
campushub-backend/
├── manage.py
├── requirements.txt              # pip freeze > requirements.txt
├── .env                          # SECRET. Never commit. Listed in .gitignore
├── .env.example                  # Template. Safe to commit.
├── config/
│   ├── settings/
│   │   ├── base.py               # Shared settings
│   │   ├── dev.py                # Local dev overrides (DEBUG=True)
│   │   └── prod.py               # Production overrides
│   ├── urls.py                   # Root URL config — includes app urls
│   ├── wsgi.py
│   └── asgi.py
├── apps/
│   ├── accounts/                 # Slice 1: User, Auth, JWT
│   │   ├── models.py             # Custom User model
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── permissions.py        # IsStudent, IsLecturer, IsOfficer, IsAdmin
│   │   ├── validators.py
│   │   ├── admin.py
│   │   └── tests/
│   │       ├── test_models.py
│   │       └── test_views.py
│   ├── academics/                # Slice 2: Department, Course, Enrollment
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── tests/
│   ├── resources/                # Slice 3: Resource, Announcement
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── tests/
│   ├── placements/               # Slice 4+5: Placement, Application
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── validators.py         # deadline_must_be_future, no_duplicate_application
│   │   ├── services.py           # ApplicationService with @transaction.atomic
│   │   ├── admin.py
│   │   └── tests/
│   └── common/                   # Shared across all slices
│       ├── models.py             # Abstract BaseModel (id, created_at, updated_at)
│       ├── permissions.py        # Reusable DRF permission classes
│       └── pagination.py         # StandardResultsSetPagination
├── docs/
│   ├── ERD.md                    # ← You are here
│   ├── DEVELOPMENT_GUIDE.md      # ← This file
│   ├── sql/
│   │   ├── 01_student_course_resources.sql
│   │   ├── 02_placements_with_stats.sql
│   │   ├── 03_lecturer_upload_leaderboard.sql
│   │   └── 04_course_engagement_report.sql
│   └── PHASE_STATUS.md           # Live progress tracker
└── tests/
    └── conftest.py               # pytest fixtures (db, users, auth tokens)
```

### Frontend — `campushub-frontend/`

```
campushub-frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── courses/
│   │   │   ├── page.tsx          # Course list
│   │   │   └── [id]/page.tsx     # Course detail + resources
│   │   ├── placements/
│   │   │   ├── page.tsx          # Placement board
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Placement detail
│   │   │       └── apply/page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                   # Button, Card, Spinner, Alert, Badge
│   │   ├── layout/               # Navbar, Sidebar, Footer
│   │   └── forms/                # LoginForm, ApplyForm, UploadForm
│   ├── lib/
│   │   ├── api.ts                # Axios instance + interceptors
│   │   └── auth.ts               # Token storage + refresh logic
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCourses.ts
│   │   └── usePlacements.ts
│   └── types/
│       └── index.ts              # TypeScript interfaces (User, Course, etc.)
├── public/
└── package.json
```

---

## 3. Cross-OS Setup

### Ubuntu (Mark — Backend Lead)

```bash
# 1. Navigate to backend folder
cd CampusHub-Monorepo/campushub-backend

# 2. Activate venv (ALWAYS do this before any pip or python command)
source venv/bin/activate
# Prompt becomes: (venv) nestah@...

# 3. Verify you're in the right Python
which python  # should show: .../campushub-backend/venv/bin/python

# 4. Run the backend dev server
python manage.py runserver

# 5. Run tests
pytest

# 6. Freeze dependencies (after every new install)
pip freeze > requirements.txt
git add requirements.txt
git commit -m "chore: update requirements"
```

### Windows (Partner — Frontend Lead)

```powershell
# 1. Navigate to backend (if working on it)
cd CampusHub-Monorepo\campushub-backend

# Activate venv on Windows (different command!)
.\venv\Scripts\activate

# 2. Navigate to frontend
cd CampusHub-Monorepo\campushub-frontend

# Install dependencies (first time only)
npm install

# Run dev server
npm run dev
```

### Environment Files

Both developers need their own `.env` file. **Never commit it.**  
Create `.env` by copying `.env.example` and filling in your own database credentials.

```bash
# Ubuntu
cp .env.example .env
# Edit with nano or your preferred editor:
nano .env
```

```
# .env (in campushub-backend/)
SECRET_KEY=django-insecure-replace-this-in-production-use-50-char-random-string
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=campushub_db
DB_USER=postgres
DB_PASSWORD=your_local_password
DB_HOST=localhost
DB_PORT=5432

CORS_ALLOWED_ORIGINS=http://localhost:3000
```

---

## 4. Git & Collaboration Rules

### Branch Strategy

```
main                          ← Protected. Merged via PR only.
│
├── feature/accounts-backend   ← Mark works here
├── feature/accounts-frontend  ← Titus works here
├── feature/academics-backend
├── feature/academics-frontend
├── feature/resources-backend
├── feature/resources-frontend
├── feature/placements-backend
├── feature/placements-frontend
└── docs/erd-and-design        ← Documentation updates
```

**Rule:** One feature branch per slice per developer. Never code directly on `main`.

### Commit Message Format (Conventional Commits)

```bash
# Pattern:
# <type>(<scope>): <short description>

# Types:
feat      # New feature
fix       # Bug fix
refactor  # Code change without new feature or fix
test      # Adding or fixing tests
docs      # Documentation only
chore     # Build process, dependencies, tooling
style     # Formatting (no logic change)

# Examples:
git commit -m "feat(accounts): add custom user model with role field"
git commit -m "feat(academics): implement course enrollment endpoint"
git commit -m "fix(placements): prevent duplicate application submission"
git commit -m "test(accounts): add JWT login endpoint tests"
git commit -m "docs(erd): add normalization write-up"
git commit -m "chore: update requirements.txt with psycopg2-binary"
```

### Pull Request Rules

1. Feature must be fully working before opening a PR (no `TODO: fix this` in committed code)
2. PR description must include: **what changed**, **how to test it**, **Postman evidence** (screenshot or collection link)
3. The other developer reviews and approves before merge
4. Delete the feature branch after merge

---

## 5. Phases Overview

| Phase | Feature Slice | Week | 1A (Backend — Mark) | 1B (Frontend — Partner) |
|-------|--------------|------|---------------------|------------------------|
| 0 | Config & Setup | 8 | Both together | Both together |
| 1 | Auth & Users | 8 | Custom User model, JWT endpoints | Login/Register pages, token interceptor |
| 2 | Academics | 8–9 | Department, Course, Enrollment API | Course list, course detail pages |
| 3 | Resources | 9 | Resource upload, Announcement API | Resource viewer, announcement display |
| 4 | Placements | 9–10 | Placement CRUD, role permissions | Placement board, detail page |
| 5 | Applications | 10–11 | Atomic application workflow, status updates | Apply form, status tracker |
| 6 | Polish & Deploy | 11–12 | Tests (≥60%), seed command, OpenAPI | Responsive polish, error states, deploy |

**Parallel work rule:** A is always backend, B is always frontend. When A finishes a slice's API, B unblocks and can replace mock data with real API calls. While B is doing that, A starts the next slice.

---

## Phase 0 — Project Configuration

> **Both developers work together on this phase.**  
> Complete this before splitting into A/B parallel tracks.

### 0.1 settings.py structure

```
campushub-backend/config/settings/
├── base.py     ← All shared settings
├── dev.py      ← import from base; override DEBUG, DATABASES, CORS
└── prod.py     ← import from base; override for Render/Railway deployment
```

Set `DJANGO_SETTINGS_MODULE=config.settings.dev` in your `.env` for local dev.

### 0.2 base.py — Key settings to configure

```python
# config/settings/base.py
from pathlib import Path
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost').split(',')

AUTH_USER_MODEL = 'accounts.User'   # ← CRITICAL: set before first migration

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    # Our apps
    'apps.accounts',
    'apps.academics',
    'apps.resources',
    'apps.placements',
    'apps.common',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',   # ← Must be FIRST
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'apps.common.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 20,
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}

# File uploads
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
```

### 0.3 Create the PostgreSQL database

```bash
# On Ubuntu — Mark runs this
sudo -u postgres psql
```
```sql
CREATE DATABASE campushub_db;
CREATE USER campushub_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE campushub_db TO campushub_user;
\q
```

### 0.4 Phase 0 Checklist — both must be done before Phase 1

- [ ] `config/settings/base.py` written with correct `AUTH_USER_MODEL`
- [ ] `config/settings/dev.py` written with PostgreSQL connection
- [ ] `.env` and `.env.example` created
- [ ] `campushub_db` PostgreSQL database created and accessible
- [ ] All 5 apps registered in `INSTALLED_APPS`
- [ ] `python manage.py check` exits with **no errors**
- [ ] `npm run dev` starts the Next.js frontend without errors
- [ ] Git tag pushed: `v0.1.0-setup`

---

## Phase 1 — Auth & User Slice

### Phase 1A — Backend (Mark)

**Goal:** Custom User model + JWT registration/login endpoints  
**Branch:** `feature/accounts-backend`

#### Step 1A.1 — Custom User model

```python
# apps/accounts/models.py
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models

class UserManager(BaseUserManager):
    def create_user(self, email, username, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password, **extra_fields):
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, username, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('student',  'Student'),
        ('lecturer', 'Lecturer'),
        ('officer',  'Placement Officer'),
        ('admin',    'Admin'),
    ]

    email        = models.EmailField(unique=True)
    username     = models.CharField(max_length=50, unique=True)
    first_name   = models.CharField(max_length=100)
    last_name    = models.CharField(max_length=100)
    role         = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    department   = models.ForeignKey(
        'academics.Department',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='members'
    )
    gpa          = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    is_active    = models.BooleanField(default=True)
    is_staff     = models.BooleanField(default=False)
    date_joined  = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    class Meta:
        ordering = ['last_name', 'first_name']
        verbose_name_plural = 'users'

    def __str__(self):
        return f"{self.get_full_name()} <{self.email}> [{self.role}]"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()
```

> **⚠️ IMPORTANT:** Run `makemigrations` for `accounts` FIRST, before any other app, because all other apps reference this User model.

```bash
python manage.py makemigrations accounts
python manage.py migrate
```

#### Step 1A.2 — Serializers

```python
# apps/accounts/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    password  = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, label='Confirm password')

    class Meta:
        model  = User
        fields = ['email', 'username', 'first_name', 'last_name',
                  'role', 'password', 'password2']

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        return User.objects.create_user(**validated_data)

class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = ['id', 'email', 'username', 'first_name', 'last_name',
                  'full_name', 'role', 'department', 'gpa', 'is_active', 'date_joined']
        read_only_fields = ['id', 'email', 'role', 'date_joined']

    def get_full_name(self, obj):
        return obj.get_full_name()
```

#### Step 1A.3 — Views

```python
# apps/accounts/views.py
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from .serializers import RegisterSerializer, UserProfileSerializer

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    queryset         = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

class MeView(APIView):
    """Return the currently authenticated user's profile."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
```

#### Step 1A.4 — URLs

```python
# apps/accounts/urls.py
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import RegisterView, MeView

urlpatterns = [
    path('register/',      RegisterView.as_view(),       name='auth-register'),
    path('token/',         TokenObtainPairView.as_view(), name='auth-token'),
    path('token/refresh/', TokenRefreshView.as_view(),    name='auth-token-refresh'),
    path('me/',            MeView.as_view(),              name='auth-me'),
]
```

```python
# config/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/',      include('apps.academics.urls')),
    path('api/',      include('apps.resources.urls')),
    path('api/',      include('apps.placements.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

#### Step 1A Checklist

- [ ] `apps/accounts/models.py` written with Custom User model
- [ ] `makemigrations accounts` → `migrate` runs with no errors
- [ ] `create_superuser` works: `python manage.py createsuperuser`
- [ ] `RegisterSerializer` validates password match
- [ ] `POST /api/auth/register/` returns 201 with user data in Postman
- [ ] `POST /api/auth/token/` returns `access` + `refresh` tokens
- [ ] `GET /api/auth/me/` with `Authorization: Bearer <token>` returns user profile
- [ ] Postman collection saved to `docs/postman/`

---

### Phase 1B — Frontend (Partner)

**Goal:** Login page, register page, JWT token storage, protected route wrapper  
**Branch:** `feature/accounts-frontend`

> **Note for Partner:** The backend API base URL is `http://localhost:8000/api/`. The auth endpoints are documented above. Use the Postman collection in `docs/postman/` for reference while building.

#### Step 1B.1 — Axios instance with auth interceptor

```typescript
// src/lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'}/auth/token/refresh/`,
          { refresh }
        );
        localStorage.setItem('access_token', data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

#### Step 1B.2 — TypeScript types

```typescript
// src/types/index.ts
export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: 'student' | 'lecturer' | 'officer' | 'admin';
  department: number | null;
  gpa: string | null;
  is_active: boolean;
  date_joined: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface ApiError {
  detail?: string;
  [field: string]: string | string[] | undefined;
}
```

#### Step 1B.3 — Login page

```typescript
// src/app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { AuthTokens, ApiError } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<AuthTokens>('/auth/token/', form);
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: ApiError } };
      setError(axiosErr.response?.data?.detail ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-gray-900">Sign in to CampusHub</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
                     text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-sm text-center text-gray-500">
          No account?{' '}
          <a href="/register" className="text-indigo-600 hover:underline">Register</a>
        </p>
      </form>
    </main>
  );
}
```

#### Step 1B Checklist

- [ ] `src/lib/api.ts` Axios instance written with request + response interceptors
- [ ] `src/types/index.ts` defines `User`, `AuthTokens`, `ApiError`
- [ ] Login page submits to `POST /api/auth/token/` and stores tokens in localStorage
- [ ] Register page submits to `POST /api/auth/register/`
- [ ] Protected routes redirect to `/login` when no token is present
- [ ] `GET /api/auth/me/` is called on app load to populate user context

---

## Phase 2 — Academics Slice

### Phase 2A — Backend (Mark)

**Branch:** `feature/academics-backend`  
**Depends on:** Phase 1A complete (User model migrated)

#### Models to write

```python
# apps/academics/models.py
from django.db import models
from django.conf import settings

class Department(models.Model):
    name       = models.CharField(max_length=150, unique=True)
    code       = models.CharField(max_length=10, unique=True)
    faculty    = models.CharField(max_length=100)
    hod        = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='headed_departments'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.code} — {self.name}"

class Course(models.Model):
    code       = models.CharField(max_length=20, unique=True)
    title      = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    credits    = models.PositiveSmallIntegerField(default=3)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='courses')
    lecturer   = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='taught_courses'
    )
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f"{self.code}: {self.title}"

class Enrollment(models.Model):
    student     = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='enrollments'
    )
    course      = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    semester    = models.CharField(max_length=20)
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['student', 'course', 'semester']]
        ordering = ['-enrolled_at']

    def __str__(self):
        return f"{self.student} enrolled in {self.course} ({self.semester})"
```

#### Endpoints to implement

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/departments/` | Any auth | List all departments |
| POST | `/api/departments/` | Admin only | Create department |
| GET | `/api/departments/<id>/` | Any auth | Department detail |
| GET | `/api/courses/` | Any auth | List active courses (filterable by dept) |
| POST | `/api/courses/` | Admin/Lecturer | Create course |
| GET | `/api/courses/<id>/` | Any auth | Course detail + resource count |
| POST | `/api/courses/<id>/enroll/` | Student only | Enroll in a course |
| GET | `/api/courses/<id>/enrollments/` | Lecturer/Admin | List enrolled students |

#### Phase 2A Checklist

- [ ] `apps/academics/models.py` written (Department, Course, Enrollment)
- [ ] `makemigrations academics` → `migrate` runs cleanly
- [ ] All 3 models registered in `apps/academics/admin.py`
- [ ] `GET /api/departments/` returns list with pagination
- [ ] `GET /api/courses/` supports `?department=<id>` filter
- [ ] `POST /api/courses/<id>/enroll/` returns 201; prevents duplicate enrollment
- [ ] Postman collection updated

---

### Phase 2B — Frontend (Partner)

**Branch:** `feature/academics-frontend`  
**Depends on:** Phase 1B complete (auth interceptor working)

**Pages to build:**
- `/courses` — Course list grid, filterable by department
- `/courses/[id]` — Course detail: title, lecturer, enrolled count, resource list, announcements

**While waiting for Phase 2A:** build with mock data:

```typescript
// src/lib/mockData.ts  (delete after Phase 2A is done)
export const mockCourses = [
  { id: 1, code: 'CS301', title: 'Database Systems', credits: 3, department: 'CS', lecturer_name: 'Dr. Kamau' },
  { id: 2, code: 'CS302', title: 'Web Development',  credits: 3, department: 'CS', lecturer_name: 'Unassigned' },
];
```

Replace mock data with real API calls once Phase 2A endpoints are merged to `main`.

---

## Phase 3 — Resources Slice

### Phase 3A — Backend (Mark)

**Branch:** `feature/resources-backend`  
**Key challenge:** File upload handling

#### Models

Write `apps/resources/models.py` with `Resource` and `Announcement` models as per the ERD.

#### File Upload Configuration

```python
# In serializers.py — validate file type and size
class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Resource
        fields = '__all__'
        read_only_fields = ['uploaded_by', 'file_size', 'download_count', 'uploaded_at']

    def validate_file(self, value):
        max_size_mb = 20
        if value.size > max_size_mb * 1024 * 1024:
            raise serializers.ValidationError(f'File must be under {max_size_mb}MB.')
        allowed_types = ['application/pdf',
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                         'application/vnd.ms-powerpoint']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError('Only PDF, DOCX, and PPT files are allowed.')
        return value

    def create(self, validated_data):
        validated_data['uploaded_by'] = self.context['request'].user
        validated_data['file_size']   = validated_data['file'].size
        return super().create(validated_data)
```

#### Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/courses/<id>/resources/` | Enrolled student / Lecturer | List course resources |
| POST | `/api/courses/<id>/resources/` | Lecturer (course owner) | Upload resource |
| GET | `/api/resources/<id>/download/` | Enrolled student | Increment counter + return file URL |
| GET | `/api/courses/<id>/announcements/` | Enrolled student | List announcements (pinned first) |
| POST | `/api/courses/<id>/announcements/` | Lecturer (course owner) | Post announcement |

#### Phase 3A Checklist

- [ ] Resource and Announcement models migrated
- [ ] File upload endpoint returns 201 with file URL
- [ ] `download_count` increments on resource download
- [ ] Announcements sort: `is_pinned=True` first, then by `published_at` descending
- [ ] Only the lecturer assigned to a course can upload to it (permission check)

---

### Phase 3B — Frontend (Partner)

**Branch:** `feature/resources-frontend`

**Pages to build:**
- Resource viewer on course detail page — show file type icon, title, download button
- Announcement panel on course detail page — pinned items at top
- File upload form (for lecturer view only) — show only if `user.role === 'lecturer'`

---

## Phase 4 — Placements Slice

### Phase 4A — Backend (Mark)

**Branch:** `feature/placements-backend`

#### Models

Write `apps/placements/models.py` with `Placement` model as per ERD.

#### Custom Validator

```python
# apps/placements/validators.py
from django.core.exceptions import ValidationError
from django.utils import timezone

def deadline_must_be_future(value):
    if value <= timezone.now().date():
        raise ValidationError('Application deadline must be a future date.')
```

#### Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/placements/` | Any auth | List active placements (paginated) |
| POST | `/api/placements/` | Officer only | Create placement listing |
| GET | `/api/placements/<id>/` | Any auth | Placement detail |
| PUT/PATCH | `/api/placements/<id>/` | Officer (owner) | Update placement |
| DELETE | `/api/placements/<id>/` | Officer (owner) | Soft-delete (set is_active=False) |

#### Phase 4A Checklist

- [ ] Placement model migrated with `deadline_must_be_future` validator on `deadline`
- [ ] `GET /api/placements/` supports `?is_active=true` and `?company=<name>` filter
- [ ] Only officers can create/update/delete placements (permission class enforced)
- [ ] Past-deadline placements filtered out by default on list endpoint

---

### Phase 4B — Frontend (Partner)

**Branch:** `feature/placements-frontend`

**Pages to build:**
- `/placements` — Card grid of active placement listings
- `/placements/[id]` — Full detail: company, description, requirements, deadline, apply button
- Officer view: Create placement form (shown only to `role === 'officer'`)

---

## Phase 5 — Application Workflow Slice

### Phase 5A — Backend (Mark)

**Branch:** `feature/placements-backend` (extend existing branch) or `feature/application-backend`

This is the most technically complex slice — it must be **atomic** (all-or-nothing).

#### Model

Write `Application` model in `apps/placements/models.py` (extend the existing file).

#### ApplicationService — SOLID + Atomic

```python
# apps/placements/services.py
from django.db import transaction
from django.core.exceptions import ValidationError
from .models import Application, Placement

class ApplicationService:
    """
    Service layer wrapping application submission.
    SRP: this class is only responsible for submitting applications.
    DIP: it can be tested independently of views.
    """

    @staticmethod
    @transaction.atomic
    def submit(student, placement_id: int, cover_note: str, cv_file=None) -> Application:
        # 1. Fetch placement (raises Placement.DoesNotExist if not found)
        placement = Placement.objects.select_for_update().get(
            id=placement_id, is_active=True
        )

        # 2. Check deadline
        from django.utils import timezone
        if placement.deadline < timezone.now().date():
            raise ValidationError('This placement listing has passed its deadline.')

        # 3. Check for duplicate application (race-condition safe due to select_for_update)
        if Application.objects.filter(student=student, placement=placement).exists():
            raise ValidationError('You have already applied for this placement.')

        # 4. Create application
        application = Application.objects.create(
            student=student,
            placement=placement,
            cover_note=cover_note,
            cv_file=cv_file,
            status='pending',
        )
        return application

    @staticmethod
    @transaction.atomic
    def update_status(officer, application_id: int, new_status: str) -> Application:
        from django.utils import timezone
        valid_statuses = ['shortlisted', 'accepted', 'rejected']
        if new_status not in valid_statuses:
            raise ValidationError(f'Invalid status. Choose from: {valid_statuses}')

        application = Application.objects.select_for_update().get(id=application_id)
        application.status      = new_status
        application.reviewed_by = officer
        application.reviewed_at = timezone.now()
        application.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])
        return application
```

#### Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/placements/<id>/apply/` | Student only | Submit application |
| GET | `/api/applications/` | Student (own) / Officer (all) | List applications |
| GET | `/api/applications/<id>/` | Owner / Officer | Application detail |
| PATCH | `/api/applications/<id>/status/` | Officer only | Update status |

#### Phase 5A Checklist

- [ ] `Application` model migrated with `UNIQUE(student, placement)` constraint
- [ ] `ApplicationService.submit()` uses `@transaction.atomic` and `select_for_update()`
- [ ] Duplicate submission returns 400 with meaningful error message
- [ ] Past-deadline submission blocked by validator
- [ ] Officer can change status: `pending → shortlisted → accepted/rejected`
- [ ] Student can only see their own applications
- [ ] Officer can see all applications for placements they posted

---

### Phase 5B — Frontend (Partner)

**Branch:** `feature/application-frontend`

**Pages to build:**
- `/placements/[id]/apply` — Application form with cover note textarea + optional CV upload
- `/dashboard` — Student view: "My Applications" list with status badges
- Officer view on `/placements/[id]` — Applications list with status dropdowns

**Status badge colors:**
```typescript
const STATUS_COLORS = {
  pending:     'bg-yellow-100 text-yellow-800',
  shortlisted: 'bg-blue-100 text-blue-800',
  accepted:    'bg-green-100 text-green-800',
  rejected:    'bg-red-100 text-red-800',
} as const;
```

---

## Phase 6 — Polish, Tests & Deploy

### Phase 6A — Backend (Mark)

**Branch:** `feature/polish-backend`

#### Tests (target ≥ 60% coverage)

```bash
# Install test dependencies
pip install pytest pytest-django factory-boy

# Run tests with coverage
pytest --cov=apps --cov-report=term-missing

# Coverage report
pytest --cov=apps --cov-report=html
# Open htmlcov/index.html in browser
```

Priority tests to write:
- `test_register_creates_user_with_correct_role`
- `test_login_returns_jwt_tokens`
- `test_student_cannot_create_placement`
- `test_duplicate_application_returns_400`
- `test_past_deadline_application_blocked`
- `test_course_enrollment_unique_per_semester`

#### Seed Data Management Command

```bash
python manage.py seed_data   # Creates test departments, courses, users
```

Write this in `apps/accounts/management/commands/seed_data.py`.

#### OpenAPI Schema

```bash
pip install drf-spectacular

# In settings.py, add 'drf_spectacular' to INSTALLED_APPS
# In config/urls.py, add:
# path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
# path('api/docs/',   SpectacularSwaggerUIView.as_view(), name='swagger-ui'),

python manage.py spectacular --file docs/openapi.json
```

#### Deployment (Render)

- Add `Procfile`: `web: gunicorn config.wsgi:application`
- Add `render.yaml` for infrastructure-as-code
- Set environment variables in Render dashboard
- Static files: `python manage.py collectstatic`

#### Phase 6A Checklist

- [ ] `pytest --cov` shows ≥ 60% coverage
- [ ] `python manage.py seed_data` creates realistic test data
- [ ] `GET /api/docs/` shows Swagger UI with all endpoints documented
- [ ] `docs/openapi.json` committed to repository
- [ ] Backend deployed to Render — live URL documented in README.md

---

### Phase 6B — Frontend (Partner)

**Branch:** `feature/polish-frontend`

- Loading states: every API call shows a spinner while in-flight
- Error states: every API call shows a user-friendly error message on failure
- Empty states: "No placements yet" instead of a blank page
- Responsive: works on mobile (375px) and desktop (1280px)
- Deploy to Vercel: `npx vercel --prod`

---

## 13. API Contract Reference

### Authentication Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Standard Response Shapes

```json
// List response (paginated)
{
  "count": 42,
  "next": "http://localhost:8000/api/courses/?page=2",
  "previous": null,
  "results": [ ... ]
}

// Error response
{
  "detail": "Authentication credentials were not provided."
}

// Validation error
{
  "email": ["This field is required."],
  "password": ["Passwords do not match."]
}
```

### Status Codes Reference

| Code | Meaning | When to use |
|------|---------|-------------|
| 200 | OK | Successful GET, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation failed |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Valid token but wrong role |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate (e.g., duplicate application) |

---

## 14. Definition of Done

A feature is **done** when ALL of the following are true:

- [ ] Models migrated with no conflicts in migration history
- [ ] Endpoints return correct status codes for happy path AND error cases
- [ ] Role-based permissions enforced (tested in Postman with different user tokens)
- [ ] Serializer validates all inputs; no raw `request.POST` access anywhere
- [ ] At least one passing pytest test for the feature's critical path
- [ ] Frontend page renders data from the real API (not mock data)
- [ ] Loading and error states handled in the UI
- [ ] Feature branch passes CI (if configured) or has no failing tests
- [ ] PR opened with description + Postman evidence + partner review
- [ ] Merged to `main` via PR — not directly pushed

---

## 15. Common Commands

### Backend (run from `campushub-backend/` with venv active)

```bash
# Database
python manage.py makemigrations <app_name>
python manage.py migrate
python manage.py dbshell          # PostgreSQL shell

# Development
python manage.py runserver
python manage.py createsuperuser
python manage.py shell            # Django ORM shell
python manage.py seed_data        # Seed test data

# Testing
pytest                            # All tests
pytest apps/accounts/             # One slice
pytest --cov=apps                 # With coverage
pytest -x                         # Stop on first failure

# Dependencies
pip install <package>
pip freeze > requirements.txt

# API Schema
python manage.py spectacular --file docs/openapi.json
```

### Frontend (run from `campushub-frontend/`)

```bash
npm run dev         # Start dev server (http://localhost:3000)
npm run build       # Production build
npm run lint        # ESLint check
npm run type-check  # TypeScript check (npx tsc --noEmit)
npx vercel --prod   # Deploy to Vercel
```

### Git (run from project root)

```bash
git checkout -b feature/<slice>-<backend|frontend>
git add .
git status                          # Review before committing
git commit -m "feat(<scope>): ..."
git push origin HEAD
git log --oneline -10               # Recent commits
```

---

*This guide is designed to be uploaded to any AI coding session. Include this file in your context when debugging, pair programming, or picking up where you left off.*

*CampusHub — Spin Mobile LLC Internship Capstone · Mark Manoti · 2026*
