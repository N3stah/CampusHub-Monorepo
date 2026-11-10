import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from apps.accounts.jwt_utils import make_pair

User = get_user_model()

pytestmark = pytest.mark.django_db

@pytest.fixture
def user_data():
    return {
        "email": "testuser@test.com",
        "username": "testuser",
        "password": "StrongPass123!",
        "first_name": "Test",
        "last_name": "User"
    }

@pytest.fixture
def existing_user(user_data):
    return User.objects.create_user(**user_data)

def test_public_registration_is_disabled(client, user_data):
    response = client.post('/api/auth/register/', data=user_data, content_type='application/json')
    assert response.status_code == 403
    assert User.objects.count() == 0

# 6. Token — success (200, returns access + refresh)
def test_token_success(client, existing_user, user_data):
    payload = {"email": user_data['email'], "password": user_data['password']}
    response = client.post('/api/auth/token/', data=payload, content_type='application/json')
    assert response.status_code == 200
    data = response.json()
    assert 'access' in data
    assert 'refresh' in data

# 7. Token — wrong password (401)
def test_token_wrong_password(client, existing_user, user_data):
    payload = {"email": user_data['email'], "password": "WrongPass123!"}
    response = client.post('/api/auth/token/', data=payload, content_type='application/json')
    assert response.status_code == 401

# 8. Token — non-existent email (401)
def test_token_non_existent_email(client):
    payload = {"email": "nobody@test.com", "password": "Pass123!"}
    response = client.post('/api/auth/token/', data=payload, content_type='application/json')
    assert response.status_code == 401

# 9. Token — inactive user (403 or 401)
def test_token_inactive_user(client, existing_user, user_data):
    existing_user.is_active = False
    existing_user.save()
    payload = {"email": user_data['email'], "password": user_data['password']}
    response = client.post('/api/auth/token/', data=payload, content_type='application/json')
    # Often returns 401 or 403 depending on implementation
    assert response.status_code in [401, 403]

# 10. Token refresh — success (200, returns new access)
def test_token_refresh_success(client, existing_user):
    _, refresh_token = make_pair(existing_user)
    response = client.post('/api/auth/token/refresh/', data={"refresh": refresh_token}, content_type='application/json')
    assert response.status_code == 200
    assert 'access' in response.json()

# 11. Token refresh — missing token (400)
def test_token_refresh_missing_token(client):
    response = client.post('/api/auth/token/refresh/', data={}, content_type='application/json')
    assert response.status_code == 400

# 12. Token refresh — invalid token (401)
def test_token_refresh_invalid_token(client):
    response = client.post('/api/auth/token/refresh/', data={"refresh": "invalidtoken123"}, content_type='application/json')
    assert response.status_code == 401

# 13. Me — success (200, returns user fields)
def test_me_success(client, existing_user):
    access_token, _ = make_pair(existing_user)
    response = client.get('/api/auth/me/', HTTP_AUTHORIZATION=f'Bearer {access_token}')
    assert response.status_code == 200
    data = response.json()
    assert data['email'] == existing_user.email
    assert 'role' in data

# 14. Me — no token (401)
def test_me_no_token(client):
    response = client.get('/api/auth/me/')
    assert response.status_code == 401

# 15. Me — expired/invalid token (401)
def test_me_invalid_token(client):
    response = client.get('/api/auth/me/', HTTP_AUTHORIZATION='Bearer invalidtoken123')
    assert response.status_code == 401

# 16. Me PATCH — update first_name (200, returns updated fields)
def test_me_patch_update(client, existing_user):
    access_token, _ = make_pair(existing_user)
    response = client.patch(
        '/api/auth/me/', 
        data={"first_name": "UpdatedName"}, 
        content_type='application/json',
        HTTP_AUTHORIZATION=f'Bearer {access_token}'
    )
    assert response.status_code == 200
    data = response.json()
    assert data['first_name'] == "UpdatedName"

# 17. Me PATCH — cannot update GPA (security: GPA feeds officer shortlisting)
def test_me_patch_cannot_update_gpa(client, existing_user, user_data):
    access_token, _ = make_pair(existing_user)
    original_gpa = existing_user.gpa
    
    response = client.patch(
        '/api/auth/me/', 
        data={"gpa": "4.00"}, 
        content_type='application/json',
        HTTP_AUTHORIZATION=f'Bearer {access_token}'
    )
    
    # The request should succeed (200), but GPA must remain unchanged
    assert response.status_code == 200
    existing_user.refresh_from_db()
    assert existing_user.gpa == original_gpa


def test_me_patch_changes_password_after_current_password_check(client, existing_user):
    access_token, _ = make_pair(existing_user)
    response = client.patch(
        '/api/auth/me/',
        data={
            'current_password': 'StrongPass123!',
            'new_password': 'New-Secure-Pass-321!',
        },
        content_type='application/json',
        HTTP_AUTHORIZATION=f'Bearer {access_token}',
    )
    assert response.status_code == 200
    existing_user.refresh_from_db()
    assert existing_user.check_password('New-Secure-Pass-321!')
    assert not existing_user.check_password('StrongPass123!')


def test_me_patch_rejects_wrong_current_password(client, existing_user):
    access_token, _ = make_pair(existing_user)
    response = client.patch(
        '/api/auth/me/',
        data={'current_password': 'Wrong-Current-Password!', 'new_password': 'New-Secure-Pass-321!'},
        content_type='application/json',
        HTTP_AUTHORIZATION=f'Bearer {access_token}',
    )
    assert response.status_code == 400
    assert response.json()['error'] == 'Current password is incorrect'


def test_me_patch_rejects_partial_password_change(client, existing_user):
    access_token, _ = make_pair(existing_user)
    response = client.patch(
        '/api/auth/me/',
        data={'new_password': 'New-Secure-Pass-321!'},
        content_type='application/json',
        HTTP_AUTHORIZATION=f'Bearer {access_token}',
    )
    assert response.status_code == 400
    assert 'Both current_password and new_password' in response.json()['error']


def test_me_patch_rejects_short_new_password(client, existing_user):
    access_token, _ = make_pair(existing_user)
    response = client.patch(
        '/api/auth/me/',
        data={'current_password': 'StrongPass123!', 'new_password': 'short'},
        content_type='application/json',
        HTTP_AUTHORIZATION=f'Bearer {access_token}',
    )
    assert response.status_code == 400
    existing_user.refresh_from_db()
    assert existing_user.check_password('StrongPass123!')
