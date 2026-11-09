# Tests for role expansion

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.accounts.jwt_utils import make_pair

User = get_user_model()

pytestmark = pytest.mark.django_db


def make_user(email, username, role="student", **kwargs):
    return User.objects.create_user(
        email=email,
        username=username,
        first_name="Test",
        last_name="Account",
        password="T0ugh-Campus-Password!82",
        role=role,
        **kwargs,
    )


def auth_header(user):
    access, _ = make_pair(user)
    return {"HTTP_AUTHORIZATION": f"Bearer {access}"}

# List of the seven new roles added to the system
NEW_ROLES = [
    "ict_admin",
    "registrar",
    "finance",
    "hod",
    "examination",
    "librarian",
    "hostel",
]


@pytest.mark.parametrize("role", NEW_ROLES)
def test_admin_can_create_user_with_new_role_and_login(client: Client, role: str):
    """Admin should be able to create a user with each new role and the user can log in."""
    admin = make_user("admin@example.test", "campus-admin", role="admin")
    admin.is_staff = True
    admin.save(update_fields=["is_staff"])

    response = client.post(
        "/api/users/",
        data={
            "email": f"{role}@example.test",
            "username": f"{role}-user",
            "first_name": "Campus",
            "last_name": role.title(),
            "password": "T0ugh-Campus-Password!82",
            "role": role,
        },
        content_type="application/json",
        **auth_header(admin),
    )
    assert response.status_code == 201
    assert response.json()["role"] == role

    # Login with the newly created user
    login_resp = client.post(
        "/api/auth/token/",
        data={"email": f"{role}@example.test", "password": "T0ugh-Campus-Password!82"},
        content_type="application/json",
    )
    assert login_resp.status_code == 200
    # Verify the token yields the correct role via /api/auth/me/
    me_resp = client.get(
        "/api/auth/me/",
        HTTP_AUTHORIZATION=f"Bearer {login_resp.json()['access']}",
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["role"] == role


def test_invalid_role_is_rejected(client: Client):
    """Creating a user with a role not in ROLE_CHOICES should fail with a 400 error."""
    admin = make_user("admin@example.test", "campus-admin", role="admin")
    admin.is_staff = True
    admin.save(update_fields=["is_staff"])

    response = client.post(
        "/api/users/",
        data={
            "email": "invalid@example.test",
            "username": "invalid-user",
            "first_name": "Invalid",
            "last_name": "User",
            "password": "T0ugh-Campus-Password!82",
            "role": "super_admin",
        },
        content_type="application/json",
        **auth_header(admin),
    )
    # The view validates role against VALID_ROLES and returns a 400 with an error message
    assert response.status_code == 400
    assert "role must be one of" in response.json().get("error", "")
