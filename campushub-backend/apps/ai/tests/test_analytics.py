import pytest
from io import StringIO
from django.core.management import call_command
from apps.accounts.models import User
from apps.accounts.jwt_utils import make_pair
from apps.ai.models import AITaskLog

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(email='admin@t.com', username='admin', password='TestPass123!', first_name='A', last_name='dmin', role='admin')

@pytest.fixture
def student(db):
    return User.objects.create_user(email='s@t.com', username='s', password='TestPass123!', first_name='S', last_name='t', role='student', admission_number='ADM001')


def _h(u):
    t, _ = make_pair(u)
    return {'HTTP_AUTHORIZATION': f'Bearer {t}'}


# --- Analytics endpoint ---

def test_analytics_admin(client, admin_user):
    r = client.get('/api/ai/analytics/', **_h(admin_user))
    assert r.status_code == 200
    data = r.json()
    assert 'usage' in data
    assert 'models' in data
    assert 'at_risk' in data['models']
    assert 'placement' in data['models']
    # Should report not-yet-trained on capstone data
    assert 'not yet trained' in data['models']['at_risk']['status']

def test_analytics_403_student(client, student):
    r = client.get('/api/ai/analytics/', **_h(student))
    assert r.status_code == 403

def test_analytics_401_no_token(client):
    r = client.get('/api/ai/analytics/')
    assert r.status_code == 401

def test_analytics_shows_usage(client, admin_user):
    """Analytics includes AI task call counts."""
    # Create a task log entry
    AITaskLog.objects.create(
        user=admin_user, task_type='system_report',
        input_summary='test', output_summary='test',
        provider='mock', success=True
    )
    r = client.get('/api/ai/analytics/', **_h(admin_user))
    assert r.status_code == 200
    assert r.json()['usage']['total_task_calls'] >= 1


# --- Retrain commands (refuse on insufficient data) ---

def test_retrain_at_risk_refuses():
    """retrain_at_risk_model refuses with insufficient data."""
    out = StringIO()
    call_command('retrain_at_risk_model', stdout=out, stderr=StringIO())
    output = out.getvalue()
    assert 'Cannot train' in output
    assert 'rows' in output.lower()

def test_retrain_placement_refuses():
    """retrain_placement_model refuses with insufficient data."""
    out = StringIO()
    call_command('retrain_placement_model', stdout=out, stderr=StringIO())
    output = out.getvalue()
    assert 'Cannot train' in output
    assert 'rows' in output.lower()

def test_retrain_reports_row_count():
    """Retrain command reports how many rows are available vs required."""
    out = StringIO()
    call_command('retrain_at_risk_model', stdout=out, stderr=StringIO())
    output = out.getvalue()
    assert '/200' in output  # shows N/200 rows
