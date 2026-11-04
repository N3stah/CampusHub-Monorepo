import pytest
import json
from apps.accounts.models import User
from apps.academics.models import Department, Course, Enrollment
from apps.accounts.jwt_utils import make_pair

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email='admin@test.com', username='admin', password='TestPass123!',
        first_name='Admin', last_name='User', role='admin'
    )

@pytest.fixture
def dept(db):
    return Department.objects.create(name='CS', code='CS')

@pytest.fixture
def course1(db, dept):
    return Course.objects.create(code='CS101', title='Intro to CS', department=dept)

@pytest.fixture
def course2(db, dept):
    return Course.objects.create(code='CS102', title='Advanced CS', department=dept)

def _headers(user):
    token, _ = make_pair(user)
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}

def _post(client, url, data, headers):
    return client.post(url, data=json.dumps(data), content_type='application/json', **headers)

def _patch(client, url, data, headers):
    return client.patch(url, data=json.dumps(data), content_type='application/json', **headers)


# --- Create (POST) ---

def test_create_student_with_admission_and_course(client, admin_user, dept, course1):
    """POST with admission_number + course_id creates student + enrollment."""
    r = _post(client, '/api/users/', {
        'email': 'new@test.com', 'username': 'newstudent', 'password': 'TestPass123!',
        'first_name': 'New', 'last_name': 'Student', 'role': 'student',
        'admission_number': '25/9999', 'course_id': course1.id,
    }, _headers(admin_user))
    assert r.status_code == 201, r.json()
    data = r.json()
    assert data['admission_number'] == '25/9999'
    assert data['programme'] is not None
    assert data['programme']['code'] == 'CS101'
    user = User.objects.get(email='new@test.com')
    assert Enrollment.objects.filter(student=user, status='active').count() == 1
    assert user.department_id == dept.id

def test_create_duplicate_admission_number(client, admin_user, course1):
    """Duplicate admission_number -> 400."""
    User.objects.create_user(
        email='existing@test.com', username='existing', password='TestPass123!',
        first_name='Ex', last_name='ist', role='student', admission_number='25/0001'
    )
    r = _post(client, '/api/users/', {
        'email': 'new@test.com', 'username': 'newstudent', 'password': 'TestPass123!',
        'first_name': 'New', 'last_name': 'Student', 'role': 'student',
        'admission_number': '25/0001',
    }, _headers(admin_user))
    assert r.status_code == 400
    assert 'admission_number' in r.json()['error']

def test_create_invalid_course_id(client, admin_user):
    """Non-existent course_id -> 400."""
    r = _post(client, '/api/users/', {
        'email': 'new@test.com', 'username': 'newstudent', 'password': 'TestPass123!',
        'first_name': 'New', 'last_name': 'Student', 'role': 'student',
        'course_id': 99999,
    }, _headers(admin_user))
    assert r.status_code == 400
    assert 'course_id' in r.json()['error']

def test_create_course_id_on_lecturer(client, admin_user, course1):
    """course_id on a non-student role -> 400."""
    r = _post(client, '/api/users/', {
        'email': 'lec@test.com', 'username': 'lec', 'password': 'TestPass123!',
        'first_name': 'Lec', 'last_name': 'User', 'role': 'lecturer',
        'course_id': course1.id,
    }, _headers(admin_user))
    assert r.status_code == 400


# --- Update (PATCH) ---

def test_patch_change_programme(client, admin_user, course1, course2):
    """PATCH with new course_id drops old enrollment, creates new."""
    user = User.objects.create_user(
        email='student@test.com', username='student', password='TestPass123!',
        first_name='Stu', last_name='Dent', role='student', admission_number='25/0001'
    )
    Enrollment.objects.create(student=user, course=course1, status='active')
    r = _patch(client, f'/api/users/{user.id}/', {
        'course_id': course2.id,
    }, _headers(admin_user))
    assert r.status_code == 200, r.json()
    assert r.json()['programme']['code'] == 'CS102'
    assert not Enrollment.objects.filter(student=user, course=course1, status='active').exists()
    assert Enrollment.objects.filter(student=user, course=course2, status='active').exists()

def test_patch_same_programme_no_duplicate(client, admin_user, course1):
    """PATCH with same course_id does not create duplicate enrollment."""
    user = User.objects.create_user(
        email='student@test.com', username='student', password='TestPass123!',
        first_name='Stu', last_name='Dent', role='student', admission_number='25/0001'
    )
    Enrollment.objects.create(student=user, course=course1, status='active')
    r = _patch(client, f'/api/users/{user.id}/', {
        'course_id': course1.id,
    }, _headers(admin_user))
    assert r.status_code == 200
    assert Enrollment.objects.filter(student=user, status='active').count() == 1

def test_patch_admission_number_only(client, admin_user):
    """PATCH with admission_number only (no course_id) works."""
    user = User.objects.create_user(
        email='student@test.com', username='student', password='TestPass123!',
        first_name='Stu', last_name='Dent', role='student'
    )
    r = _patch(client, f'/api/users/{user.id}/', {
        'admission_number': '25/1234',
    }, _headers(admin_user))
    assert r.status_code == 200
    assert r.json()['admission_number'] == '25/1234'


# --- Response shape ---

def test_get_includes_admission_and_programme(client, admin_user, course1):
    """GET /api/users/<id>/ includes admission_number + programme."""
    user = User.objects.create_user(
        email='student@test.com', username='student', password='TestPass123!',
        first_name='Stu', last_name='Dent', role='student', admission_number='25/0001'
    )
    Enrollment.objects.create(student=user, course=course1, status='active')
    r = client.get(f'/api/users/{user.id}/', **_headers(admin_user))
    assert r.status_code == 200
    data = r.json()
    assert data['admission_number'] == '25/0001'
    assert data['programme'] is not None
    assert data['programme']['code'] == 'CS101'
