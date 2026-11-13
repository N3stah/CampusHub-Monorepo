import pytest

from apps.accounts.jwt_utils import make_pair
from apps.accounts.models import User
from apps.academics.models import (
    Assignment,
    Course,
    Department,
    Enrollment,
    Offering,
    Unit,
    UnitTeachingAssignment,
)
from django.utils import timezone
from datetime import timedelta

pytestmark = pytest.mark.django_db


@pytest.fixture
def unit_setup(db, active_period, register_unit):
    department = Department.objects.create(name='Computing', code='COMP')
    first_course = Course.objects.create(code='BIT', title='Information Technology', department=department)
    second_course = Course.objects.create(code='CSC', title='Computer Science', department=department)
    unit = Unit.objects.create(code='CS101', title='Programming')
    first_offering = Offering.objects.create(unit=unit, course=first_course)
    second_offering = Offering.objects.create(unit=unit, course=second_course)
    student = User.objects.create_user(
        email='student@test.com',
        username='student',
        password='pass',
        first_name='Student',
        last_name='One',
        role='student',
    )
    Enrollment.objects.create(student=student, course=first_course, status='active')
    register_unit(student, unit)
    lecturer = User.objects.create_user(
        email='lecturer@test.com',
        username='lecturer',
        password='pass',
        first_name='Lecturer',
        last_name='One',
        role='lecturer',
    )
    UnitTeachingAssignment.objects.create(offering=first_offering, lecturer=lecturer)
    UnitTeachingAssignment.objects.create(offering=second_offering, lecturer=lecturer)
    registrar = User.objects.create_user(
        email='registrar@test.com',
        username='registrar',
        password='pass',
        first_name='Registrar',
        last_name='One',
        role='registrar',
    )
    return {
        'active_period': active_period,
        'first_course': first_course,
        'first_offering': first_offering,
        'second_offering': second_offering,
        'student': student,
        'unit': unit,
        'lecturer': lecturer,
        'registrar': registrar,
    }


def _headers(user):
    token, _ = make_pair(user)
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}


def test_registered_student_sees_unit_assignment_from_another_program(client, unit_setup):
    assignment = Assignment.objects.create(
        offering=unit_setup['second_offering'],
        title='Shared assignment',
        assignment_type='file',
        due_at=timezone.now() + timedelta(days=7),
        max_points=10,
        is_published=True,
    )
    response = client.get(
        f'/api/academics/offerings/{unit_setup["first_offering"].id}/assignments/',
        **_headers(unit_setup['student']),
    )
    assert response.status_code == 200
    assert assignment.id in {row['id'] for row in response.json()['results']}


def test_programme_enrollment_without_unit_registration_is_denied(client, unit_setup):
    unregistered = User.objects.create_user(
        email='unregistered@test.com',
        username='unregistered',
        password='pass',
        first_name='Unregistered',
        last_name='Student',
        role='student',
    )
    Enrollment.objects.create(
        student=unregistered,
        course=unit_setup['first_course'],
        status='active',
    )
    response = client.get(
        f'/api/academics/offerings/{unit_setup["first_offering"].id}/assignments/',
        **_headers(unregistered),
    )
    assert response.status_code == 403


def test_registrar_assigns_units_and_students_cannot_self_register(client, unit_setup):
    unregistered = User.objects.create_user(
        email='new-student@test.com',
        username='new-student',
        password='pass',
        first_name='New',
        last_name='Student',
        role='student',
    )
    Enrollment.objects.create(
        student=unregistered,
        course=unit_setup['first_course'],
        status='active',
    )
    registration_data = {
        'student_id': unregistered.id,
        'academic_period_id': unit_setup['active_period'].id,
        'unit_id': unit_setup['unit'].id,
        'registered_on': unit_setup['active_period'].start_date.isoformat(),
    }
    denied = client.post(
        '/api/academics/registrations/',
        data=registration_data,
        content_type='application/json',
        **_headers(unregistered),
    )
    assert denied.status_code == 403

    assigned = client.post(
        '/api/academics/registrations/',
        data=registration_data,
        content_type='application/json',
        **_headers(unit_setup['registrar']),
    )
    assert assigned.status_code == 201
    assert assigned.json()['unit_id'] == unit_setup['unit'].id
    assert assigned.json()['academic_period_status'] == 'active'
