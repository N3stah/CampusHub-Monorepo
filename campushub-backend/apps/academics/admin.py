from django.contrib import admin
from .models import Department, Course, Enrollment

admin.site.register(Department)
admin.site.register(Course)
admin.site.register(Enrollment)
