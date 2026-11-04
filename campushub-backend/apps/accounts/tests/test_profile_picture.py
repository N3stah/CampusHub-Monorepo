import pytest
import io
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from apps.accounts.models import User
from apps.accounts.jwt_utils import make_pair

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='user@test.com', username='user', password='TestPass123!',
        first_name='User', last_name='Test', role='student'
    )

@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email='admin@test.com', username='admin', password='TestPass123!',
        first_name='Admin', last_name='User', role='admin'
    )

def _headers(user):
    token, _ = make_pair(user)
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}

def _png(name='test.png'):
    img = Image.new('RGB', (1, 1), 'white')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return SimpleUploadedFile(name, buf.getvalue(), content_type='image/png')


def test_upload_success(client, user):
    r = client.post('/api/auth/me/profile-picture/', {'profile_picture': _png()}, **_headers(user))
    assert r.status_code == 200, r.json()
    assert r.json()['profile_picture_url'] is not None
    user.refresh_from_db()
    assert user.profile_picture is not None

def test_upload_no_file(client, user):
    r = client.post('/api/auth/me/profile-picture/', {}, **_headers(user))
    assert r.status_code == 400

def test_upload_too_large(client, user):
    large = SimpleUploadedFile('big.png', b'x' * (10 * 1024 * 1024 + 1), content_type='image/png')
    r = client.post('/api/auth/me/profile-picture/', {'profile_picture': large}, **_headers(user))
    assert r.status_code == 400
    assert '10MB' in r.json()['error']

def test_upload_wrong_extension(client, user):
    bad = SimpleUploadedFile('test.txt', b'not an image', content_type='text/plain')
    r = client.post('/api/auth/me/profile-picture/', {'profile_picture': bad}, **_headers(user))
    assert r.status_code == 400
    assert 'not allowed' in r.json()['error'].lower()

def test_upload_401_no_token(client):
    r = client.post('/api/auth/me/profile-picture/', {'profile_picture': _png()})
    assert r.status_code == 401

def test_me_includes_url_null(client, user):
    r = client.get('/api/auth/me/', **_headers(user))
    assert r.status_code == 200
    assert r.json()['profile_picture_url'] is None

def test_me_shows_url_after_upload(client, user):
    client.post('/api/auth/me/profile-picture/', {'profile_picture': _png()}, **_headers(user))
    r = client.get('/api/auth/me/', **_headers(user))
    assert r.json()['profile_picture_url'] is not None

def test_user_detail_includes_url(client, admin_user, user):
    r = client.get(f'/api/users/{user.id}/', **_headers(admin_user))
    assert r.status_code == 200
    assert 'profile_picture_url' in r.json()
