import pytest
from django.test import Client
from apps.accounts.models import User
from apps.academics.models import Department
from apps.accounts.jwt_utils import make_pair

pytestmark = pytest.mark.django_db

@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email='admin@test.com', username='admin', password='pass',
        first_name='Admin', last_name='User', role='admin'
    )

@pytest.fixture
def dept(db):
    return Department.objects.create(name='CS', code='CS')

@pytest.fixture
def student_in_dept(db, dept):
    return User.objects.create_user(
        email='student@test.com', username='student', password='pass',
        first_name='Student', last_name='User', role='student', department=dept
    )

@pytest.fixture
def student_no_dept(db):
    return User.objects.create_user(
        email='student2@test.com', username='student2', password='pass',
        first_name='Student2', last_name='User', role='student'
    )

def test_filter_users_by_department(client, admin_user, student_in_dept, student_no_dept, dept):
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/users/?role=student&department_id={dept.id}', **headers)
    assert response.status_code == 200
    assert response.json()['count'] == 1

def test_filter_lecturers_by_department(client, admin_user, dept):
    User.objects.create_user(
        email='lec@test.com', username='lec', password='pass',
        first_name='Lec', last_name='User', role='lecturer', department=dept
    )
    User.objects.create_user(
        email='lec2@test.com', username='lec2', password='pass',
        first_name='Lec2', last_name='User', role='lecturer'
    )
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.get(f'/api/lecturers/?department_id={dept.id}', **headers)
    assert response.status_code == 200
    assert response.json()['count'] == 1
