import pytest
from django.test import Client
from apps.accounts.models import User
from apps.academics.models import Department, Course, Unit, Offering, UnitTeachingAssignment, Assignment, AssignmentQuestion, AssignmentSubmission, Enrollment
from apps.accounts.jwt_utils import make_pair
from django.utils import timezone
from datetime import timedelta

pytestmark = pytest.mark.django_db

@pytest.fixture
def setup_data(db, active_period, register_unit):
    admin = User.objects.create_user(email='admin@test.com', username='admin', password='pass', first_name='A', last_name='B', role='admin')
    lecturer = User.objects.create_user(email='lec@test.com', username='lec', password='pass', first_name='L', last_name='M', role='lecturer')
    student = User.objects.create_user(email='student@test.com', username='student', password='pass', first_name='S', last_name='N', role='student')
    
    dept = Department.objects.create(name='CS', code='CS')
    course = Course.objects.create(code='CS101', title='Intro', department=dept)
    unit = Unit.objects.create(code='CS101U', title='Unit')
    offering = Offering.objects.create(unit=unit, course=course)
    UnitTeachingAssignment.objects.create(offering=offering, lecturer=lecturer)
    Enrollment.objects.create(student=student, course=course, status='active')
    register_unit(student, unit)
    
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
    assert response.json()['submission']['score'] == 10.0  # Auto-marked correct

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
    submission_data = response.json()['submission']
    assert submission_data['file_name'].startswith('test')
    assert submission_data['assignment_id'] == assignment_id
    submission_id = submission_data['id']
    
    # Lecturer grades submission
    response = client.patch(
        f'/api/academics/submissions/{submission_id}/grade/',
        data={'score': '15.50', 'feedback': 'Good effort'},
        content_type='application/json',
        **lec_headers
    )
    assert response.status_code == 200
    assert response.json()['submission']['score'] == 15.5
    assert response.json()['submission']['feedback'] == 'Good effort'


def test_submission_requires_published_assignment_and_active_enrollment(client, setup_data):
    student = setup_data['student']
    token, _ = make_pair(student)
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    assignment = Assignment.objects.create(
        offering=setup_data['offering'],
        title='Draft quiz',
        assignment_type='quiz',
        due_at=timezone.now() + timedelta(days=2),
        max_points=5,
        is_published=False,
    )
    get_draft = client.get(f'/api/academics/assignments/{assignment.id}/submission/', **headers)
    post_draft = client.post(
        f'/api/academics/assignments/{assignment.id}/submission/',
        data={'answers': {}}, content_type='application/json', **headers,
    )
    assert get_draft.status_code == 403
    assert post_draft.status_code == 403

    assignment.is_published = True
    assignment.save(update_fields=['is_published'])
    Enrollment.objects.filter(student=student, course=setup_data['offering'].course).update(status='dropped')
    get_unenrolled = client.get(f'/api/academics/assignments/{assignment.id}/submission/', **headers)
    post_unenrolled = client.post(
        f'/api/academics/assignments/{assignment.id}/submission/',
        data={'answers': {}}, content_type='application/json', **headers,
    )
    assert get_unenrolled.status_code == 403
    assert post_unenrolled.status_code == 403


def test_lecturer_can_review_submissions_for_unpublished_assignment(client, setup_data):
    assignment = Assignment.objects.create(
        offering=setup_data['offering'],
        title='Unpublished file assignment',
        assignment_type='file',
        due_at=timezone.now() + timedelta(days=2),
        max_points=5,
        is_published=False,
    )
    token, _ = make_pair(setup_data['lecturer'])
    response = client.get(
        f'/api/academics/assignments/{assignment.id}/submissions/',
        HTTP_AUTHORIZATION=f'Bearer {token}',
    )
    assert response.status_code == 200
    assert response.json() == {'count': 0, 'results': []}


