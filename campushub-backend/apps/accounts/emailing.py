import logging
from html import escape
from urllib.parse import urljoin

import requests
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)


def send_account_email(*, recipient: str, subject: str, body: str, html_body: str = '') -> bool:
    if not settings.RESEND_API_KEY or not settings.DEFAULT_FROM_EMAIL:
        logger.error('Resend email delivery is not configured; account email was not sent.')
        return False

    try:
        message = EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient],
        )
        if html_body:
            message.attach_alternative(html_body, 'text/html')
        sent_count = message.send(fail_silently=False)
    except requests.HTTPError as error:
        response = error.response
        if response is not None:
            logger.error(
                'Resend rejected account email with HTTP %s: %s',
                response.status_code,
                response.text[:1000],
            )
        else:
            logger.exception('Resend account email delivery failed.')
        return False
    except (requests.RequestException, OSError, ValueError):
        logger.exception('Resend account email delivery failed.')
        return False

    if sent_count != 1:
        logger.error('Resend backend did not confirm account email delivery.')
        return False
    return True


def send_initial_password(*, user, password: str) -> bool:
    login_url = urljoin(f'{settings.FRONTEND_URL}/', 'login')
    body = (
        f'Hello {user.get_full_name()},\n\n'
        'Your CampusHub account is ready.\n\n'
        f'Username: {user.username}\n'
        f'Initial password: {password}\n\n'
        'Sign in using your account email and this password. CampusHub will require you to set a new '
        'password before continuing. This initial password expires in 48 hours. If it expires or you cannot '
        'sign in, request a password reset code on the CampusHub sign-in page. If you did not expect this account, '
        'contact your university support team.\n\n'
        f'Sign in to CampusHub: {login_url}'
    )
    html_body = (
        '<!doctype html><html><body style="margin:0;padding:24px;background:#f4f7fb;'
        'font-family:Arial,sans-serif;color:#172033;">'
        '<div style="max-width:560px;margin:0 auto;padding:28px;background:#ffffff;'
        'border:1px solid #e2e8f0;border-radius:12px;">'
        '<h1 style="margin:0 0 20px;font-size:22px;">Your CampusHub account is ready</h1>'
        f'<p>Hello {escape(user.get_full_name())},</p>'
        '<p>Your account has been created. Use these details to sign in:</p>'
        '<p><strong>Username:</strong> '
        f'{escape(user.username)}<br><strong>Initial password:</strong> {escape(password)}</p>'
        '<p>CampusHub will require you to set a new password after signing in. '
        'This initial password expires in 48 hours.</p>'
        f'<p style="margin:24px 0;"><a href="{escape(login_url, quote=True)}" '
        'style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#ffffff;'
        'text-decoration:none;border-radius:8px;font-weight:bold;">Sign in to CampusHub</a></p>'
        '<p>If the button does not work, copy and paste this link into your browser:<br>'
        f'<a href="{escape(login_url, quote=True)}">{escape(login_url)}</a></p>'
        '<p>If your password expires or you cannot sign in, request a password reset code '
        'on the sign-in page. If you did not expect this account, contact your university support team.</p>'
        '</div></body></html>'
    )
    return send_account_email(
        recipient=user.email,
        subject='Your CampusHub sign-in details',
        body=body,
        html_body=html_body,
    )


def send_password_otp(*, user, otp: str) -> bool:
    body = (
        f'Hello {user.get_full_name()},\n\n'
        f'Your CampusHub password reset code is: {otp}\n\n'
        'This code expires in 10 minutes and can be used once. If you did not request a password reset, '
        'you can ignore this email.'
    )
    return send_account_email(
        recipient=user.email,
        subject='Your CampusHub password reset code',
        body=body,
    )
