from django.contrib import admin
from .models import Department, Course, Enrollment, School, Unit, Offering, UnitTeachingAssignment, ClassSession, Assignment, AssignmentQuestion, AssignmentSubmission, GroupSet, StudentGroup

admin.site.register(Department)
admin.site.register(Course)
admin.site.register(Enrollment)
admin.site.register(School)
admin.site.register(Unit)
admin.site.register(Offering)
admin.site.register(UnitTeachingAssignment)
admin.site.register(ClassSession)
admin.site.register(Assignment)
admin.site.register(AssignmentQuestion)
admin.site.register(AssignmentSubmission)

admin.site.register(GroupSet)
admin.site.register(StudentGroup)
