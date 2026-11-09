import json
from django.urls import reverse
from django.test import Client
import pytest

@pytest.fixture
def api_client():
    return Client()

@pytest.fixture
def admin_user(db, django_user_model):
    user = django_user_model.objects.create_user(email='admin@example.com', password='password', role='admin')
    return user

@pytest.fixture
def student_user(db, django_user_model):
    user = django_user_model.objects.create_user(email='student@example.com', password='password', role='student')
    return user

def get_jwt_token(client, user):
    # Use existing login endpoint to obtain token
    response = client.post('/api/auth/login/', json.dumps({'email': user.email, 'password': 'password'}), content_type='application/json')
    assert response.status_code == 200
    data = json.loads(response.content)
    return data['access_token']

def auth_client(client, token):
    client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'
    return client

@pytest.mark.django_db
def test_list_periods(api_client, admin_user):
    token = get_jwt_token(api_client, admin_user)
    client = auth_client(api_client, token)
    response = client.get('/api/academics/periods/')
    assert response.status_code == 200
    data = json.loads(response.content)
    assert isinstance(data, list)

@pytest.mark.django_db
def test_create_period_admin(api_client, admin_user):
    token = get_jwt_token(api_client, admin_user)
    client = auth_client(api_client, token)
    payload = {'name': 'Semester 1 2026/27', 'start_date': '2026-09-01', 'end_date': '2027-01-31', 'is_current': True}
    response = client.post('/api/academics/periods/', json.dumps(payload), content_type='application/json')
    assert response.status_code == 201
    data = json.loads(response.content)
    assert data['name'] == payload['name']
    assert data['is_current'] is True

@pytest.mark.django_db
def test_create_period_non_admin(api_client, student_user):
    token = get_jwt_token(api_client, student_user)
    client = auth_client(api_client, token)
    payload = {'name': 'Semester 2 2026/27', 'start_date': '2027-02-01', 'end_date': '2027-06-30'}
    response = client.post('/api/academics/periods/', json.dumps(payload), content_type='application/json')
    assert response.status_code == 403

@pytest.mark.django_db
def test_set_current_admin(api_client, admin_user):
    token = get_jwt_token(api_client, admin_user)
    client = auth_client(api_client, token)
    # create two periods
    p1 = client.post('/api/academics/periods/', json.dumps({'name': 'P1', 'start_date': '2026-09-01', 'end_date': '2027-01-31'}), content_type='application/json')
    p2 = client.post('/api/academics/periods/', json.dumps({'name': 'P2', 'start_date': '2027-02-01', 'end_date': '2027-06-30'}), content_type='application/json')
    id1 = json.loads(p1.content)['id']
    id2 = json.loads(p2.content)['id']
    # set first as current
    resp1 = client.patch(f'/api/academics/periods/{id1}/set-current/', {}, content_type='application/json')
    assert resp1.status_code == 200
    # set second as current, should unset first
    resp2 = client.patch(f'/api/academics/periods/{id2}/set-current/', {}, content_type='application/json')
    assert resp2.status_code == 200
    # verify only one is_current
    list_resp = client.get('/api/academics/periods/')
    data = json.loads(list_resp.content)
    currents = [p for p in data if p.get('is_current')]
    assert len(currents) == 1
    assert currents[0]['id'] == id2

@pytest.mark.django_db
def test_one_current_constraint(api_client, admin_user):
    token = get_jwt_token(api_client, admin_user)
    client = auth_client(api_client, token)
    # create period with is_current True
    client.post('/api/academics/periods/', json.dumps({'name': 'C1', 'start_date': '2026-09-01', 'end_date': '2027-01-31', 'is_current': True}), content_type='application/json')
    # attempt to create another with is_current True, should fail with 400
    resp = client.post('/api/academics/periods/', json.dumps({'name': 'C2', 'start_date': '2027-02-01', 'end_date': '2027-06-30', 'is_current': True}), content_type='application/json')
    assert resp.status_code == 400
