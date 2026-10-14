import json

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import jwt

from .jwt_utils import make_pair, make_token, decode_token, jwt_required

User = get_user_model()


def _json_body(request):
    try:
        return json.loads(request.body or b'{}'), None
    except json.JSONDecodeError:
        return None, JsonResponse({'error': 'Invalid JSON'}, status=400)


def _user_dict(user):
    return {
        'id': user.id,
        'email': user.email,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role,
        'department': user.department_id,
        'date_joined': user.date_joined.isoformat(),
    }


@csrf_exempt
@require_http_methods(['POST'])
def register_view(request):
    data, err = _json_body(request)
    if err:
        return err

    email = data.get('email', '').strip().lower()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not email or not username or not password:
        return JsonResponse({'error': 'email, username and password are required'}, status=400)
    if len(password) < 8:
        return JsonResponse({'error': 'password must be at least 8 characters'}, status=400)

    try:
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            role='student',  # never trust the client for role
        )
    except IntegrityError:
        return JsonResponse({'error': 'email or username already exists'}, status=400)

    return JsonResponse(
        {'id': user.id, 'email': user.email, 'username': user.username, 'role': user.role},
        status=201,
    )


@csrf_exempt
@require_http_methods(['POST'])
def token_view(request):
    data, err = _json_body(request)
    if err:
        return err

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    if not email or not password:
        return JsonResponse({'error': 'email and password are required'}, status=400)

    user = User.objects.filter(email__iexact=email).first()
    if user is None or not user.check_password(password):
        return JsonResponse({'error': 'Invalid credentials'}, status=401)
    if not user.is_active:
        return JsonResponse({'error': 'Account is disabled'}, status=403)

    access, refresh = make_pair(user)
    return JsonResponse({'access': access, 'refresh': refresh})


@csrf_exempt
@require_http_methods(['POST'])
def token_refresh_view(request):
    data, err = _json_body(request)
    if err:
        return err

    refresh = data.get('refresh', '')
    if not refresh:
        return JsonResponse({'error': 'refresh token is required'}, status=400)

    try:
        payload = decode_token(refresh, 'refresh')
    except jwt.ExpiredSignatureError:
        return JsonResponse({'error': 'refresh token expired'}, status=401)
    except jwt.PyJWTError:
        return JsonResponse({'error': 'invalid refresh token'}, status=401)

    user = User.objects.filter(id=payload['user_id'], is_active=True).first()
    if user is None:
        return JsonResponse({'error': 'user not found'}, status=401)

    return JsonResponse({'access': make_token(user, 'access')})


@csrf_exempt
@require_http_methods(['GET', 'PATCH'])
@jwt_required
def me_view(request):
    user = request.user

    if request.method == 'GET':
        return JsonResponse(_user_dict(user))

    data, err = _json_body(request)
    if err:
        return err

    model_fields = {f.name for f in User._meta.get_fields()}
    allowed = [f for f in ('first_name', 'last_name', 'phone_number') if f in model_fields]
    changed = [f for f in allowed if f in data]
    for f in changed:
        setattr(user, f, data[f])
    if changed:
        user.save(update_fields=changed)

    return JsonResponse({**_user_dict(user), 'updated': changed})