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
def student(db):
    return User.objects.create_user(
        email='student@test.com', username='student', password='pass',
        first_name='Student', last_name='User', role='student', admission_number='ADM001'
    )

@pytest.fixture
def dept(db):
    return Department.objects.create(name='CS', code='CS')

@pytest.fixture
def course(dept):
    return Course.objects.create(code='CS101', title='Intro', department=dept)

def test_school_crud(client, admin_user):
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    
    # Create
    response = client.post('/api/academics/schools/', data={'name': 'Engineering', 'code': 'ENG'}, content_type='application/json', **headers)
    assert response.status_code == 201
    school_id = response.json()['id']
    
    # List
    response = client.get('/api/academics/schools/', **headers)
    assert response.status_code == 200
    assert response.json()['count'] >= 1
    
    # Detail
    response = client.get(f'/api/academics/schools/{school_id}/', **headers)
    assert response.status_code == 200
    assert response.json()['name'] == 'Engineering'
    
    # Update
    response = client.patch(f'/api/academics/schools/{school_id}/', data={'name': 'Eng'}, content_type='application/json', **headers)
    assert response.status_code == 200
    assert response.json()['name'] == 'Eng'

def test_unit_crud(client, admin_user, dept):
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    
    # Create
    response = client.post('/api/academics/units/', data={'code': 'CS101', 'title': 'Intro Unit', 'department_ids': [dept.id]}, content_type='application/json', **headers)
    assert response.status_code == 201
    unit_id = response.json()['id']
    
    # List
    response = client.get('/api/academics/units/', **headers)
    assert response.status_code == 200
    assert response.json()['count'] >= 1
    
    # Detail
    response = client.get(f'/api/academics/units/{unit_id}/', **headers)
    assert response.status_code == 200
    assert response.json()['title'] == 'Intro Unit'

def test_admin_enrollment(client, admin_user, student, course):
    token, _ = make_pair(admin_user)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    
    # Create
    response = client.post('/api/academics/admin/enrollments/', data={'admission_number': 'ADM001', 'course_id': course.id}, content_type='application/json', **headers)
    assert response.status_code == 201
    enrollment_id = response.json()['id']
    
    # List
    response = client.get('/api/academics/admin/enrollments/', **headers)
    assert response.status_code == 200
    assert response.json()['count'] >= 1
    
    # Update (change course)
    course2 = Course.objects.create(code='CS102', title='Intro 2', department=course.department)
    response = client.patch(f'/api/academics/admin/enrollments/{enrollment_id}/', data={'course_id': course2.id}, content_type='application/json', **headers)
    assert response.status_code == 200
    assert response.json()['course_id'] == course2.id
