import logging
import smtplib

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def send_account_email(*, recipient: str, subject: str, body: str) -> bool:
    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD or not settings.DEFAULT_FROM_EMAIL:
        logger.error('Email delivery is not configured; account email was not sent.')
        return False

    try:
        sent_count = send_mail(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [recipient],
            fail_silently=False,
        )
    except (smtplib.SMTPException, OSError, ValueError):
        logger.exception('SMTP account email delivery failed.')
        return False

    if sent_count != 1:
        logger.error('SMTP backend did not confirm account email delivery.')
        return False
    return True


def send_initial_password(*, user, password: str) -> bool:
    body = (
        f'Hello {user.get_full_name()},\n\n'
        'Your CampusHub account is ready.\n\n'
        f'Username: {user.username}\n'
        f'Initial password: {password}\n\n'
        'Sign in using your account email and this password. CampusHub will require you to set a new '
        'password before continuing. This initial password expires in 48 hours. If it expires or you cannot '
        'sign in, request a password reset code on the CampusHub sign-in page. If you did not expect this account, '
        'contact your university support team.'
    )
    return send_account_email(
        recipient=user.email,
        subject='Your CampusHub sign-in details',
        body=body,
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
