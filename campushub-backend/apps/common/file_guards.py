from django.http import JsonResponse

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp']


def validate_image_upload(uploaded_file):
    """Validate an uploaded image file. Returns JsonResponse on error, None on success."""
    if not uploaded_file:
        return JsonResponse({'error': 'No file provided'}, status=400)
    if uploaded_file.size > MAX_FILE_SIZE:
        return JsonResponse({'error': 'File size exceeds 10MB limit'}, status=400)
    ext = uploaded_file.name.rsplit('.', 1)[-1].lower() if '.' in uploaded_file.name else ''
    if ext not in ALLOWED_IMAGE_TYPES:
        return JsonResponse({'error': f'File type not allowed. Accepted: {", ".join(ALLOWED_IMAGE_TYPES)}'}, status=400)
    return None
