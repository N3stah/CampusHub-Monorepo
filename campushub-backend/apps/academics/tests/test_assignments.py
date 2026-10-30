import pytest
from django.test import Client
from apps.accounts.models import User
from apps.academics.models import Department, Course, Unit, Offering, UnitTeachingAssignment, Assignment, AssignmentQuestion, AssignmentSubmission, Enrollment
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

def test_assignment_create_and_quiz_submit(client, setup_data):
    lec_token, _ = make_pair(setup_data['lecturer'])
    lec_headers = {'HTTP_AUTHORIZATION': f'Bearer {lec_token}'}
    
    # Create quiz assignment
    response = client.post(
        f'/api/academics/offerings/{setup_data["offering"].id}/assignments/',
        data={
            'title': 'Quiz 1', 'assignment_type': 'quiz', 'due_at': (timezone.now() + timedelta(days=7)).isoformat(),
            'max_points': 10, 'is_published': True,
            'questions': [
                {'prompt': 'What is 2+2?', 'options': ['3', '4', '5'], 'correct_option': 1}
            ]
        },
        content_type='application/json',
        **lec_headers
    )
    assert response.status_code == 201
    assignment_id = response.json()['id']
    
    # Student submits quiz
    stu_token, _ = make_pair(setup_data['student'])
    stu_headers = {'HTTP_AUTHORIZATION': f'Bearer {stu_token}'}
    response = client.post(
        f'/api/academics/assignments/{assignment_id}/submission/',
        data={'answers': {str(AssignmentQuestion.objects.first().id): 1}},
        content_type='application/json',
        **stu_headers
    )
    assert response.status_code == 201
    assert float(response.json()['score']) == 10.0  # Auto-marked correct

def test_file_assignment_and_grade(client, setup_data):
    import io
    from django.core.files.uploadedfile import SimpleUploadedFile
    
    lec_token, _ = make_pair(setup_data['lecturer'])
    lec_headers = {'HTTP_AUTHORIZATION': f'Bearer {lec_token}'}
    
    # Create file assignment
    response = client.post(
        f'/api/academics/offerings/{setup_data["offering"].id}/assignments/',
        data={
            'title': 'Essay 1', 'assignment_type': 'file', 'due_at': (timezone.now() + timedelta(days=7)).isoformat(),
            'max_points': 20, 'is_published': True, 'allowed_file_types': ['pdf']
        },
        content_type='application/json',
        **lec_headers
    )
    assert response.status_code == 201
    assignment_id = response.json()['id']
    
    # Student submits file
    stu_token, _ = make_pair(setup_data['student'])
    stu_headers = {'HTTP_AUTHORIZATION': f'Bearer {stu_token}'}
    fake_file = SimpleUploadedFile('test.pdf', b'file_content', content_type='application/pdf')
    response = client.post(
        f'/api/academics/assignments/{assignment_id}/submission/',
        data={'file': fake_file},
        **stu_headers
    )
    assert response.status_code == 201
    submission_id = response.json()['id']
    
    # Lecturer grades submission
    response = client.patch(
        f'/api/academics/submissions/{submission_id}/grade/',
        data={'score': '15.50', 'feedback': 'Good effort'},
        content_type='application/json',
        **lec_headers
    )
    assert response.status_code == 200
    assert response.json()['score'] == '15.50'
