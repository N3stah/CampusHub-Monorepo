from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.jwt_utils import make_pair
from apps.placements.models import Application, Placement

User = get_user_model()
pytestmark = pytest.mark.django_db


def make_user(email, username, role):
    return User.objects.create_user(
        email=email,
        username=username,
        first_name='Test',
        last_name='User',
        password='T0ugh-Campus-Password!82',
        role=role,
    )


def auth_header(user):
    access, _ = make_pair(user)
    return {'HTTP_AUTHORIZATION': f'Bearer {access}'}


def placement_data(**overrides):
    data = {
        'title': 'Software Intern',
        'company': 'Campus Systems',
        'location': 'Nairobi',
        'description': 'Build campus tools.',
        'requirements': 'Python and web development experience.',
        'deadline': (date.today() + timedelta(days=30)).isoformat(),
        'slots_available': 2,
    }
    data.update(overrides)
    return data


def test_officer_can_create_update_and_deactivate_placement(client):
    officer = make_user('officer@example.test', 'officer-one', 'officer')
    created = client.post(
        '/api/placements/',
        data=placement_data(),
        content_type='application/json',
        **auth_header(officer),
    )
    assert created.status_code == 201
    placement_id = created.json()['id']

    updated = client.patch(
        f'/api/placements/{placement_id}/',
        data={'slots_available': 3},
        content_type='application/json',
        **auth_header(officer),
    )
    assert updated.status_code == 200
    assert updated.json()['slots_available'] == 3

    deleted = client.delete(f'/api/placements/{placement_id}/', **auth_header(officer))
    assert deleted.status_code == 200
    assert not Placement.objects.get(pk=placement_id).is_active


def test_students_cannot_manage_placements(client):
    student = make_user('student@example.test', 'student-one', 'student')
    response = client.post(
        '/api/placements/',
        data=placement_data(),
        content_type='application/json',
        **auth_header(student),
    )
    assert response.status_code == 403


def test_student_can_apply_with_multipart_form_and_see_application(client):
    student = make_user('student@example.test', 'student-one', 'student')
    officer = make_user('officer@example.test', 'officer-one', 'officer')
    placement = Placement.objects.create(
        posted_by=officer,
        deadline=date.today() + timedelta(days=30),
        **{key: value for key, value in placement_data().items() if key != 'deadline'},
    )

    submitted = client.post(
        f'/api/placements/{placement.id}/apply/',
        data={'cover_note': 'I would like to apply.'},
        **auth_header(student),
    )
    assert submitted.status_code == 201
    assert submitted.json()['student']['first_name'] == student.first_name

    listed = client.get('/api/applications/', **auth_header(student))
    assert listed.status_code == 200
    assert listed.json()['count'] == 1
    assert Application.objects.filter(student=student, placement=placement).exists()


def test_student_can_apply_with_valid_pdf_cv(client):
    student = make_user('cv-student@example.test', 'cv-student', 'student')
    officer = make_user('cv-officer@example.test', 'cv-officer', 'officer')
    placement = Placement.objects.create(
        posted_by=officer,
        deadline=date.today() + timedelta(days=30),
        **{key: value for key, value in placement_data().items() if key != 'deadline'},
    )

    response = client.post(
        f'/api/placements/{placement.id}/apply/',
        data={
            'cover_note': 'Please consider my application.',
            'cv_file': SimpleUploadedFile('resume.pdf', b'%PDF-1.4 sample', content_type='application/pdf'),
        },
        **auth_header(student),
    )

    assert response.status_code == 201
    assert Application.objects.get(student=student, placement=placement).cv_file.name.endswith('.pdf')


@pytest.mark.parametrize('filename', ['resume.txt', 'resume'])
def test_student_cannot_apply_with_unsupported_cv_type(client, filename):
    student = make_user('cv-student@example.test', 'cv-student', 'student')
    officer = make_user('cv-officer@example.test', 'cv-officer', 'officer')
    placement = Placement.objects.create(
        posted_by=officer,
        deadline=date.today() + timedelta(days=30),
        **{key: value for key, value in placement_data().items() if key != 'deadline'},
    )

    response = client.post(
        f'/api/placements/{placement.id}/apply/',
        data={
            'cover_note': 'Please consider my application.',
            'cv_file': SimpleUploadedFile(filename, b'not a CV'),
        },
        **auth_header(student),
    )

    assert response.status_code == 400
    assert 'CV type not allowed' in response.json()['error']


def test_student_cannot_apply_with_cv_over_10mb(client):
    student = make_user('cv-student@example.test', 'cv-student', 'student')
    officer = make_user('cv-officer@example.test', 'cv-officer', 'officer')
    placement = Placement.objects.create(
        posted_by=officer,
        deadline=date.today() + timedelta(days=30),
        **{key: value for key, value in placement_data().items() if key != 'deadline'},
    )

    response = client.post(
        f'/api/placements/{placement.id}/apply/',
        data={
            'cover_note': 'Please consider my application.',
            'cv_file': SimpleUploadedFile('large.pdf', b'x' * (10 * 1024 * 1024 + 1)),
        },
        **auth_header(student),
    )

    assert response.status_code == 400
    assert '10MB' in response.json()['error']


def test_officer_can_review_only_applications_for_their_placements(client):
    student = make_user('student@example.test', 'student-one', 'student')
    officer = make_user('officer@example.test', 'officer-one', 'officer')
    another_officer = make_user('another@example.test', 'officer-two', 'officer')
    placement = Placement.objects.create(
        posted_by=officer,
        deadline=date.today() + timedelta(days=30),
        **{key: value for key, value in placement_data().items() if key != 'deadline'},
    )
    application = Application.objects.create(
        student=student,
        placement=placement,
        cover_note='Please consider my application.',
    )

    updated = client.patch(
        f'/api/applications/{application.id}/status/',
        data={'status': 'shortlisted'},
        content_type='application/json',
        **auth_header(officer),
    )
    assert updated.status_code == 200
    assert updated.json()['status'] == 'shortlisted'

    denied = client.patch(
        f'/api/applications/{application.id}/status/',
        data={'status': 'accepted'},
        content_type='application/json',
        **auth_header(another_officer),
    )
    assert denied.status_code == 403
