import pytest
from django.test import Client
from apps.accounts.models import User
from apps.accounts.jwt_utils import make_pair

@pytest.mark.django_db
def test_all_api_routes_are_reachable():
    admin = User.objects.create_user(
        email='admin@test.com', username='admin', password='pass',
        first_name='Admin', last_name='User', role='admin'
    )
    access_token, _ = make_pair(admin)
    client = Client()
    headers = {'HTTP_AUTHORIZATION': f'Bearer {access_token}'}
    
    endpoints = [
        '/api/health/',
        '/api/auth/me/',
        '/api/users/',
        '/api/academics/schools/',
        '/api/academics/units/',
        '/api/academics/assignments/',
        '/api/academics/calendar/',
        '/api/academics/departments/',
        '/api/academics/admin/enrollments/',
        '/api/academics/courses/assign-lecturer/',
        '/api/placements/',
        '/api/notifications/',
    ]
    
    for url in endpoints:
        response = client.get(url, **headers)
        assert response.status_code != 404, f"Endpoint {url} returned 404 - check config/urls.py"


@pytest.mark.django_db
def test_at_risk_endpoint_reachable():
    """Verify the at-risk endpoint URL is registered (not a Django-level 404)."""
    from apps.academics.models import Department, Course, Unit, Offering
    admin = User.objects.create_user(
        email='admin_r@test.com', username='admin_r', password='pass',
        first_name='Admin', last_name='User', role='admin'
    )
    dept = Department.objects.create(name='CS', code='CSR')
    course = Course.objects.create(code='CS101R', title='Intro', department=dept)
    unit = Unit.objects.create(code='CSUR', title='Unit')
    offering = Offering.objects.create(unit=unit, course=course)
    access_token, _ = make_pair(admin)
    client = Client()
    headers = {'HTTP_AUTHORIZATION': f'Bearer {access_token}'}
    response = client.get(f'/api/academics/offerings/{offering.id}/at-risk/', **headers)
    assert response.status_code != 404, "at-risk endpoint returned 404 - check urls.py"
