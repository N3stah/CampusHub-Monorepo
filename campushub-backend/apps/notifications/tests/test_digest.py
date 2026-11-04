import pytest
from django.core.management import call_command
from django.utils import timezone
from datetime import timedelta
from apps.accounts.models import User
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='user@test.com', username='user', password='pass',
        first_name='User', last_name='Test', role='student'
    )

def _make_notification(user, verb='grade', message='Test', hours_ago=25, is_read=False):
    notif = Notification.objects.create(
        recipient=user, verb=verb, message=message, is_read=is_read
    )
    past = timezone.now() - timedelta(hours=hours_ago)
    Notification.objects.filter(pk=notif.pk).update(created_at=past)
    notif.refresh_from_db()
    return notif


def test_digest_creates_summary(user):
    _make_notification(user, verb='grade', hours_ago=25)
    _make_notification(user, verb='grade', hours_ago=26)
    _make_notification(user, verb='announcement', hours_ago=30)
    call_command('digest_notifications', hours=24)
    digest = Notification.objects.filter(verb='digest', recipient=user).first()
    assert digest is not None
    assert '2 new grades' in digest.message
    assert '1 new announcement' in digest.message

def test_digest_idempotent(user):
    _make_notification(user, hours_ago=25)
    call_command('digest_notifications', hours=24)
    assert Notification.objects.filter(verb='digest', recipient=user).count() == 1
    call_command('digest_notifications', hours=24)
    assert Notification.objects.filter(verb='digest', recipient=user).count() == 1

def test_digest_respects_hours(user):
    _make_notification(user, hours_ago=10)
    call_command('digest_notifications', hours=24)
    assert Notification.objects.filter(verb='digest', recipient=user).count() == 0

def test_digest_skips_read(user):
    _make_notification(user, hours_ago=25, is_read=True)
    call_command('digest_notifications', hours=24)
    assert Notification.objects.filter(verb='digest', recipient=user).count() == 0

def test_digest_skips_existing_digests(user):
    _make_notification(user, hours_ago=25)
    call_command('digest_notifications', hours=24)
    call_command('digest_notifications', hours=0)
    assert Notification.objects.filter(verb='digest', recipient=user).count() == 1

def test_digest_multiple_users(db):
    u1 = User.objects.create_user(email='u1@test.com', username='u1', password='pass', first_name='U', last_name='1', role='student')
    u2 = User.objects.create_user(email='u2@test.com', username='u2', password='pass', first_name='U', last_name='2', role='student')
    _make_notification(u1, verb='grade', hours_ago=25)
    _make_notification(u2, verb='announcement', hours_ago=30)
    call_command('digest_notifications', hours=24)
    d1 = Notification.objects.get(verb='digest', recipient=u1)
    d2 = Notification.objects.get(verb='digest', recipient=u2)
    assert '1 new grade' in d1.message
    assert '1 new announcement' in d2.message

def test_digest_multiple_verbs(user):
    _make_notification(user, verb='grade', hours_ago=25)
    _make_notification(user, verb='grade', hours_ago=26)
    _make_notification(user, verb='announcement', hours_ago=30)
    _make_notification(user, verb='message', hours_ago=28)
    call_command('digest_notifications', hours=24)
    digest = Notification.objects.get(verb='digest', recipient=user)
    assert '2 new grades' in digest.message
    assert '1 new announcement' in digest.message
    assert '1 new message' in digest.message

def test_digest_empty(user):
    call_command('digest_notifications', hours=24)
    assert Notification.objects.filter(verb='digest', recipient=user).count() == 0