def test_submission_resubmission_replaces_file_resets_grade_and_denies_non_owner(client, setup_data):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart

    assignment = Assignment.objects.create(
        offering=setup_data['offering'],
        title='Essay',
        assignment_type='file',
        due_at=timezone.now() + timedelta(days=2),
        max_points=5,
        allowed_file_types=['pdf'],
        is_published=True,
    )
    student_token, _ = make_pair(setup_data['student'])
    student_headers = {'HTTP_AUTHORIZATION': f'Bearer {student_token}'}
    created = client.post(
        f'/api/academics/assignments/{assignment.id}/submission/',
        data={'file': SimpleUploadedFile('first.pdf', b'first')},
        **student_headers,
    )
    assert created.status_code == 201
    initial = created.json()['submission']
    assert initial['file_name'].startswith('first')
    submission = AssignmentSubmission.objects.get(pk=initial['id'])
    submission.score = 4
    submission.feedback = 'Revise'
    submission.graded_at = timezone.now()
    submission.released_at = timezone.now()
    submission.save()

    updated = client.generic(
        'PATCH',
        f'/api/academics/assignments/{assignment.id}/submission/',
        data=encode_multipart(BOUNDARY, {'file': SimpleUploadedFile('replacement.pdf', b'replacement')}),
        content_type=MULTIPART_CONTENT,
        **student_headers,
    )
    assert updated.status_code == 200, updated.json()
    result = updated.json()['submission']
    assert result['file_name'].startswith('replacement')
    assert result['score'] is None
    assert result['feedback'] == ''
    assert result['graded_at'] is None
    assert result['released_at'] is None

    other_student = User.objects.create_user(
        email='other@test.com', username='other', password='pass',
        first_name='Other', last_name='Student', role='student',
    )
    Enrollment.objects.create(
        student=other_student,
        course=setup_data['offering'].course,
        status='active',
    )
    other_token, _ = make_pair(other_student)
    denied = client.generic(
        'PATCH',
        f'/api/academics/assignments/{assignment.id}/submission/',
        data=encode_multipart(BOUNDARY, {'file': SimpleUploadedFile('other.pdf', b'other')}),
        content_type=MULTIPART_CONTENT,
        HTTP_AUTHORIZATION=f'Bearer {other_token}',
    )
    assert denied.status_code == 403


