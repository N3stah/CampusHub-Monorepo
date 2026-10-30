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
        '/api/academics/departments/',
        '/api/academics/admin/enrollments/',
        '/api/academics/courses/assign-lecturer/',
        '/api/placements/',
        '/api/notifications/',
    ]
    
    for url in endpoints:
        response = client.get(url, **headers)
        assert response.status_code != 404, f"Endpoint {url} returned 404 - check config/urls.py"
