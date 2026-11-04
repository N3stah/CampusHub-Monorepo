import pytest
from django.test import Client
from apps.accounts.models import User
from apps.academics.models import Department, Course, Unit, Offering, UnitTeachingAssignment, Enrollment
from apps.accounts.jwt_utils import make_pair

pytestmark = pytest.mark.django_db

@pytest.fixture
def setup_data(db):
    lecturer = User.objects.create_user(email='lec@test.com', username='lec', password='pass', first_name='L', last_name='M', role='lecturer')
    students = []
    for i in range(6):
        s = User.objects.create_user(email=f's{i}@test.com', username=f's{i}', password='pass', first_name=f'S{i}', last_name='N', role='student', admission_number=f'ADM{i}')
        students.append(s)
    
    dept = Department.objects.create(name='CS', code='CS')
    course = Course.objects.create(code='CS101', title='Intro', department=dept)
    unit = Unit.objects.create(code='CS101U', title='Unit')
    offering = Offering.objects.create(unit=unit, course=course)
    UnitTeachingAssignment.objects.create(offering=offering, lecturer=lecturer)
    
    for s in students:
        Enrollment.objects.create(student=s, course=course, status='active')
    
    return {'lecturer': lecturer, 'students': students, 'offering': offering}

def test_create_and_view_groups(client, setup_data):
    lec_token, _ = make_pair(setup_data['lecturer'])
    lec_headers = {'HTTP_AUTHORIZATION': f'Bearer {lec_token}'}
    
    # Create groups (6 students, 3 per group = 2 groups)
    response = client.post(
        f'/api/academics/offerings/{setup_data["offering"].id}/groups/',
        data={'naming_scheme': 'letters', 'students_per_group': 3},
        content_type='application/json',
        **lec_headers
    )
    assert response.status_code == 201
    assert response.json()['count'] == 2
    assert response.json()['results'][0]['name'] == 'A'
    
    # Lecturer views all groups
    response = client.get(f'/api/academics/offerings/{setup_data["offering"].id}/groups/', **lec_headers)
    assert response.status_code == 200
    assert response.json()['count'] == 2
    
    # Student views only their own group
    stu_token, _ = make_pair(setup_data['students'][0])
    stu_headers = {'HTTP_AUTHORIZATION': f'Bearer {stu_token}'}
    response = client.get(f'/api/academics/offerings/{setup_data["offering"].id}/groups/', **stu_headers)
    assert response.status_code == 200
    assert response.json()['count'] == 1
