from io import StringIO
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import Client
from apps.accounts.jwt_utils import make_pair

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

    assert response.status_code == 201
    assert response.json()['role'] == 'student'


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


def test_create_admin_command_creates_secure_superuser():
    output = StringIO()
    with (
        patch('builtins.input', side_effect=[
            'admin@example.test',
            'campus-admin',
            'Admin',
            'One',
        ]),
        patch('apps.accounts.management.commands.create_admin.getpass', side_effect=[
            'T0ugh-Campus-Password!82',
            'T0ugh-Campus-Password!82',
        ]),
    ):
        call_command('create_admin', stdout=output)

    admin = User.objects.get(email='admin@example.test')
    assert admin.role == 'admin'
    assert admin.is_staff
    assert admin.is_superuser
    assert admin.check_password('T0ugh-Campus-Password!82')
    assert 'CampusHub admin account ready' in output.getvalue()

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

    response = client.get('/api/admin/stats/', **auth_header(admin))
    assert response.status_code == 200
    assert response.json()['active_users'] == 2

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
