from django.contrib import admin
from .models import Department, Course, Enrollment, School, Unit, Offering, UnitTeachingAssignment

admin.site.register(Department)
admin.site.register(Course)
admin.site.register(Enrollment)
admin.site.register(School)
admin.site.register(Unit)
admin.site.register(Offering)
admin.site.register(UnitTeachingAssignment)
