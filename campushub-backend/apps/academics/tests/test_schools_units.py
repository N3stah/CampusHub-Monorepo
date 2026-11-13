import pytest
from django.test import Client
from apps.accounts.models import User
from apps.academics.models import Department, Course, Offering, School, Unit, UnitTeachingAssignment
from apps.accounts.jwt_utils import make_pair

pytestmark = pytest.mark.django_db

@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email='admin@test.com', username='admin', password='pass',
        first_name='Admin', last_name='User', role='admin'
    )

@pytest.fixture
def ict_admin(db):
    return User.objects.create_user(
        email='ict@test.com', username='ict-admin', password='pass',
        first_name='ICT', last_name='Admin', role='ict_admin'
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

def test_ict_admin_can_manage_schools_departments_and_programmes(client, ict_admin, dept):
    token, _ = make_pair(ict_admin)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}

    response = client.post(
        '/api/academics/schools/',
        data={'name': 'Engineering', 'code': 'ENG'},
        content_type='application/json',
        **headers,
    )
    assert response.status_code == 201
    school_id = response.json()['id']
    assert client.get('/api/academics/schools/', **headers).json()['results'][0]['department_count'] == 0

    response = client.patch(
        f'/api/academics/schools/{school_id}/',
        data={'name': 'Applied Engineering'},
        content_type='application/json',
        **headers,
    )
    assert response.status_code == 200
    assert response.json()['name'] == 'Applied Engineering'

    response = client.post(
        '/api/academics/departments/',
        data={'name': 'Engineering', 'code': 'ENG', 'school_id': school_id},
        content_type='application/json',
        **headers,
    )
    assert response.status_code == 201
    department_id = response.json()['id']

    response = client.patch(
        f'/api/academics/departments/{department_id}/',
        data={'name': 'Mechanical Engineering'},
        content_type='application/json',
        **headers,
    )
    assert response.status_code == 200
    assert response.json()['name'] == 'Mechanical Engineering'

    response = client.post(
        '/api/academics/courses/',
        data={
            'code': 'ME101',
            'title': 'Introduction to Engineering',
            'department_id': department_id,
            'credits': 120,
        },
        content_type='application/json',
        **headers,
    )
    assert response.status_code == 201
    course_id = response.json()['id']

    response = client.patch(
        f'/api/academics/courses/{course_id}/',
        data={'title': 'Engineering Fundamentals'},
        content_type='application/json',
        **headers,
    )
    assert response.status_code == 200
    assert response.json()['title'] == 'Engineering Fundamentals'

    response = client.delete(f'/api/academics/courses/{course_id}/', **headers)
    assert response.status_code == 200
    response = client.get('/api/academics/courses/?include_inactive=true', **headers)
    assert next(course for course in response.json()['results'] if course['id'] == course_id)['is_active'] is False
    response = client.patch(
        f'/api/academics/courses/{course_id}/',
        data={'is_active': True},
        content_type='application/json',
        **headers,
    )
    assert response.status_code == 200
    assert response.json()['is_active'] is True

    response = client.delete(f'/api/academics/departments/{department_id}/', **headers)
    assert response.status_code == 400
    assert client.get(f'/api/academics/schools/{school_id}/', **headers).status_code == 200

def test_ict_admin_can_delete_empty_department_and_school(client, ict_admin):
    token, _ = make_pair(ict_admin)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    school = School.objects.create(name='Unused School', code='UNUSED')
    department = Department.objects.create(
        name='Unused Department',
        code='UNUSED',
        school=school,
    )

    response = client.delete(f'/api/academics/departments/{department.id}/', **headers)
    assert response.status_code == 200
    response = client.delete(f'/api/academics/schools/{school.id}/', **headers)
    assert response.status_code == 200

def test_ict_admin_can_manage_units_and_teaching_assignments(client, ict_admin, dept, course):
    token, _ = make_pair(ict_admin)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    lecturers = [
        User.objects.create_user(
            email=f'lecturer{index}@test.com',
            username=f'lecturer{index}',
            password='pass',
            first_name='Lecturer',
            last_name=str(index),
            role='lecturer',
        )
        for index in (1, 2)
    ]

    response = client.post(
        '/api/academics/units/',
        data={
            'code': 'CS201',
            'title': 'Systems',
            'department_ids': [dept.id],
            'course_ids': [course.id],
        },
        content_type='application/json',
        **headers,
    )
    assert response.status_code == 201
    unit_id = response.json()['id']
    assert response.json()['department_ids'] == [dept.id]
    assert response.json()['course_ids'] == [course.id]
    additional_course = Course.objects.create(
        code='CS102',
        title='Systems Programming',
        department=dept,
    )

    response = client.patch(
        f'/api/academics/units/{unit_id}/',
        data={
            'title': 'Computer Systems',
            'department_ids': [dept.id],
            'course_ids': [additional_course.id],
        },
        content_type='application/json',
        **headers,
    )
    assert response.status_code == 200
    assert response.json()['title'] == 'Computer Systems'
    assert response.json()['course_ids'] == [additional_course.id]

    response = client.post(
        f'/api/academics/units/{unit_id}/teaching-assignments/',
        data={'course_id': additional_course.id, 'lecturer_ids': [lecturer.id for lecturer in lecturers]},
        content_type='application/json',
        **headers,
    )
    assert response.status_code == 200
    offering = Offering.objects.get(unit_id=unit_id, course=additional_course)
    assert set(offering.teaching_assignments.values_list('lecturer_id', flat=True)) == {
        lecturer.id for lecturer in lecturers
    }

    response = client.post(
        f'/api/academics/units/{unit_id}/teaching-assignments/',
        data={'course_id': additional_course.id, 'lecturer_ids': []},
        content_type='application/json',
        **headers,
    )
    assert response.status_code == 200
    assert not UnitTeachingAssignment.objects.filter(offering=offering).exists()

    response = client.delete(f'/api/academics/units/{unit_id}/', **headers)
    assert response.status_code == 200
    unit = Unit.objects.get(pk=unit_id)
    assert unit.is_active is False
    assert unit.offerings.filter(pk=offering.pk).exists()

    response = client.patch(
        f'/api/academics/units/{unit_id}/',
        data={'is_active': True},
        content_type='application/json',
        **headers,
    )
    assert response.status_code == 200
    assert response.json()['is_active'] is True

def test_non_academic_role_cannot_manage_school(client, student):
    token, _ = make_pair(student)
    response = client.post(
        '/api/academics/schools/',
        data={'name': 'Engineering', 'code': 'ENG'},
        content_type='application/json',
        HTTP_AUTHORIZATION=f'Bearer {token}',
    )
    assert response.status_code == 403
