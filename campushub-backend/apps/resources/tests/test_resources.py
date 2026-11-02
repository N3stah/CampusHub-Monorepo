import pytest
from apps.accounts.models import User
from apps.academics.models import Department, Course, Unit, Offering, UnitTeachingAssignment, Enrollment
from apps.accounts.jwt_utils import make_pair
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from datetime import timedelta

pytestmark = pytest.mark.django_db

@pytest.fixture
def setup_data(db):
    admin = User.objects.create_user(email='admin@test.com', username='admin', password='pass', first_name='A', last_name='B', role='admin')
    lecturer = User.objects.create_user(email='lec@test.com', username='lec', password='pass', first_name='L', last_name='M', role='lecturer')
    student = User.objects.create_user(email='student@test.com', username='student', password='pass', first_name='S', last_name='N', role='student')
    dept = Department.objects.create(name='CS', code='CS')
    course = Course.objects.create(code='CS101', title='Intro', department=dept)
    unit = Unit.objects.create(code='CS101U', title='Unit')
    offering = Offering.objects.create(unit=unit, course=course)
    UnitTeachingAssignment.objects.create(offering=offering, lecturer=lecturer)
    Enrollment.objects.create(student=student, course=course, status='active')
    return {'admin': admin, 'lecturer': lecturer, 'student': student, 'offering': offering, 'course': course}


def test_announcement_crud(client, setup_data):
    admin_token, _ = make_pair(setup_data['admin'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {admin_token}'}
    cid = setup_data['course'].id
    resp = client.post(f'/api/resources/courses/{cid}/announcements/',
        data={'title': 'Test', 'body': 'Hello'}, content_type='application/json', **headers)
    assert resp.status_code == 201
    aid = resp.json()['id']
    resp = client.get(f'/api/resources/courses/{cid}/announcements/', **headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
    resp = client.get(f'/api/resources/courses/{cid}/announcements/{aid}/', **headers)
    assert resp.status_code == 200
    assert resp.json()['title'] == 'Test'
    resp = client.patch(f'/api/resources/courses/{cid}/announcements/{aid}/',
        data={'title': 'Updated'}, content_type='application/json', **headers)
    assert resp.status_code == 200
    assert resp.json()['title'] == 'Updated'
    resp = client.delete(f'/api/resources/courses/{cid}/announcements/{aid}/', **headers)
    assert resp.status_code == 200


def test_announcement_scheduled_hidden_from_students(client, setup_data):
    admin_token, _ = make_pair(setup_data['admin'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {admin_token}'}
    cid = setup_data['course'].id
    future = (timezone.now() + timedelta(days=1)).isoformat()
    resp = client.post(f'/api/resources/courses/{cid}/announcements/',
        data={'title': 'Scheduled', 'body': 'Future', 'scheduled_for': future},
        content_type='application/json', **headers)
    assert resp.status_code == 201
    assert resp.json()['scheduled_for'] is not None
    assert resp.json()['dispatched_at'] is None
    stu_token, _ = make_pair(setup_data['student'])
    stu_headers = {'HTTP_AUTHORIZATION': f'Bearer {stu_token}'}
    resp = client.get(f'/api/resources/courses/{cid}/announcements/', **stu_headers)
    assert resp.status_code == 200
    titles = [a['title'] for a in resp.json()]
    assert 'Scheduled' not in titles


def test_announcement_student_cannot_post(client, setup_data):
    stu_token, _ = make_pair(setup_data['student'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {stu_token}'}
    cid = setup_data['course'].id
    resp = client.post(f'/api/resources/courses/{cid}/announcements/',
        data={'title': 'X', 'body': 'Y'}, content_type='application/json', **headers)
    assert resp.status_code == 403


def test_resource_upload_and_list(client, setup_data):
    admin_token, _ = make_pair(setup_data['admin'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {admin_token}'}
    cid = setup_data['course'].id
    fake = SimpleUploadedFile('test.pdf', b'content', content_type='application/pdf')
    resp = client.post(f'/api/resources/courses/{cid}/resources/',
        data={'title': 'Doc', 'description': 'A file', 'file': fake}, **headers)
    assert resp.status_code in [201, 200]
    resp = client.get(f'/api/resources/courses/{cid}/resources/', **headers)
    assert resp.status_code == 200


def test_offering_announcement_create(client, setup_data):
    lec_token, _ = make_pair(setup_data['lecturer'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {lec_token}'}
    oid = setup_data['offering'].id
    resp = client.post(f'/api/resources/offerings/{oid}/announcements/',
        data={'title': 'Offering Ann', 'body': 'Test'}, content_type='application/json', **headers)
    assert resp.status_code == 201
    resp = client.get(f'/api/resources/offerings/{oid}/announcements/', **headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
