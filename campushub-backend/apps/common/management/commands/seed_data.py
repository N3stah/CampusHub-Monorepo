from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from datetime import date, timedelta
from apps.academics.models import Department, Course, Enrollment
from apps.placements.models import Placement

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds the database with realistic test data for demo day.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting database seeding...'))

        # 1. Create Users
        admin, _ = User.objects.get_or_create(
            email='seed.admin@campushub.com',
            defaults={'username': 'seed_admin', 'first_name': 'System', 'last_name': 'Admin', 'role': 'admin', 'is_staff': True, 'is_superuser': True}
        )
        admin.set_password('AdminPass123!')
        admin.save()

        officer, _ = User.objects.get_or_create(
            email='seed.officer@campushub.com',
            defaults={'username': 'seed_officer', 'first_name': 'Placement', 'last_name': 'Officer', 'role': 'officer'}
        )
        officer.set_password('OfficerPass123!')
        officer.save()

        lecturer1, _ = User.objects.get_or_create(
            email='seed.dr.smith@campushub.com',
            defaults={'username': 'seed_dr_smith', 'first_name': 'Dr. John', 'last_name': 'Smith', 'role': 'lecturer'}
        )
        lecturer1.set_password('LecturerPass123!')
        lecturer1.save()

        student1, _ = User.objects.get_or_create(
            email='seed.mark@campushub.com',
            defaults={'username': 'seed_mark', 'first_name': 'Mark', 'last_name': 'Student', 'role': 'student', 'gpa': 3.8}
        )
        student1.set_password('StudentPass123!')
        student1.save()

        student2, _ = User.objects.get_or_create(
            email='seed.anna@campushub.com',
            defaults={'username': 'seed_anna', 'first_name': 'Anna', 'last_name': 'Student', 'role': 'student', 'gpa': 3.9}
        )
        student2.set_password('StudentPass123!')
        student2.save()

        self.stdout.write('Created users (Admin, Officer, 2 Lecturers, 2 Students)')

        # 2. Create Departments
        cs_dept, _ = Department.objects.get_or_create(name='Computer Science', code='CS')
        ee_dept, _ = Department.objects.get_or_create(name='Electrical Engineering', code='EE')
        self.stdout.write('Created departments')

        # 3. Create Courses
        course1, _ = Course.objects.get_or_create(code='CS101', defaults={'title': 'Intro to Computer Science', 'department': cs_dept, 'lecturer': lecturer1, 'credits': 3})
        course2, _ = Course.objects.get_or_create(code='CS301', defaults={'title': 'Database Systems', 'department': cs_dept, 'lecturer': lecturer1, 'credits': 4})
        course3, _ = Course.objects.get_or_create(code='EE101', defaults={'title': 'Circuit Analysis', 'department': ee_dept, 'lecturer': lecturer1, 'credits': 3})
        self.stdout.write('Created courses')

        # 4. Create Enrollments
        Enrollment.objects.get_or_create(student=student1, course=course1, defaults={'status': 'active'})
        Enrollment.objects.get_or_create(student=student1, course=course2, defaults={'status': 'active'})
        Enrollment.objects.get_or_create(student=student2, course=course1, defaults={'status': 'active'})
        self.stdout.write('Enrolled students in courses')

        # 5. Create Placements
        Placement.objects.get_or_create(
            title='Backend Engineering Intern (Seed)',
            defaults={
                'posted_by': officer,
                'company': 'Spin Mobile LLC',
                'location': 'Nairobi, Kenya',
                'description': 'Work on Django REST APIs and microservices.',
                'requirements': 'Python, Django, PostgreSQL',
                'deadline': date.today() + timedelta(days=30),
                'slots_available': 2
            }
        )
        Placement.objects.get_or_create(
            title='Frontend Engineering Intern (Seed)',
            defaults={
                'posted_by': officer,
                'company': 'Acme Corp',
                'location': 'Remote',
                'description': 'Build responsive web apps using Next.js.',
                'requirements': 'JavaScript, React, Tailwind CSS',
                'deadline': date.today() + timedelta(days=45),
                'slots_available': 3
            }
        )
        self.stdout.write('Created placement opportunities')

        self.stdout.write(self.style.SUCCESS('Database seeding completed successfully!'))
        self.stdout.write(self.style.WARNING('\nLogin Credentials:'))
        self.stdout.write('Admin:    seed.admin@campushub.com / AdminPass123!')
        self.stdout.write('Officer:  seed.officer@campushub.com / OfficerPass123!')
        self.stdout.write('Lecturer: seed.dr.smith@campushub.com / LecturerPass123!')
        self.stdout.write('Student:  seed.mark@campushub.com / StudentPass123!')
