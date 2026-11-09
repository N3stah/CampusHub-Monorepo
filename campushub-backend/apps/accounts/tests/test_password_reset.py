import json
from datetime import timedelta
from django.test import Client
from django.utils import timezone
import pytest
from apps.accounts.models import User, PasswordResetToken


@pytest.fixture
def api_client():
    return Client()

@pytest.fixture
def test_user(db):
    return User.objects.create_user(
        email='reset@test.com',
        username='reset_user',
        password='oldpass123',
        first_name='Reset',
        last_name='User',
        role='student'
    )


@pytest.mark.django_db
def test_reset_request_existing_user(api_client, test_user):
    resp = api_client.post('/api/auth/password/reset/',
        json.dumps({'email': test_user.email}),
        content_type='application/json')
    assert resp.status_code == 200
    data = json.loads(resp.content)
    assert 'message' in data
    token = PasswordResetToken.objects.filter(user=test_user).first()
    assert token is not None


@pytest.mark.django_db
def test_reset_request_nonexistent_user(api_client):
    resp = api_client.post('/api/auth/password/reset/',
        json.dumps({'email': 'nobody@test.com'}),
        content_type='application/json')
    assert resp.status_code == 200
    data = json.loads(resp.content)
    assert 'message' in data
    assert PasswordResetToken.objects.count() == 0


@pytest.mark.django_db
def test_reset_confirm_valid(api_client, test_user):
    token = PasswordResetToken.objects.create(user=test_user)
    resp = api_client.post('/api/auth/password/reset/confirm/',
        json.dumps({'token': str(token.token), 'new_password': 'newpass123'}),
        content_type='application/json')
    assert resp.status_code == 200
    test_user.refresh_from_db()
    assert test_user.check_password('newpass123')
    token.refresh_from_db()
    assert token.used_at is not None


@pytest.mark.django_db
def test_reset_confirm_expired(api_client, test_user):
    token = PasswordResetToken.objects.create(user=test_user)
    token.expires_at = timezone.now() - timedelta(hours=1)
    token.save()
    resp = api_client.post('/api/auth/password/reset/confirm/',
        json.dumps({'token': str(token.token), 'new_password': 'newpass123'}),
        content_type='application/json')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_reset_confirm_already_used(api_client, test_user):
    token = PasswordResetToken.objects.create(user=test_user)
    token.used_at = timezone.now()
    token.save()
    resp = api_client.post('/api/auth/password/reset/confirm/',
        json.dumps({'token': str(token.token), 'new_password': 'newpass123'}),
        content_type='application/json')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_reset_confirm_invalid_token(api_client):
    resp = api_client.post('/api/auth/password/reset/confirm/',
        json.dumps({'token': 'not-a-uuid', 'new_password': 'newpass123'}),
        content_type='application/json')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_reset_confirm_missing_fields(api_client):
    resp = api_client.post('/api/auth/password/reset/confirm/',
        json.dumps({'token': ''}),
        content_type='application/json')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_reset_request_missing_email(api_client):
    resp = api_client.post('/api/auth/password/reset/',
        json.dumps({}),
        content_type='application/json')
    assert resp.status_code == 400
