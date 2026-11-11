import json
import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django_ratelimit.decorators import ratelimit
import jwt

from .jwt_utils import make_pair, make_token, decode_token, jwt_required
from .emailing import send_password_otp
from .models import PasswordResetOTP

User = get_user_model()


def _json_body(request):
    try:
        return json.loads(request.body or b'{}'), None
    except json.JSONDecodeError:
        return None, JsonResponse({'error': 'Invalid JSON'}, status=400)


def _user_dict(user):
    return {
        'id': user.id,
        'profile_picture_url': user.profile_picture.url if user.profile_picture else None,
        'email': user.email,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role,
        'department': user.department_id,
        'gpa': str(user.gpa) if user.gpa is not None else None,
        'phone_number': user.phone_number,
        'title': user.title,
        'bio': user.bio,
        'office_hours': user.office_hours,
        'date_joined': user.date_joined.isoformat(),
        'must_change_password': user.must_change_password,
        'initial_password_expires_at': user.initial_password_expires_at.isoformat() if user.initial_password_expires_at else None,
    }


@csrf_exempt
@require_http_methods(['POST'])
def register_view(request):
    return JsonResponse(
        {'error': 'Public registration is disabled. Contact the Registrar to request an account.'},
        status=403,
    )


@csrf_exempt
@require_http_methods(['POST'])
@ratelimit(key='ip', rate='10/m', block=True)
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

    has_current_password = 'current_password' in data
    has_new_password = 'new_password' in data
    if has_current_password != has_new_password:
        return JsonResponse(
            {'error': 'Both current_password and new_password are required to change password'},
            status=400,
        )

    password_change = has_current_password and has_new_password
    if password_change:
        current_password = data['current_password']
        new_password = data['new_password']
        if not isinstance(current_password, str) or not user.check_password(current_password):
            return JsonResponse({'error': 'Current password is incorrect'}, status=400)
        if not isinstance(new_password, str):
            return JsonResponse({'error': 'New password must be a string'}, status=400)
        try:
            validate_password(new_password, user)
        except ValidationError as error:
            return JsonResponse({'error': ' '.join(error.messages)}, status=400)
        user.set_password(new_password)
        user.must_change_password = False
        user.initial_password_expires_at = None

    model_fields = {f.name for f in User._meta.get_fields()}
    allowed = [
        f for f in ('first_name', 'last_name', 'phone_number', 'title', 'bio', 'office_hours')
        if f in model_fields
    ]
    changed = [f for f in allowed if f in data]
    if password_change:
        changed.append('password')
        changed.append('must_change_password')
        changed.append('initial_password_expires_at')
    for f in allowed:
        if f in data:
            setattr(user, f, data[f])
    if changed:
        user.save(update_fields=changed)
        if password_change:
            PasswordResetOTP.objects.filter(user=user, consumed_at__isnull=True).update(consumed_at=timezone.now())

    return JsonResponse({**_user_dict(user), 'updated': changed})


@csrf_exempt
@require_http_methods(['POST'])
@jwt_required
def password_change_view(request):
    data, error = _json_body(request)
    if error:
        return error
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    if not isinstance(current_password, str) or not isinstance(new_password, str):
        return JsonResponse({'error': 'current_password and new_password are required.'}, status=400)
    user = request.user
    if not user.check_password(current_password):
        return JsonResponse({'error': 'Current password is incorrect.'}, status=400)
    try:
        validate_password(new_password, user)
    except ValidationError as validation_error:
        return JsonResponse({'error': ' '.join(validation_error.messages)}, status=400)
    user.set_password(new_password)
    user.must_change_password = False
    user.initial_password_expires_at = None
    user.save(update_fields=['password', 'must_change_password', 'initial_password_expires_at'])
    PasswordResetOTP.objects.filter(user=user, consumed_at__isnull=True).update(consumed_at=timezone.now())
    return JsonResponse({'message': 'Password changed successfully.', 'must_change_password': False})


@csrf_exempt
@require_http_methods(['POST'])
@ratelimit(key='ip', rate='10/m', block=True)
def password_otp_request(request):
    data, error = _json_body(request)
    if error:
        return error
    email = data.get('email', '')
    if not isinstance(email, str):
        return JsonResponse({'error': 'Invalid request.'}, status=400)
    user = User.objects.filter(email__iexact=email.strip(), is_active=True).first()
    if user:
        latest = PasswordResetOTP.objects.filter(user=user, consumed_at__isnull=True).first()
        if not latest or latest.created_at <= timezone.now() - timedelta(seconds=60):
            PasswordResetOTP.objects.filter(user=user, consumed_at__isnull=True).update(consumed_at=timezone.now())
            otp = f'{secrets.randbelow(1_000_000):06d}'
            reset_code = PasswordResetOTP.objects.create(
                user=user,
                code_hash=make_password(otp),
                expires_at=timezone.now() + timedelta(minutes=10),
            )
            if not send_password_otp(user=user, otp=otp):
                reset_code.consumed_at = timezone.now()
                reset_code.save(update_fields=['consumed_at'])
    return JsonResponse({'message': 'If the account can be recovered, a verification code has been sent.'})


