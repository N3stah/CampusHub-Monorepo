from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone

from apps.academics.models import Course, Department, Enrollment, School, Unit
from apps.accounts.jwt_utils import make_pair
from apps.placements.models import Application, Placement

User = get_user_model()
pytestmark = pytest.mark.django_db


def make_user(email, username, role='student', **kwargs):
    return User.objects.create_user(
        email=email,
        username=username,
        first_name='Test',
        last_name='Account',
        password='T0ugh-Campus-Password!82',
        role=role,
        **kwargs,
    )


def auth_header(user):
    access, _ = make_pair(user)
    return {'HTTP_AUTHORIZATION': f'Bearer {access}'}


def test_admin_can_create_role_accounts_and_they_can_login(client):
    admin = make_user('admin@example.test', 'campus-admin', role='admin')
    admin.is_staff = True
    admin.save(update_fields=['is_staff'])
    response = client.post(
        '/api/users/',
        data={
            'email': 'lecturer@example.test',
            'username': 'lecturer-one',
            'first_name': 'Lee',
            'last_name': 'Lecturer',
            'password': 'T0ugh-Campus-Password!82',
            'role': 'lecturer',
            'title': 'Senior Lecturer',
            'office_hours': 'Tuesday 10:00',
        },
        content_type='application/json',
        **auth_header(admin),
    )

    assert response.status_code == 201
    assert response.json()['role'] == 'lecturer'
    assert response.json()['title'] == 'Senior Lecturer'
    account = User.objects.get(email='lecturer@example.test')
    assert account.check_password('T0ugh-Campus-Password!82')
    assert not account.is_superuser

    login_response = client.post(
        '/api/auth/token/',
        data={'email': account.email, 'password': 'T0ugh-Campus-Password!82'},
        content_type='application/json',
    )
    assert login_response.status_code == 200
    me_response = client.get(
        '/api/auth/me/',
        HTTP_AUTHORIZATION=f"Bearer {login_response.json()['access']}",
    )
    assert me_response.status_code == 200
    assert me_response.json()['role'] == 'lecturer'


@pytest.mark.parametrize('role', ['student', 'lecturer', 'officer', 'admin'])
def test_each_application_role_can_login(client, role):
    admin = make_user(f'bootstrap-{role}@example.test', f'bootstrap-{role}', role='admin')
    response = client.post(
        '/api/users/',
        data={
            'email': f'{role}@example.test',
            'username': f'{role}-user',
            'first_name': 'Campus',
            'last_name': role.title(),
            'password': 'T0ugh-Campus-Password!82',
            'role': role,
        },
        content_type='application/json',
        **auth_header(admin),
    )
    assert response.status_code == 201

    login = client.post(
        '/api/auth/token/',
        data={'email': f'{role}@example.test', 'password': 'T0ugh-Campus-Password!82'},
        content_type='application/json',
    )
    assert login.status_code == 200
    profile = client.get(
        '/api/auth/me/',
        HTTP_AUTHORIZATION=f"Bearer {login.json()['access']}",
    )
    assert profile.status_code == 200
    assert profile.json()['role'] == role


def test_registration_cannot_assign_privileged_roles(client):
    response = client.post(
        '/api/auth/register/',
        data={
            'email': 'officer@example.test',
            'username': 'officer-one',
            'first_name': 'Pat',
            'last_name': 'Officer',
            'password': 'T0ugh-Campus-Password!82',
            'role': 'admin',
        },
        content_type='application/json',
    )

    assert response.status_code == 403
    assert not User.objects.filter(email='officer@example.test').exists()


def test_only_admin_can_create_users(client):
    student = make_user('student@example.test', 'student-one')
    response = client.post(
        '/api/users/',
        data={
            'email': 'other@example.test',
            'username': 'other-one',
            'first_name': 'Other',
            'last_name': 'Account',
            'password': 'T0ugh-Campus-Password!82',
            'role': 'admin',
        },
        content_type='application/json',
        **auth_header(student),
    )
    assert response.status_code == 403
    assert not User.objects.filter(email='other@example.test').exists()


