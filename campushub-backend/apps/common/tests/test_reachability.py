import pytest
from django.test import Client
from apps.accounts.models import User
from apps.accounts.jwt_utils import make_pair

@pytest.mark.django_db
def test_all_api_routes_are_reachable():
    """
    Ensure that all main API prefixes are mounted and do not return 404.
    This prevents regressions where an include() is accidentally dropped from config/urls.py.
    """
    admin = User.objects.create_user(
        email='admin@test.com', username='admin', password='pass',
        first_name='Admin', last_name='User', role='admin'
    )
    access_token, _ = make_pair(admin)
    client = Client()
    headers = {'HTTP_AUTHORIZATION': f'Bearer {access_token}'}
    
    endpoints = [
        '/api/auth/me/',
        '/api/users/',
        '/api/academics/departments/',
        '/api/placements/',
        '/api/notifications/',
    ]
    
    for url in endpoints:
        response = client.get(url, **headers)
        assert response.status_code != 404, f"Endpoint {url} returned 404 - check config/urls.py"