def test_quiz_resubmission_updates_answers_and_resets_auto_grade(client, setup_data):
    assignment = Assignment.objects.create(
        offering=setup_data['offering'],
        title='Quiz resubmission',
        assignment_type='quiz',
        due_at=timezone.now() + timedelta(days=2),
        max_points=5,
        is_published=True,
    )
    question = AssignmentQuestion.objects.create(
        assignment=assignment, prompt='2 + 2?', options=['3', '4'], correct_option=1,
    )
    token, _ = make_pair(setup_data['student'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    endpoint = f'/api/academics/assignments/{assignment.id}/submission/'
    created = client.post(
        endpoint,
        data={'answers': {str(question.id): 1}},
        content_type='application/json',
        **headers,
    )
    assert created.status_code == 201
    assert created.json()['submission']['score'] == 5.0

    updated = client.patch(
        endpoint,
        data={'answers': {str(question.id): 0}},
        content_type='application/json',
        **headers,
    )
    assert updated.status_code == 200
    assert updated.json()['submission']['answers'] == {str(question.id): 0}
    assert updated.json()['submission']['score'] is None
    assert updated.json()['submission']['graded_at'] is None
    assert updated.json()['submission']['released_at'] is None


def test_quiz_zero_score_is_serialized_as_zero(client, setup_data):
    assignment = Assignment.objects.create(
        offering=setup_data['offering'],
        title='Quiz zero',
        assignment_type='quiz',
        due_at=timezone.now() + timedelta(days=2),
        max_points=5,
        is_published=True,
    )
    question = AssignmentQuestion.objects.create(
        assignment=assignment, prompt='1 + 1?', options=['1', '2'], correct_option=1,
    )
    token, _ = make_pair(setup_data['student'])
    response = client.post(
        f'/api/academics/assignments/{assignment.id}/submission/',
        data={'answers': {str(question.id): 0}},
        content_type='application/json',
        HTTP_AUTHORIZATION=f'Bearer {token}',
    )
    assert response.status_code == 201
    assert response.json()['submission']['score'] == 0.0


def test_assignment_attachment_size_validation_on_create_and_update(client, setup_data):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart

    token, _ = make_pair(setup_data['lecturer'])
    headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    endpoint = f'/api/academics/offerings/{setup_data["offering"].id}/assignments/'
    payload = {
        'title': 'Large attachment',
        'assignment_type': 'file',
        'due_at': (timezone.now() + timedelta(days=7)).isoformat(),
        'max_points': 10,
        'is_published': False,
        'allowed_file_types': [],
        'questions': [],
    }
    large_file = SimpleUploadedFile('large.pdf', b'x' * (10 * 1024 * 1024 + 1))
    rejected_create = client.post(endpoint, data={**payload, 'attachment': large_file}, **headers)
    assert rejected_create.status_code == 400
    assert '10MB' in rejected_create.json()['error']

    created = client.post(endpoint, data=payload, content_type='application/json', **headers)
    assert created.status_code == 201
    large_replacement = SimpleUploadedFile('large.pdf', b'x' * (10 * 1024 * 1024 + 1))
    rejected_update = client.generic(
        'PATCH',
        f'/api/academics/assignments/{created.json()["id"]}/',
        data=encode_multipart(BOUNDARY, {'attachment': large_replacement}),
        content_type=MULTIPART_CONTENT,
        **headers,
    )
    assert rejected_update.status_code == 400


def test_file_assignment_with_attachment(client, setup_data):
    import io
    from django.core.files.uploadedfile import SimpleUploadedFile

    lec_token, _ = make_pair(setup_data['lecturer'])
    lec_headers = {'HTTP_AUTHORIZATION': f'Bearer {lec_token}'}
    attachment = SimpleUploadedFile(
        'assignment.pdf', io.BytesIO(b'%PDF-1.4').read(),
        content_type='application/pdf',
    )
    response = client.post(
        f'/api/academics/offerings/{setup_data["offering"].id}/assignments/',
        data={
            'title': 'Attached Assignment',
            'instructions': 'Complete the attached work',
            'assignment_type': 'file',
            'allowed_file_types': '["pdf"]',
            'questions': '[]',
            'due_at': (timezone.now() + timedelta(days=7)).isoformat(),
            'max_points': '20',
            'is_published': 'true',
            'attachment': attachment,
        },
        **lec_headers
    )
    assert response.status_code == 201
    assert response.json()['is_published'] is True
    assignment_id = response.json()['id']
    assert response.json()['attachment_name'].startswith('assignment')
    assert response.json()['attachment_name'].endswith('.pdf')
    assert response.json()['attachment_url'] == f'/api/academics/assignments/{assignment_id}/attachment/'

    # Download attachment
    dl_resp = client.get(f'/api/academics/assignments/{assignment_id}/attachment/', **lec_headers)
    assert dl_resp.status_code == 200
    assert b'%PDF-1.4' in dl_resp.getvalue()

    # Get assignment detail
    detail_resp = client.get(f'/api/academics/assignments/{assignment_id}/', **lec_headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()['title'] == 'Attached Assignment'

    # Patch assignment
    patch_resp = client.patch(
        f'/api/academics/assignments/{assignment_id}/',
        data={'title': 'Updated Title', 'max_points': 25},
        content_type='application/json',
        **lec_headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()['title'] == 'Updated Title'
    assert patch_resp.json()['max_points'] == 25

    # Delete assignment
    del_resp = client.delete(f'/api/academics/assignments/{assignment_id}/', **lec_headers)
    assert del_resp.status_code == 200


def test_assignment_create_json_without_attachment(client, setup_data):
    lec_token, _ = make_pair(setup_data['lecturer'])
    lec_headers = {'HTTP_AUTHORIZATION': f'Bearer {lec_token}'}
    response = client.post(
        f'/api/academics/offerings/{setup_data["offering"].id}/assignments/',
        data={
            'title': 'No Attachment Assignment',
            'instructions': 'Just instructions',
            'assignment_type': 'file',
            'allowed_file_types': ['pdf'],
            'questions': [],
            'due_at': (timezone.now() + timedelta(days=7)).isoformat(),
            'max_points': 100,
            'is_published': True,
        },
        content_type='application/json',
        **lec_headers
    )
    assert response.status_code == 201
    assert response.json()['attachment_name'] is None
    assert response.json()['attachment_url'] is None
