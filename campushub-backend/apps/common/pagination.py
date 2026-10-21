from django.core.paginator import Paginator
from django.http import JsonResponse

def paginate_queryset(queryset, request, serializer_func=None):
    """
    Paginates a queryset and returns a JsonResponse with the standard envelope:
    {count, next, previous, results}
    Supports ?page= and ?page_size= (capped at 100).
    """
    page = request.GET.get('page', 1)
    page_size = request.GET.get('page_size', 20)
    
    try:
        page_size = int(page_size)
        if page_size > 100: page_size = 100
        if page_size < 1: page_size = 20
    except ValueError:
        page_size = 20
        
    paginator = Paginator(queryset, page_size)
    
    try:
        page_obj = paginator.page(page)
    except:
        page_obj = paginator.page(1)
        
    if serializer_func:
        results = [serializer_func(obj) for obj in page_obj.object_list]
    else:
        # If no serializer provided, fall back to .values() (must be called before pagination ideally, but works for simple dicts)
        results = list(page_obj.object_list.values())
        
    return JsonResponse({
        'count': paginator.count,
        'next': page_obj.next_page_number() if page_obj.has_next() else None,
        'previous': page_obj.previous_page_number() if page_obj.has_previous() else None,
        'results': results
    })
