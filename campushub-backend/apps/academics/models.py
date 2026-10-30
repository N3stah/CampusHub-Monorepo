from django.db import models
from django.conf import settings

class School(models.Model):
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=10, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.code} - {self.name}"

class Department(models.Model):
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=10, unique=True)
    school = models.ForeignKey(
        School,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='departments'
    )
    head = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='headed_departments'
    )

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.code} - {self.name}"

class Course(models.Model):
    title = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='courses')
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='taught_courses'
    )
    credits = models.IntegerField(default=3)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f"{self.code}: {self.title}"

class Unit(models.Model):
    code = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=200)
    credits = models.IntegerField(default=3)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    departments = models.ManyToManyField(Department, related_name='units', blank=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f"{self.code}: {self.title}"

class Offering(models.Model):
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name='offerings')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='offerings')
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['unit', 'course'], name='unique_unit_course_offering'),
        ]

    def __str__(self):
        return f"{self.unit.code} - {self.course.code}"

class UnitTeachingAssignment(models.Model):
    offering = models.ForeignKey(Offering, on_delete=models.CASCADE, related_name='teaching_assignments')
    lecturer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='unit_assignments')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['offering', 'lecturer'], name='unique_offering_lecturer'),
        ]

    def __str__(self):
        return f"{self.lecturer.email} - {self.offering.unit.code}"

class Enrollment(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('dropped', 'Dropped'),
        ('completed', 'Completed'),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='enrollments'
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='enrollments'
    )
    enrolled_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    class Meta:
        # Removed unique_together to allow re-enrollment after dropping, and to support the one-active-programme rule
        constraints = [
            models.UniqueConstraint(
                fields=['student'],
                condition=models.Q(status='active'),
                name='one_active_enrollment_per_student',
            ),
        ]
        indexes = [
            models.Index(fields=['course', 'status']),
        ]

    def __str__(self):
        return f"{self.student.email} - {self.course.code}"


class ClassSession(models.Model):
    offering = models.ForeignKey(Offering, on_delete=models.CASCADE, related_name='sessions')
    day_of_week = models.IntegerField()  # 0=Monday .. 6=Sunday
    start_time = models.TimeField()
    end_time = models.TimeField()
    starts_on = models.DateField()
    ends_on = models.DateField()
    location = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['day_of_week', 'start_time']

    def __str__(self):
        return f"{self.offering.unit.code} - Day {self.day_of_week} at {self.start_time}"