def test_admin_stats_directory_searches_and_filters_students(client):
    admin = make_user('directory-admin@example.test', 'directory-admin', role='admin')
    department = Department.objects.create(name='Computing', code='COMP')
    matching = make_user('ada@example.test', 'ada-lovelace', department=department)
    matching.first_name = 'Ada'
    matching.last_name = 'Lovelace'
    matching.save(update_fields=['first_name', 'last_name'])
    make_user('grace@example.test', 'grace-hopper')
    other_department = Department.objects.create(name='Business', code='BUS')
    other_ada = make_user('other-ada@example.test', 'other-ada', department=other_department)
    other_ada.first_name = 'Ada'
    other_ada.last_name = 'Byron'
    other_ada.save(update_fields=['first_name', 'last_name'])

    response = client.get(
        '/api/admin/stats/directory/students/?search=Ada&department_id={}&account_status=active'.format(department.id),
        **auth_header(admin),
    )

    assert response.status_code == 200
    result = response.json()
    assert result['count'] == 1
    assert result['results'][0]['id'] == matching.id
    assert result['results'][0]['name'] == 'Ada Lovelace'
    assert result['results'][0]['status'] == 'Active'


def test_admin_stats_directory_filters_and_searches_applications(client):
    admin = make_user('applications-admin@example.test', 'applications-admin', role='admin')
    student = make_user('applicant@example.test', 'applicant')
    student.first_name = 'Morgan'
    student.last_name = 'Student'
    student.save(update_fields=['first_name', 'last_name'])
    department = Department.objects.create(name='Computing', code='COMP')
    course = Course.objects.create(code='COMP101', title='Computing', department=department)
    Enrollment.objects.create(student=student, course=course)
    placement = Placement.objects.create(
        title='Campus software internship',
        company='Campus Systems',
        location='Main campus',
        description='Support the campus software team.',
        requirements='Currently enrolled.',
        deadline=(timezone.now() + timedelta(days=14)).date(),
        slots_available=1,
        posted_by=admin,
    )
    application = Application.objects.create(
        student=student,
        placement=placement,
        status='pending',
        cover_note='Interested in this role.',
    )

    response = client.get(
        '/api/admin/stats/directory/applications/?search=Campus&status=pending',
        **auth_header(admin),
    )

    assert response.status_code == 200
    result = response.json()
    assert result['count'] == 1
    assert result['results'][0]['id'] == application.id
    assert result['results'][0]['name'] == 'Morgan Student'
    assert result['results'][0]['status'] == 'Pending'


def test_non_admin_cannot_open_admin_stats_directories(client):
    student = make_user('directory-student@example.test', 'directory-student')

    response = client.get(
        '/api/admin/stats/directory/students/',
        **auth_header(student),
    )

    assert response.status_code == 403


def test_officer_can_only_list_student_accounts(client):
    officer = make_user('officer@example.test', 'officer-one', role='officer')
    student = make_user('student@example.test', 'student-one')
    make_user('lecturer@example.test', 'lecturer-one', role='lecturer')

    response = client.get('/api/users/', **auth_header(officer))
    assert response.status_code == 200
    assert [item['id'] for item in response.json()['results']] == [student.id]

    forbidden = client.get('/api/users/?role=lecturer', **auth_header(officer))
    assert forbidden.status_code == 403


def test_admin_can_update_and_deactivate_users_without_deleting_records(client):
    admin = make_user('admin@example.test', 'campus-admin', role='admin')
    account = make_user('student@example.test', 'student-one')

    updated = client.patch(
        f'/api/users/{account.id}/',
        data={'role': 'officer', 'first_name': 'Updated'},
        content_type='application/json',
        **auth_header(admin),
    )
    assert updated.status_code == 200
    assert updated.json()['role'] == 'officer'
    assert updated.json()['first_name'] == 'Updated'

    deleted = client.delete(f'/api/users/{account.id}/', **auth_header(admin))
    assert deleted.status_code == 200
    account.refresh_from_db()
    assert account.is_active is False
    assert User.objects.filter(pk=account.pk).exists()


def test_admin_cannot_deactivate_themselves(client):
    admin = make_user('admin@example.test', 'campus-admin', role='admin')
    response = client.delete(f'/api/users/{admin.id}/', **auth_header(admin))
    assert response.status_code == 400
    admin.refresh_from_db()
    assert admin.is_active


