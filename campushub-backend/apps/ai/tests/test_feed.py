import pytest
import json
from apps.accounts.models import User
from apps.academics.models import (
    Department, Course, Unit, Offering, UnitTeachingAssignment, Enrollment
)
from apps.accounts.jwt_utils import make_pair
from apps.ai.context_builder import build_feed_context

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(email='admin@t.com', username='admin', password='TestPass123!', first_name='A', last_name='dmin', role='admin')

@pytest.fixture
def lecturer(db):
    return User.objects.create_user(email='lec@t.com', username='lec', password='TestPass123!', first_name='L', last_name='ec', role='lecturer')

@pytest.fixture
def student(db):
    return User.objects.create_user(email='s@t.com', username='s', password='TestPass123!', first_name='S', last_name='t', role='student', admission_number='ADM001')

@pytest.fixture
def officer(db):
    return User.objects.create_user(email='off@t.com', username='off', password='TestPass123!', first_name='O', last_name='ff', role='officer')

def _h(u):
    t, _ = make_pair(u)
    return {'HTTP_AUTHORIZATION': f'Bearer {t}'}


def test_feed_student(client, student):
    r = client.get('/api/ai/feed/', **_h(student))
    assert r.status_code == 200
    data = r.json()
    assert 'feed' in data
    assert 'summary' in data['feed']
    assert data['feed']['context_role'] == 'student'

def test_feed_lecturer(client, lecturer):
    r = client.get('/api/ai/feed/', **_h(lecturer))
    assert r.status_code == 200
    assert r.json()['feed']['context_role'] == 'lecturer'

def test_feed_admin(client, admin_user):
    r = client.get('/api/ai/feed/', **_h(admin_user))
    assert r.status_code == 200
    assert r.json()['feed']['context_role'] == 'admin'

def test_feed_401_no_token(client):
    r = client.get('/api/ai/feed/')
    assert r.status_code == 401

def test_feed_cached(client, student):
    """Second call within 24h returns cached (same generated_at)."""
    r1 = client.get('/api/ai/feed/', **_h(student))
    assert r1.status_code == 200
    assert r1.json()['cached'] == False
    ts1 = r1.json()['generated_at']

    r2 = client.get('/api/ai/feed/', **_h(student))
    assert r2.status_code == 200
    assert r2.json()['cached'] == True
    assert r2.json()['generated_at'] == ts1

def test_feed_student_no_data_leak(db):
    """Student A's context never includes student B's name or email."""
    s_a = User.objects.create_user(email='aaa@t.com', username='aaa', password='TestPass123!', first_name='AAA', last_name='Student', role='student', admission_number='ADM_A', gpa='3.5')
    s_b = User.objects.create_user(email='bbb@t.com', username='bbb', password='TestPass123!', first_name='BBB', last_name='Student', role='student', admission_number='ADM_B', gpa='2.0')

    ctx_a = build_feed_context(s_a)
    ctx_str = json.dumps(ctx_a, default=str)

    # Student B's data must NOT appear in student A's context
    assert 'bbb@t.com' not in ctx_str
    assert 'BBB' not in ctx_str
    assert 'ADM_B' not in ctx_str
    assert '2.0' not in ctx_str  # student B's GPA

    # Student A's own data SHOULD appear
    assert ctx_a['role'] == 'student'