@csrf_exempt
@require_http_methods(['POST'])
@ratelimit(key='ip', rate='10/m', block=True)
def password_otp_confirm(request):
    data, error = _json_body(request)
    if error:
        return error
    email = data.get('email', '')
    otp = data.get('otp', '')
    new_password = data.get('new_password', '')
    if not all(isinstance(value, str) for value in (email, otp, new_password)):
        return JsonResponse({'error': 'Invalid or expired verification code.'}, status=400)
    if len(otp) != 6 or not otp.isdigit():
        return JsonResponse({'error': 'Invalid or expired verification code.'}, status=400)
    user = User.objects.filter(email__iexact=email.strip(), is_active=True).first()
    if not user:
        return JsonResponse({'error': 'Invalid or expired verification code.'}, status=400)

    with transaction.atomic():
        reset_code = PasswordResetOTP.objects.select_for_update().filter(
            user=user,
            consumed_at__isnull=True,
        ).first()
        if not reset_code or not reset_code.is_valid():
            return JsonResponse({'error': 'Invalid or expired verification code.'}, status=400)
        if not check_password(otp, reset_code.code_hash):
            reset_code.attempts += 1
            reset_code.save(update_fields=['attempts'])
            return JsonResponse({'error': 'Invalid or expired verification code.'}, status=400)
        try:
            validate_password(new_password, user)
        except ValidationError as validation_error:
            return JsonResponse({'error': ' '.join(validation_error.messages)}, status=400)
        user.set_password(new_password)
        user.must_change_password = False
        user.initial_password_expires_at = None
        user.save(update_fields=['password', 'must_change_password', 'initial_password_expires_at'])
        reset_code.consumed_at = timezone.now()
        reset_code.save(update_fields=['consumed_at'])
        PasswordResetOTP.objects.filter(user=user, consumed_at__isnull=True).exclude(pk=reset_code.pk).update(
            consumed_at=timezone.now(),
        )
    return JsonResponse({'message': 'Password reset successfully.'})


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def upload_profile_picture(request):
    user = request.user
    from apps.common.file_guards import validate_image_upload
    uploaded_file = request.FILES.get('profile_picture')
    error = validate_image_upload(uploaded_file)
    if error:
        return error
    # Resize to 320x320 square (center crop + LANCZOS)
    from PIL import Image
    import io
    from django.core.files.base import ContentFile

    img = Image.open(uploaded_file)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    w, h = img.size
    min_dim = min(w, h)
    left = (w - min_dim) // 2
    top = (h - min_dim) // 2
    img = img.crop((left, top, left + min_dim, top + min_dim))
    img = img.resize((320, 320), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=85)
    buf.seek(0)
    user.profile_picture.save(
        f'{user.username}_avatar.jpg',
        ContentFile(buf.getvalue()),
        save=True
    )
    return JsonResponse({'profile_picture_url': user.profile_picture.url})

# --- Password Reset (public endpoints) ---
import logging
from django.utils import timezone
from .models import PasswordResetToken, AuditEvent

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["POST"])
def password_reset_request_view(request):
    data, err = _json_body(request)
    if err:
        return err
    email = data.get("email")
    if not email:
        return JsonResponse({"error": "Email is required"}, status=400)
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return JsonResponse({"message": "If that email exists, a reset link has been sent"})
    token = PasswordResetToken.objects.create(user=user)
    logger.info("Password reset token for %s: %s", user.email, token.token)
    AuditEvent.objects.create(actor=user, action="password_reset.request", description=f"Password reset requested for {user.email}")
    return JsonResponse({"message": "If that email exists, a reset link has been sent"})


@csrf_exempt
@require_http_methods(["POST"])
def password_reset_confirm_view(request):
    data, err = _json_body(request)
    if err:
        return err
    token_value = data.get("token")
    new_password = data.get("new_password")
    if not token_value or not new_password:
        return JsonResponse({"error": "Token and new_password are required"}, status=400)
    try:
        reset_token = PasswordResetToken.objects.get(token=token_value)
    except (PasswordResetToken.DoesNotExist, ValueError, TypeError, ValidationError):
        return JsonResponse({"error": "Invalid token"}, status=400)
    if not reset_token.is_valid():
        return JsonResponse({"error": "Token has expired or already been used"}, status=400)
    user = reset_token.user
    user.set_password(new_password)
    user.save()
    reset_token.used_at = timezone.now()
    reset_token.save()
    AuditEvent.objects.create(actor=user, action="password_reset.confirm", description=f"Password reset confirmed for {user.email}")
    return JsonResponse({"message": "Password reset successfully"})
