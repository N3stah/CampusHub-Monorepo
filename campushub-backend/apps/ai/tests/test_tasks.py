import pytest
import json
from apps.accounts.models import User
from apps.accounts.jwt_utils import make_pair
from apps.ai.models import AITaskLog

pytestmark = pytest.mark.django_db


@pytest.fixture
def student(db):
    return User.objects.create_user(email='s@t.com', username='s', password='TestPass123!', first_name='S', last_name='t', role='student', admission_number='ADM001')

@pytest.fixture
def lecturer(db):
    return User.objects.create_user(email='lec@t.com', username='lec', password='TestPass123!', first_name='L', last_name='ec', role='lecturer')

@pytest.fixture
def admin_user(db):
    return User.objects.create_user(email='admin@t.com', username='admin', password='TestPass123!', first_name='A', last_name='dmin', role='admin')


def _h(u):
    t, _ = make_pair(u)
    return {'HTTP_AUTHORIZATION': f'Bearer {t}'}

def _post(client, url, data, headers):
    return client.post(url, data=json.dumps(data), content_type='application/json', **headers)


# --- Task list ---

def test_tasks_list_student(client, student):
    r = client.get('/api/ai/tasks/', **_h(student))
    assert r.status_code == 200
    data = r.json()
    assert data['count'] == 3
    types = {t['type'] for t in data['results']}
    assert 'study_plan' in types

def test_tasks_list_lecturer(client, lecturer):
    r = client.get('/api/ai/tasks/', **_h(lecturer))
    assert r.status_code == 200
    assert r.json()['count'] == 4

def test_tasks_list_admin(client, admin_user):
    r = client.get('/api/ai/tasks/', **_h(admin_user))
    assert r.status_code == 200
    assert r.json()['count'] == 3

def test_tasks_401_no_token(client):
    r = client.get('/api/ai/tasks/')
    assert r.status_code == 401


# --- Task execute ---

def test_task_execute_student(client, student):
    r = _post(client, '/api/ai/task/', {'task_type': 'study_plan', 'params': {'topics': 'Python, Django'}}, _h(student))
    assert r.status_code == 200
    data = r.json()
    assert data['task_type'] == 'study_plan'
    assert 'draft' in data
    assert 'warning' in data  # draft-only warning
    # Verify AITaskLog was created
    assert AITaskLog.objects.filter(user=student, task_type='study_plan').count() == 1

def test_task_execute_lecturer_draft_announcement(client, lecturer):
    r = _post(client, '/api/ai/task/', {'task_type': 'draft_announcement', 'params': {'topic': 'Midterm review'}}, _h(lecturer))
    assert r.status_code == 200
    assert 'draft' in r.json()
    assert AITaskLog.objects.filter(user=lecturer, task_type='draft_announcement').count() == 1

def test_task_execute_wrong_role(client, student):
    """Student can't execute lecturer-only tasks."""
    r = _post(client, '/api/ai/task/', {'task_type': 'draft_announcement', 'params': {}}, _h(student))
    assert r.status_code == 403

def test_task_execute_400_no_task_type(client, student):
    r = _post(client, '/api/ai/task/', {'params': {}}, _h(student))
    assert r.status_code == 400

def test_task_execute_401_no_token(client):
    r = _post(client, '/api/ai/task/', {'task_type': 'study_plan'}, {})
    assert r.status_code == 401

def test_task_execute_logs_to_audit(client, student):
    """Every task execution creates an AITaskLog entry."""
    initial_count = AITaskLog.objects.count()
    _post(client, '/api/ai/task/', {'task_type': 'placement_match', 'params': {}}, _h(student))
    assert AITaskLog.objects.count() == initial_count + 1
    log = AITaskLog.objects.latest('created_at')
    assert log.task_type == 'placement_match'
    assert log.provider == 'mock'  # MockProvider in tests
    assert log.success == True
