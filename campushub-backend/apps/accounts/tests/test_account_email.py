import re
from datetime import timedelta
from unittest.mock import Mock, patch

import pytest
import requests
from django.core import mail
from django.core.mail import EmailMessage
from django.test import override_settings
from django.utils import timezone

from apps.accounts.jwt_utils import make_pair
from apps.accounts.emailing import send_account_email
from apps.accounts.models import PasswordResetOTP, User
from apps.accounts.email_backends import ResendEmailBackend

pytestmark = pytest.mark.django_db


def create_user(email, username, role='student', **kwargs):
    return User.objects.create_user(
        email=email,
        username=username,
        first_name='Test',
        last_name='Account',
        password='Original-Password!345',
        role=role,
        **kwargs,
    )


def auth_header(user):
    access_token, _ = make_pair(user)
    return {'HTTP_AUTHORIZATION': f'Bearer {access_token}'}


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    RESEND_API_KEY='re_test-api-key',
    DEFAULT_FROM_EMAIL='campushub@example.test',
)
def test_admin_create_sends_random_initial_password_without_returning_it(client):
    admin = create_user('admin@example.test', 'admin', role='admin')
    response = client.post(
        '/api/users/',
        data={
            'email': 'new-student@example.test',
            'username': 'new-student',
            'first_name': 'New',
            'last_name': 'Student',
            'role': 'student',
            'send_welcome_email': True,
        },
        content_type='application/json',
        **auth_header(admin),
    )

    assert response.status_code == 201
    assert response.json()['welcome_email_status'] == 'sent'
    assert 'password' not in response.json()
    account = User.objects.get(email='new-student@example.test')
    assert account.must_change_password
    assert account.invitation_email_status == 'sent'
    assert len(mail.outbox) == 1
    match = re.search(r'Initial password: ([A-Za-z0-9_-]+)', mail.outbox[0].body)
    assert match
    assert account.check_password(match.group(1))


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    RESEND_API_KEY='re_test-api-key',
    DEFAULT_FROM_EMAIL='campushub@example.test',
)
def test_admin_create_lecturer_sends_initial_password_email(client):
    admin = create_user('admin@example.test', 'admin', role='admin')
    response = client.post(
        '/api/lecturers/',
        data={
            'email': 'new-lecturer@example.test',
            'username': 'new-lecturer',
            'first_name': 'New',
            'last_name': 'Lecturer',
            'role': 'lecturer',
            'title': 'Lecturer',
            'send_welcome_email': True,
        },
        content_type='application/json',
        **auth_header(admin),
    )

    assert response.status_code == 201
    assert response.json()['welcome_email_status'] == 'sent'
    assert 'password' not in response.json()
    account = User.objects.get(email='new-lecturer@example.test')
    assert account.must_change_password
    assert account.initial_password_expires_at is not None
    assert len(mail.outbox) == 1
    match = re.search(r'Initial password: ([A-Za-z0-9_-]+)', mail.outbox[0].body)
    assert match
    assert account.check_password(match.group(1))


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    RESEND_API_KEY='re_test-api-key',
    DEFAULT_FROM_EMAIL='campushub@example.test',
)
def test_admin_can_resend_invitation_without_exposing_password(client):
    admin = create_user('admin@example.test', 'admin', role='admin')
    account = create_user('student@example.test', 'student')
    response = client.post(f'/api/users/{account.id}/resend-invitation/', **auth_header(admin))

    assert response.status_code == 200
    assert response.json() == {'welcome_email_status': 'sent'}
    account.refresh_from_db()
    assert account.must_change_password
    assert account.invitation_email_status == 'sent'
    assert 'password' not in response.json()
    match = re.search(r'Initial password: ([A-Za-z0-9_-]+)', mail.outbox[0].body)
    assert match and account.check_password(match.group(1))


