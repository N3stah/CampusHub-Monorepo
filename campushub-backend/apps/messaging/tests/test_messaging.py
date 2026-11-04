import pytest
import json
from apps.accounts.models import User
from apps.academics.models import (
    Department, Course, Unit, Offering, UnitTeachingAssignment, Enrollment
)
from apps.accounts.jwt_utils import make_pair
from apps.messaging.models import Conversation, ConversationParticipant, Message

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup(db):
    dept = Department.objects.create(name='CS', code='CS')
    c1 = Course.objects.create(code='CS101', title='Intro', department=dept)
    u1 = Unit.objects.create(code='CS101U', title='U1')
    o1 = Offering.objects.create(unit=u1, course=c1)
    c2 = Course.objects.create(code='CS102', title='Adv', department=dept)
    u2 = Unit.objects.create(code='CS102U', title='U2')
    o2 = Offering.objects.create(unit=u2, course=c2)
    l1 = User.objects.create_user(email='lec1@t.com', username='lec1', password='TestPass123!', first_name='L', last_name='1', role='lecturer')
    l2 = User.objects.create_user(email='lec2@t.com', username='lec2', password='TestPass123!', first_name='L', last_name='2', role='lecturer')
    s1 = User.objects.create_user(email='s1@t.com', username='s1', password='TestPass123!', first_name='S', last_name='1', role='student', admission_number='ADM001')
    s2 = User.objects.create_user(email='s2@t.com', username='s2', password='TestPass123!', first_name='S', last_name='2', role='student', admission_number='ADM002')
    admin = User.objects.create_user(email='admin@t.com', username='admin', password='TestPass123!', first_name='A', last_name='dmin', role='admin')
    UnitTeachingAssignment.objects.create(offering=o1, lecturer=l1)
    UnitTeachingAssignment.objects.create(offering=o2, lecturer=l2)
    Enrollment.objects.create(student=s1, course=c1, status='active')
    Enrollment.objects.create(student=s2, course=c2, status='active')
    return type('S', (), dict(dept=dept, c1=c1, c2=c2, u1=u1, u2=u2, o1=o1, o2=o2, l1=l1, l2=l2, s1=s1, s2=s2, admin=admin))()


def _h(u):
    t, _ = make_pair(u)
    return {'HTTP_AUTHORIZATION': f'Bearer {t}'}

def _post(client, url, data, headers):
    return client.post(url, data=json.dumps(data), content_type='application/json', **headers)


# --- Direct DM permissions ---

def test_dm_student_to_own_lecturer(client, setup):
    r = _post(client, '/api/messaging/conversations/direct/', {'recipient_id': setup.l1.id}, _h(setup.s1))
    assert r.status_code == 200
    assert r.json()['kind'] == 'direct'

def test_dm_student_to_other_lecturer_denied(client, setup):
    r = _post(client, '/api/messaging/conversations/direct/', {'recipient_id': setup.l2.id}, _h(setup.s1))
    assert r.status_code == 403

def test_dm_student_to_student_denied(client, setup):
    r = _post(client, '/api/messaging/conversations/direct/', {'recipient_id': setup.s2.id}, _h(setup.s1))
    assert r.status_code == 403

def test_dm_self_denied(client, setup):
    r = _post(client, '/api/messaging/conversations/direct/', {'recipient_id': setup.s1.id}, _h(setup.s1))
    assert r.status_code == 400

def test_dm_get_or_create(client, setup):
    h = _h(setup.s1)
    r1 = _post(client, '/api/messaging/conversations/direct/', {'recipient_id': setup.l1.id}, h)
    r2 = _post(client, '/api/messaging/conversations/direct/', {'recipient_id': setup.l1.id}, h)
    assert r1.json()['id'] == r2.json()['id']


# --- Group conversation ---

def test_group_student_enrolled(client, setup):
    r = client.get(f'/api/messaging/offerings/{setup.o1.id}/group-conversation/', **_h(setup.s1))
    assert r.status_code == 200
    assert r.json()['kind'] == 'group'

def test_group_student_not_enrolled_denied(client, setup):
    r = client.get(f'/api/messaging/offerings/{setup.o2.id}/group-conversation/', **_h(setup.s1))
    assert r.status_code == 403

