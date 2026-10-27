import os
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from datetime import date, timedelta
from apps.academics.models import Department, Course, Enrollment
from apps.placements.models import Placement

User = get_user_model()

class Command(BaseCommand):
    help = "Seeds the database with realistic test data for demo day."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Force run in production mode.")

    def handle(self, *args, **options):
        # Production guard: refuse to run in prod unless --force is passed
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "Refusing to seed database in production mode (DEBUG=False). "
                "Pass --force to override. If overriding, ensure you set SEED_*_PASSWORD environment variables."
            )

        # Read passwords from env vars, fall back to dev defaults only in DEBUG mode

        if not all([admin_pass, officer_pass, lecturer_pass, student_pass]):
            raise CommandError("SEED_*_PASSWORD environment variables must be set when running in production.")

        self.stdout.write(self.style.SUCCESS("Starting database seeding..."))

        # 1. Create Users
        admin, _ = User.objects.get_or_create(
            email="seed.admin@campushub.com",
            defaults={"username": "seed_admin", "first_name": "System", "last_name": "Admin", "role": "admin", "is_staff": True, "is_superuser": True}
        )
        admin.set_password(admin_pass)
        admin.save()

        officer, _ = User.objects.get_or_create(
            email="seed.officer@campushub.com",
            defaults={"username": "seed_officer", "first_name": "Placement", "last_name": "Officer", "role": "officer"}
        )
        officer.set_password(officer_pass)
        officer.save()

        lecturer1, _ = User.objects.get_or_create(
            email="seed.dr.smith@campushub.com",
            defaults={"username": "seed_dr_smith", "first_name": "Dr. John", "last_name": "Smith", "role": "lecturer"}
        )
        lecturer1.set_password(lecturer_pass)
        lecturer1.save()

        student1, _ = User.objects.get_or_create(
            email="seed.mark@campushub.com",
            defaults={"username": "seed_mark", "first_name": "Mark", "last_name": "Student", "role": "student", "gpa": "3.80"}
        )
        student1.set_password(student_pass)
        student1.save()

        student2, _ = User.objects.get_or_create(
            email="seed.anna@campushub.com",
            defaults={"username": "seed_anna", "first_name": "Anna", "last_name": "Student", "role": "student", "gpa": "3.90"}
        )
        student2.set_password(student_pass)
        student2.save()

        self.stdout.write("Created users (Admin, Officer, 2 Lecturers, 2 Students)")

        # 2. Create Departments
        cs_dept, _ = Department.objects.get_or_create(name="Computer Science", code="CS")
        ee_dept, _ = Department.objects.get_or_create(name="Electrical Engineering", code="EE")
        self.stdout.write("Created departments")

        # 3. Create Courses
        course1, _ = Course.objects.get_or_create(code="CS101", defaults={"title": "Intro to Computer Science", "department": cs_dept, "lecturer": lecturer1, "credits": 3})
        course2, _ = Course.objects.get_or_create(code="CS301", defaults={"title": "Database Systems", "department": cs_dept, "lecturer": lecturer1, "credits": 4})
        course3, _ = Course.objects.get_or_create(code="EE101", defaults={"title": "Circuit Analysis", "department": ee_dept, "lecturer": lecturer1, "credits": 3})
        self.stdout.write("Created courses")

        # 4. Create Enrollments
        Enrollment.objects.get_or_create(student=student1, course=course1, defaults={"status": "active"})
        Enrollment.objects.get_or_create(student=student1, course=course2, defaults={"status": "active"})
        Enrollment.objects.get_or_create(student=student2, course=course1, defaults={"status": "active"})
        self.stdout.write("Enrolled students in courses")

        # 5. Create Placements
        Placement.objects.get_or_create(
            title="Backend Engineering Intern (Seed)",
            defaults={
                "posted_by": officer,
                "company": "Spin Mobile LLC",
                "location": "Nairobi, Kenya",
                "description": "Work on Django REST APIs and microservices.",
                "requirements": "Python, Django, PostgreSQL",
                "deadline": date.today() + timedelta(days=30),
                "slots_available": 2
            }
        )
        Placement.objects.get_or_create(
            title="Frontend Engineering Intern (Seed)",
            defaults={
                "posted_by": officer,
                "company": "Acme Corp",
                "location": "Remote",
                "description": "Build responsive web apps using Next.js.",
                "requirements": "JavaScript, React, Tailwind CSS",
                "deadline": date.today() + timedelta(days=45),
                "slots_available": 3
            }
        )
        self.stdout.write("Created placement opportunities")

        if settings.DEBUG:
            self.stdout.write(self.style.WARNING("
Login Credentials (DEV MODE ONLY):"))
        else:
            self.stdout.write(self.style.SUCCESS("Seeded production database with passwords from environment variables."))
