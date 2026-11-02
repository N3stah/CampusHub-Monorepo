import pytest
from apps.accounts.models import User
from apps.academics.models import Department, Course, Unit, Offering, UnitTeachingAssignment, Enrollment
from apps.notifications.models import Notification
from apps.accounts.jwt_utils import make_pair
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
    return {'admin': admin, 'lecturer': lecturer, 'student': student, 'offering': offering}


def test_assignment_published_notifies(client, setup_data):
    lec_token, _ = make_pair(setup_data['lecturer'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {lec_token}'}
    resp = client.post(f'/api/academics/offerings/{setup_data["offering"].id}/assignments/',
        data={'title': 'Pub Quiz', 'assignment_type': 'quiz', 'due_at': (timezone.now() + timedelta(days=7)).isoformat(),
              'max_points': 10, 'is_published': True,
              'questions': [{'prompt': 'Q', 'options': ['A', 'B'], 'correct_option': 0}]},
        content_type='application/json', **headers)
    assert resp.status_code == 201
    notifs = Notification.objects.filter(recipient=setup_data['student'], verb='assignment.published')
    assert notifs.count() >= 1


def test_grade_released_notifies(client, setup_data):
    from django.core.files.uploadedfile import SimpleUploadedFile
    lec_token, _ = make_pair(setup_data['lecturer'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {lec_token}'}
    resp = client.post(f'/api/academics/offerings/{setup_data["offering"].id}/assignments/',
        data={'title': 'Essay', 'assignment_type': 'file', 'due_at': (timezone.now() + timedelta(days=7)).isoformat(),
              'max_points': 20, 'is_published': True, 'allowed_file_types': ['pdf']},
        content_type='application/json', **headers)
    aid = resp.json()['id']
    stu_token, _ = make_pair(setup_data['student'])
    stu_headers = {'HTTP_AUTHORIZATION': f'Bearer {stu_token}'}
    fake = SimpleUploadedFile('test.pdf', b'content', content_type='application/pdf')
    resp = client.post(f'/api/academics/assignments/{aid}/submission/', data={'file': fake}, **stu_headers)
    sid = resp.json()['id']
    resp = client.patch(f'/api/academics/submissions/{sid}/grade/',
        data={'score': '15', 'feedback': 'Good'}, content_type='application/json', **headers)
    assert resp.status_code == 200
    notifs = Notification.objects.filter(recipient=setup_data['student'], verb='grade.released')
    assert notifs.count() >= 1


def test_groups_shuffled_notifies(client, setup_data):
    lec_token, _ = make_pair(setup_data['lecturer'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {lec_token}'}
    resp = client.post(f'/api/academics/offerings/{setup_data["offering"].id}/groups/',
        data={'naming_scheme': 'letters', 'students_per_group': 1},
        content_type='application/json', **headers)
    assert resp.status_code == 201
    notifs = Notification.objects.filter(recipient=setup_data['student'], verb='groups.shuffled')
    assert notifs.count() >= 1
