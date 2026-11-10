import json
from datetime import date
from decimal import Decimal, InvalidOperation

from django.core.paginator import EmptyPage, Paginator
from django.db.models import Q
from django.http import JsonResponse


def json_payload(request):
    try:
        payload = json.loads(request.body or b'{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None, JsonResponse({'error': 'Invalid JSON'}, status=400)
    if not isinstance(payload, dict):
        return None, JsonResponse({'error': 'Request body must be a JSON object'}, status=400)
    return payload, None


def require_role(request, *roles):
    if request.user.role not in roles:
        return JsonResponse({'error': 'Forbidden'}, status=403)
    return None


def required_text(payload, field, label=None, max_length=None):
    value = payload.get(field)
    if not isinstance(value, str) or not value.strip():
        return None, f'{label or field} is required'
    value = value.strip()
    if max_length and len(value) > max_length:
        return None, f'{label or field} must be at most {max_length} characters'
    return value, None


def integer_value(value, label, *, minimum=0):
    try:
        result = int(value)
    except (TypeError, ValueError):
        return None, f'{label} must be an integer'
    if result < minimum:
        return None, f'{label} must be at least {minimum}'
    return result, None


def decimal_value(value, label, *, minimum=Decimal('0.00')):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None, f'{label} must be a valid amount'
    if not result.is_finite() or result < minimum:
        return None, f'{label} must be at least {minimum}'
    return result, None


def date_value(value, label, *, required=True):
    if value in (None, '') and not required:
        return None, None
    if not isinstance(value, str):
        return None, f'{label} must be a date in YYYY-MM-DD format'
    try:
        return date.fromisoformat(value), None
    except ValueError:
        return None, f'{label} must be a date in YYYY-MM-DD format'


def collection_response(queryset, request, serializer, *, search_fields=(), filters=None,
                        ordering_fields=(), default_ordering=None):
    filters = filters or {}
    for parameter, field in filters.items():
        value = request.GET.get(parameter)
        if value is not None:
            queryset = queryset.filter(**{field: value})

    search = request.GET.get('search', '').strip()
    if search and search_fields:
        condition = Q()
        for field in search_fields:
            condition |= Q(**{f'{field}__icontains': search})
        queryset = queryset.filter(condition)

    ordering = request.GET.get('ordering')
    if ordering:
        descending = ordering.startswith('-')
        field = ordering[1:] if descending else ordering
        mapped = ordering_fields.get(field)
        if not mapped:
            return JsonResponse({'error': 'Unsupported ordering field'}, status=400)
        queryset = queryset.order_by(f'-{mapped}' if descending else mapped)
    elif default_ordering:
        queryset = queryset.order_by(*default_ordering)

    try:
        page_number = int(request.GET.get('page', '1'))
        page_size = int(request.GET.get('page_size', '25'))
    except ValueError:
        return JsonResponse({'error': 'page and page_size must be positive integers'}, status=400)
    if page_number < 1 or page_size < 1:
        return JsonResponse({'error': 'page and page_size must be positive integers'}, status=400)
    page_size = min(page_size, 100)

    paginator = Paginator(queryset, page_size)
    try:
        page = paginator.page(page_number)
    except EmptyPage:
        return JsonResponse({'error': 'Requested page is out of range'}, status=400)
    return JsonResponse({
        'count': paginator.count,
        'next': page.next_page_number() if page.has_next() else None,
        'previous': page.previous_page_number() if page.has_previous() else None,
        'results': [serializer(item) for item in page.object_list],
    })