@override_settings(RESEND_API_KEY='', DEFAULT_FROM_EMAIL='')
def test_resend_failure_does_not_replace_existing_password(client):
    admin = create_user('admin@example.test', 'admin', role='admin')
    account = create_user('student@example.test', 'student')
    response = client.post(f'/api/users/{account.id}/resend-invitation/', **auth_header(admin))

    assert response.status_code == 200
    assert response.json()['welcome_email_status'] == 'failed'
    account.refresh_from_db()
    assert account.check_password('Original-Password!345')
    assert account.invitation_email_status == 'failed'


def test_non_admin_cannot_resend_invitation(client):
    student = create_user('student@example.test', 'student')
    response = client.post(f'/api/users/{student.id}/resend-invitation/', **auth_header(student))
    assert response.status_code == 403


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    RESEND_API_KEY='re_test-api-key',
    DEFAULT_FROM_EMAIL='campushub@example.test',
)
def test_registrar_can_only_create_student_accounts(client):
    registrar = create_user('registrar@example.test', 'registrar', role='registrar')
    student_response = client.post(
        '/api/users/',
        data={
            'email': 'new-student@example.test',
            'username': 'new-student',
            'first_name': 'New',
            'last_name': 'Student',
            'role': 'student',
            'send_welcome_email': True,
        },
        content_type='application/json',
        **auth_header(registrar),
    )
    assert student_response.status_code == 201
    assert student_response.json()['welcome_email_status'] == 'sent'

    staff_response = client.post(
        '/api/users/',
        data={
            'email': 'new-lecturer@example.test',
            'username': 'new-lecturer',
            'first_name': 'New',
            'last_name': 'Lecturer',
            'role': 'lecturer',
            'send_welcome_email': True,
        },
        content_type='application/json',
        **auth_header(registrar),
    )
    assert staff_response.status_code == 403
    assert not User.objects.filter(email='new-lecturer@example.test').exists()


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    RESEND_API_KEY='re_test-api-key',
    DEFAULT_FROM_EMAIL='campushub@example.test',
)
def test_password_otp_can_reset_password_once(client):
    user = create_user('student@example.test', 'student')
    requested = client.post(
        '/api/auth/password/otp/request/',
        data={'email': user.email},
        content_type='application/json',
    )
    assert requested.status_code == 200
    assert 'sent' in requested.json()['message']
    match = re.search(r'code is: (\d{6})', mail.outbox[0].body)
    assert match

    confirmed = client.post(
        '/api/auth/password/otp/confirm/',
        data={'email': user.email, 'otp': match.group(1), 'new_password': 'New-Password!456'},
        content_type='application/json',
    )
    assert confirmed.status_code == 200
    user.refresh_from_db()
    assert user.check_password('New-Password!456')
    assert not user.must_change_password
    replay = client.post(
        '/api/auth/password/otp/confirm/',
        data={'email': user.email, 'otp': match.group(1), 'new_password': 'Another-Password!456'},
        content_type='application/json',
    )
    assert replay.status_code == 400


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    RESEND_API_KEY='re_test-api-key',
    DEFAULT_FROM_EMAIL='campushub@example.test',
)
def test_expired_password_otp_is_rejected(client):
    user = create_user('student@example.test', 'student')
    client.post(
        '/api/auth/password/otp/request/',
        data={'email': user.email},
        content_type='application/json',
    )
    reset_code = PasswordResetOTP.objects.get(user=user)
    reset_code.expires_at = timezone.now() - timedelta(seconds=1)
    reset_code.save(update_fields=['expires_at'])

    response = client.post(
        '/api/auth/password/otp/confirm/',
        data={'email': user.email, 'otp': '000000', 'new_password': 'New-Password!456'},
        content_type='application/json',
    )
    assert response.status_code == 400


def test_password_change_clears_initial_change_requirement(client):
    user = create_user('student@example.test', 'student', must_change_password=True)
    response = client.post(
        '/api/auth/password/change/',
        data={'current_password': 'Original-Password!345', 'new_password': 'New-Password!456'},
        content_type='application/json',
        **auth_header(user),
    )
    assert response.status_code == 200
    user.refresh_from_db()
    assert not user.must_change_password


