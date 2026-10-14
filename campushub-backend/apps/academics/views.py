from django.http import JsonResponse
from django.views import View
from .models import Course  # Assuming you have a Course model
from apps.accounts.utils import api_login_required

class CourseListView(View):
    def get(self, request):
        # .values() instantly formats database data into standard Python dictionaries
        courses = list(Course.objects.values('id', 'title', 'course_code', 'credits'))
        return JsonResponse({'status': 'success', 'data': courses}, status=200)

    def post(self, request):
        import json
        try:
            # Parse raw JSON from the incoming request body
            data = json.loads(request.body)

            # Use standard Django ORM to create records
            course = Course.objects.create(
                title=data['title'],
                course_code=data['course_code'],
                credits=data.get('credits', 3)
            )
            return JsonResponse({'status': 'created', 'id': course.id}, status=201)
        except (json.JSONDecodeError, KeyError):
            return JsonResponse({'status': 'error', 'message': 'Invalid payload data'}, status=400)



@api_login_required
def protected_course_list(request):
    if request.method == 'GET':
        # This code will only execute if a user is logged in
        data = {
            'status': 'success',
            'courses': [
                {'id': 1, 'name': 'Computer Science 101', 'code': 'CS101'},
                {'id': 2, 'name': 'Database Systems', 'code': 'CS202'}
            ]
        }
        return JsonResponse(data, status=200)
