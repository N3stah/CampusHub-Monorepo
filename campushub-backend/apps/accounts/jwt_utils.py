import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import JsonResponse

User = get_user_model()


def make_token(user, token_type):
    now = datetime.now(timezone.utc)
    if token_type == 'access':
        exp = now + timedelta(minutes=settings.JWT_ACCESS_MINUTES)
        payload = {'user_id': user.id, 'email': user.email, 'role': user.role}
    else:
        exp = now + timedelta(days=settings.JWT_REFRESH_DAYS)
        payload = {'user_id': user.id}
    payload.update({'type': token_type, 'iat': now, 'exp': exp})
    return jwt.encode(payload, settings.JWT_SECRET, algorithm='HS256')


def make_pair(user):
    return make_token(user, 'access'), make_token(user, 'refresh')


def decode_token(token, expected_type):
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'])
    if payload.get('type') != expected_type:
        raise jwt.InvalidTokenError('wrong token type')
    return payload


def _auth_user(request):
    """Returns (user, error_response)."""
    header = request.META.get('HTTP_AUTHORIZATION', '')
    if not header.startswith('Bearer '):
        return None, JsonResponse({'error': 'Authentication required'}, status=401)
    try:
        payload = decode_token(header.split(' ', 1)[1], 'access')
    except jwt.ExpiredSignatureError:
        return None, JsonResponse({'error': 'Token expired'}, status=401)
    except jwt.PyJWTError:
        return None, JsonResponse({'error': 'Invalid token'}, status=401)
    try:
        user = User.objects.get(id=payload['user_id'], is_active=True)
    except User.DoesNotExist:
        return None, JsonResponse({'error': 'User not found'}, status=401)
    return user, None


def jwt_required(view):
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        user, err = _auth_user(request)
        if err:
            return err
        request.user = user
        return view(request, *args, **kwargs)
    return wrapper


def role_required(*roles):
    def decorator(view):
        @wraps(view)
        @jwt_required
        def wrapper(request, *args, **kwargs):
            if request.user.role not in roles:
                return JsonResponse({'error': 'Forbidden'}, status=403)
            return view(request, *args, **kwargs)
        return wrapper
    return decorator