def test_group_lecturer_assigned(client, setup):
    r = client.get(f'/api/messaging/offerings/{setup.o1.id}/group-conversation/', **_h(setup.l1))
    assert r.status_code == 200

def test_group_lecturer_unassigned_denied(client, setup):
    r = client.get(f'/api/messaging/offerings/{setup.o1.id}/group-conversation/', **_h(setup.l2))
    assert r.status_code == 403


# --- Messages ---

def test_send_and_list(client, setup):
    r = _post(client, '/api/messaging/conversations/direct/', {'recipient_id': setup.l1.id}, _h(setup.s1))
    cid = r.json()['id']
    r = _post(client, f'/api/messaging/conversations/{cid}/messages/', {'body': 'Hello!'}, _h(setup.s1))
    assert r.status_code == 201
    assert r.json()['body'] == 'Hello!'
    r = client.get(f'/api/messaging/conversations/{cid}/messages/', **_h(setup.s1))
    assert r.json()['count'] == 1

def test_non_participant_cannot_read(client, setup):
    r = _post(client, '/api/messaging/conversations/direct/', {'recipient_id': setup.l1.id}, _h(setup.s1))
    cid = r.json()['id']
    r = client.get(f'/api/messaging/conversations/{cid}/messages/', **_h(setup.s2))
    assert r.status_code == 403

def test_polling_after(client, setup):
    r = _post(client, '/api/messaging/conversations/direct/', {'recipient_id': setup.l1.id}, _h(setup.s1))
    cid = r.json()['id']
    r1 = _post(client, f'/api/messaging/conversations/{cid}/messages/', {'body': 'First'}, _h(setup.s1))
    _post(client, f'/api/messaging/conversations/{cid}/messages/', {'body': 'Second'}, _h(setup.s1))
    r = client.get(f'/api/messaging/conversations/{cid}/messages/?after={r1.json()["id"]}', **_h(setup.s1))
    assert r.json()['count'] == 1
    assert r.json()['results'][0]['body'] == 'Second'


# --- Delete ---

def test_delete_own(client, setup):
    r = _post(client, '/api/messaging/conversations/direct/', {'recipient_id': setup.l1.id}, _h(setup.s1))
    cid = r.json()['id']
    r = _post(client, f'/api/messaging/conversations/{cid}/messages/', {'body': 'X'}, _h(setup.s1))
    mid = r.json()['id']
    r = client.delete(f'/api/messaging/messages/{mid}/', **_h(setup.s1))
    assert r.status_code == 200
    r = client.get(f'/api/messaging/conversations/{cid}/messages/', **_h(setup.s1))
    assert r.json()['count'] == 0

def test_delete_others_denied_in_direct(client, setup):
    """In a direct conversation, neither party is admin — can't delete others' messages."""
    r = _post(client, '/api/messaging/conversations/direct/', {'recipient_id': setup.l1.id}, _h(setup.s1))
    cid = r.json()['id']
    r = _post(client, f'/api/messaging/conversations/{cid}/messages/', {'body': 'From student'}, _h(setup.s1))
    mid = r.json()['id']
    r = client.delete(f'/api/messaging/messages/{mid}/', **_h(setup.l1))
    assert r.status_code == 403


# --- Unread + mark read ---

def test_unread_and_mark_read(client, setup):
    r = _post(client, '/api/messaging/conversations/direct/', {'recipient_id': setup.l1.id}, _h(setup.s1))
    cid = r.json()['id']
    _post(client, f'/api/messaging/conversations/{cid}/messages/', {'body': 'Hi'}, _h(setup.s1))
    # Lecturer has 1 unread
    r = client.get('/api/messaging/conversations/', **_h(setup.l1))
    assert r.json()['results'][0]['unread_count'] == 1
    # Mark read
    client.patch(f'/api/messaging/conversations/{cid}/read/', **_h(setup.l1))
    # Unread drops to 0
    r = client.get('/api/messaging/conversations/', **_h(setup.l1))
    assert r.json()['results'][0]['unread_count'] == 0