def test_initial_password_session_cannot_access_api_until_changed(client):
    user = create_user('student@example.test', 'student', must_change_password=True)
    access_token, _ = make_pair(user)

    blocked = client.get('/api/academics/enrollments/', HTTP_AUTHORIZATION=f'Bearer {access_token}')
    assert blocked.status_code == 403
    profile = client.get('/api/auth/me/', HTTP_AUTHORIZATION=f'Bearer {access_token}')
    assert profile.status_code == 200
    assert profile.json()['must_change_password']

    changed = client.post(
        '/api/auth/password/change/',
        data={'current_password': 'Original-Password!345', 'new_password': 'New-Password!456'},
        content_type='application/json',
        HTTP_AUTHORIZATION=f'Bearer {access_token}',
    )
    assert changed.status_code == 200
    allowed = client.get('/api/academics/enrollments/', HTTP_AUTHORIZATION=f'Bearer {access_token}')
    assert allowed.status_code == 200


def test_expired_initial_password_requires_otp_recovery(client):
    user = create_user(
        'student@example.test',
        'student',
        must_change_password=True,
        initial_password_expires_at=timezone.now() - timedelta(seconds=1),
    )
    access_token, _ = make_pair(user)
    response = client.post(
        '/api/auth/password/change/',
        data={'current_password': 'Original-Password!345', 'new_password': 'New-Password!456'},
        content_type='application/json',
        HTTP_AUTHORIZATION=f'Bearer {access_token}',
    )
    assert response.status_code == 403
    assert 'expired' in response.json()['error'].lower()


@override_settings(
    EMAIL_BACKEND='apps.accounts.email_backends.ResendEmailBackend',
    RESEND_API_KEY='re_test-api-key',
    DEFAULT_FROM_EMAIL='CampusHub <noreply@example.test>',
)
@patch('apps.accounts.email_backends.requests.post')
def test_resend_backend_sends_email_via_api(mock_post):
    mock_post.return_value = Mock(status_code=200)
    message = EmailMessage(
        'Test subject',
        'Plain-text body',
        to=['student@example.test'],
    )

    sent_count = ResendEmailBackend().send_messages([message])

    assert sent_count == 1
    mock_post.assert_called_once_with(
        'https://api.resend.com/emails',
        headers={
            'Authorization': 'Bearer re_test-api-key',
            'Content-Type': 'application/json',
        },
        json={
            'from': 'CampusHub <noreply@example.test>',
            'to': ['student@example.test'],
            'subject': 'Test subject',
            'text': 'Plain-text body',
        },
        timeout=15,
    )


@override_settings(RESEND_API_KEY='re_test-api-key')
@patch('apps.accounts.email_backends.requests.post')
def test_resend_backend_raises_for_api_failure(mock_post):
    mock_post.return_value.raise_for_status.side_effect = requests.HTTPError('API failure')
    message = EmailMessage('Test subject', 'Body', to=['student@example.test'])

    with pytest.raises(requests.HTTPError):
        ResendEmailBackend().send_messages([message])


@override_settings(
    EMAIL_BACKEND='apps.accounts.email_backends.ResendEmailBackend',
    RESEND_API_KEY='re_test-api-key',
    DEFAULT_FROM_EMAIL='CampusHub <noreply@example.test>',
)
@patch('apps.accounts.email_backends.requests.post')
def test_resend_rejection_logs_response_body(mock_post, caplog):
    response = Mock(status_code=403, text='{"message":"Sender domain is not verified"}')
    response.raise_for_status.side_effect = requests.HTTPError(response=response)
    mock_post.return_value = response

    sent = send_account_email(
        recipient='student@example.test',
        subject='Test subject',
        body='Body',
    )

    assert not sent
    assert 'HTTP 403' in caplog.text
    assert 'Sender domain is not verified' in caplog.text