def test_lecturer_endpoints_are_filtered_and_admin_managed(client):
    admin = make_user('admin@example.test', 'campus-admin', role='admin')
    lecturer = make_user('lecturer@example.test', 'lecturer-one', role='lecturer')
    make_user('student@example.test', 'student-one')

    listed = client.get('/api/lecturers/', **auth_header(admin))
    assert listed.status_code == 200
    assert [item['id'] for item in listed.json()['results']] == [lecturer.id]

    updated = client.patch(
        f'/api/lecturers/{lecturer.id}/',
        data={'is_active': False},
        content_type='application/json',
        **auth_header(admin),
    )
    assert updated.status_code == 200
    assert updated.json()['role'] == 'lecturer'
    assert updated.json()['is_active'] is False


def test_invalid_user_data_returns_validation_errors(client):
    admin = make_user('admin@example.test', 'campus-admin', role='admin')
    response = client.post(
        '/api/users/',
        data={
            'email': 'invalid',
            'username': 'bad-user',
            'first_name': 'Bad',
            'last_name': 'User',
            'password': 'T0ugh-Campus-Password!82',
            'role': 'admin',
            'gpa': '4.5',
        },
        content_type='application/json',
        **auth_header(admin),
    )
    assert response.status_code == 400
    assert 'valid email' in response.json()['error']


def test_superuser_defaults_to_admin_role():
    admin = User.objects.create_superuser(
        email='admin@example.test',
        username='campus-admin',
        first_name='Admin',
        last_name='One',
        password='T0ugh-Campus-Password!82',
    )
    assert admin.role == 'admin'
    assert admin.is_staff
    assert admin.is_superuser
    assert admin.check_password('T0ugh-Campus-Password!82')

    login = Client().post(
        '/api/auth/token/',
        data={'email': admin.email, 'password': 'T0ugh-Campus-Password!82'},
        content_type='application/json',
    )
    assert login.status_code == 200
    assert login.json()['access']


def test_admin_stats_requires_admin_role_and_returns_counts(client):
    admin = make_user('admin@example.test', 'campus-admin', role='admin')
    student = make_user('student@example.test', 'student-one')
    lecturer = make_user('lecturer@example.test', 'lecturer-one', role='lecturer')
    officer = make_user('officer@example.test', 'officer-one', role='officer')
    school = School.objects.create(name='Engineering', code='ENG')
    department = Department.objects.create(name='Computing', code='COMP', school=school)
    course = Course.objects.create(code='BSCIT', title='Information Technology', department=department)
    unit = Unit.objects.create(code='IT101', title='Introduction to IT')
    Enrollment.objects.create(student=student, course=course)
    placement = Placement.objects.create(
        title='Software Intern',
        company='CampusHub',
        location='Nairobi',
        description='Internship placement',
        requirements='Currently enrolled student',
        deadline=timezone.localdate() + timedelta(days=30),
    )
    Application.objects.create(student=student, placement=placement, cover_note='I am interested.')

    response = client.get('/api/admin/stats/', **auth_header(admin))
    assert response.status_code == 200
    assert response.json() == {
        'active_users': 4,
        'students': 1,
        'lecturers': 1,
        'placement_officers': 1,
        'schools': 1,
        'departments': 1,
        'courses': 1,
        'units': 1,
        'active_enrollments': 1,
        'placements': 1,
        'applications': 1,
        'open_placements': 1,
        'pending_applications': 1,
    }

    forbidden = client.get('/api/admin/stats/', **auth_header(student))
    assert forbidden.status_code == 403


def test_admin_logs_returns_audited_account_mutations(client):
    admin = make_user('admin@example.test', 'campus-admin', role='admin')
    create_response = client.post(
        '/api/users/',
        data={
            'email': 'student@example.test',
            'username': 'student-one',
            'first_name': 'Student',
            'last_name': 'One',
            'password': 'T0ugh-Campus-Password!82',
            'role': 'student',
        },
        content_type='application/json',
        **auth_header(admin),
    )
    assert create_response.status_code == 201

    response = client.get('/api/admin/logs/', **auth_header(admin))
    assert response.status_code == 200
    assert response.json()['count'] == 1
    assert response.json()['results'][0]['action'] == 'user.created'
    assert response.json()['results'][0]['actor'] == admin.get_full_name()

    student = User.objects.get(email='student@example.test')
    forbidden = client.get('/api/admin/logs/', **auth_header(student))
    assert forbidden.status_code == 403
