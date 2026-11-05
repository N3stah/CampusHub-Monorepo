import pytest
import json
from apps.accounts.models import User
from apps.accounts.jwt_utils import make_pair
from apps.ai.models import AIConversation, AIMessage

pytestmark = pytest.mark.django_db


@pytest.fixture
def student(db):
    return User.objects.create_user(email='s@t.com', username='s', password='TestPass123!', first_name='S', last_name='t', role='student', admission_number='ADM001')

@pytest.fixture
def admin_user(db):
    return User.objects.create_user(email='admin@t.com', username='admin', password='TestPass123!', first_name='A', last_name='dmin', role='admin')

def _h(u):
    t, _ = make_pair(u)
    return {'HTTP_AUTHORIZATION': f'Bearer {t}'}

def _post(client, url, data, headers):
    return client.post(url, data=json.dumps(data), content_type='application/json', **headers)


def test_chat_creates_conversation(client, student):
    """POST without conversation_id creates a new conversation."""
    r = _post(client, '/api/ai/chat/', {'message': 'Hello AI!'}, _h(student))
    assert r.status_code == 200
    data = r.json()
    assert 'conversation_id' in data
    assert data['message']['role'] == 'assistant'
    assert data['message']['content']  # MockProvider returns canned text
    # Verify conversation was created
    conv = AIConversation.objects.get(pk=data['conversation_id'])
    assert conv.user == student
    assert conv.title == 'Hello AI!'[:50]

def test_chat_continues_conversation(client, student):
    """POST with conversation_id adds to existing conversation."""
    r1 = _post(client, '/api/ai/chat/', {'message': 'First message'}, _h(student))
    conv_id = r1.json()['conversation_id']
    r2 = _post(client, '/api/ai/chat/', {'message': 'Second message', 'conversation_id': conv_id}, _h(student))
    assert r2.status_code == 200
    assert r2.json()['conversation_id'] == conv_id
    # Should have 4 messages: 2 user + 2 assistant
    assert AIMessage.objects.filter(conversation_id=conv_id).count() == 4

def test_chat_401_no_token(client):
    r = _post(client, '/api/ai/chat/', {'message': 'Hello'}, {})
    assert r.status_code == 401

def test_chat_400_no_message(client, student):
    r = _post(client, '/api/ai/chat/', {'message': ''}, _h(student))
    assert r.status_code == 400

def test_chat_history(client, student):
    """GET history returns all messages in the conversation."""
    r = _post(client, '/api/ai/chat/', {'message': 'Test'}, _h(student))
    conv_id = r.json()['conversation_id']
    r = client.get(f'/api/ai/chat/{conv_id}/', **_h(student))
    assert r.status_code == 200
    data = r.json()
    assert data['conversation_id'] == conv_id
    assert len(data['messages']) == 2  # user + assistant

def test_chat_history_404_not_owner(client, student):
    """Student A can't read student B's conversation."""
    other = User.objects.create_user(email='other@t.com', username='other', password='TestPass123!', first_name='O', last_name='ther', role='student', admission_number='ADM002')
    r = _post(client, '/api/ai/chat/', {'message': 'Private'}, _h(student))
    conv_id = r.json()['conversation_id']
    r = client.get(f'/api/ai/chat/{conv_id}/', **_h(other))
    assert r.status_code == 404

def test_chat_404_nonexistent_conversation(client, student):
    r = _post(client, '/api/ai/chat/', {'message': 'Hi', 'conversation_id': 99999}, _h(student))
    assert r.status_code == 404

def test_chat_admin(client, admin_user):
    """Admin can use chat too."""
    r = _post(client, '/api/ai/chat/', {'message': 'System overview'}, _h(admin_user))
    assert r.status_code == 200
    assert r.json()['message']['role'] == 'assistant'
