import pytest
from django.test import Client
from apps.accounts.models import User
from apps.academics.models import Department, Course
from apps.accounts.jwt_utils import make_pair

pytestmark = pytest.mark.django_db

@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email='admin@test.com', username='admin', password='pass',
        first_name='Admin', last_name='User', role='admin'
    )

@pytest.fixture
def lecturer(db):
    return User.objects.create_user(
        email='lec@test.com', username='lec', password='pass',
        first_name='Lec', last_name='User', role='lecturer'
    )

@pytest.fixture
def student(db):
    return User.objects.create_user(
        email='student@test.com', username='student', password='pass',
        first_name='Student', last_name='User', role='student'
    )

@pytest.fixture
def dept(db):
    return Department.objects.create(name='CS', code='CS')

@pytest.fixture
def courses(dept, lecturer):
    c1 = Course.objects.create(code='CS101', title='Intro', department=dept, lecturer=lecturer)
    c2 = Course.objects.create(code='CS102', title='Intro2', department=dept, lecturer=lecturer)
    return [c1, c2]

def test_bulk_assign_success(client, admin_user, lecturer, courses):
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.post(
        '/api/academics/courses/assign-lecturer/',
        data={'course_ids': [c.id for c in courses], 'lecturer_id': lecturer.id},
        content_type='application/json',
        **headers
    )
    assert response.status_code == 200
    assert response.json()['updated'] == 2

def test_bulk_assign_non_admin(client, student, lecturer, courses):
    token, _ = make_pair(student)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.post(
        '/api/academics/courses/assign-lecturer/',
        data={'course_ids': [c.id for c in courses], 'lecturer_id': lecturer.id},
        content_type='application/json',
        **headers
    )
    assert response.status_code == 403

def test_bulk_assign_bad_course_ids(client, admin_user, lecturer, courses):
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    response = client.post(
        '/api/academics/courses/assign-lecturer/',
        data={'course_ids': [9999], 'lecturer_id': lecturer.id},
        content_type='application/json',
        **headers
    )
    assert response.status_code == 400
