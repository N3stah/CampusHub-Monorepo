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


class Assignment(models.Model):
    offering = models.ForeignKey(Offering, on_delete=models.CASCADE, related_name='assignments')
    title = models.CharField(max_length=200)
    instructions = models.TextField(blank=True)
    assignment_type = models.CharField(max_length=10, choices=[('file', 'file'), ('quiz', 'quiz')])
    allowed_file_types = models.JSONField(default=list, blank=True)
    due_at = models.DateTimeField()
    max_points = models.IntegerField()
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.offering.unit.code})"


class AssignmentQuestion(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='questions')
    prompt = models.TextField()
    options = models.JSONField(default=list)
    correct_option = models.IntegerField(null=True, blank=True)  # index into options; NEVER serialize this field back to students

    def __str__(self):
        return f"Question for {self.assignment.title}"


class AssignmentSubmission(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assignment_submissions')
    file = models.FileField(upload_to='submissions/%Y/%m/', null=True, blank=True)
    answers = models.JSONField(default=dict, blank=True)  # {question_id: selected_option_index} for quiz type
    submitted_at = models.DateTimeField(auto_now_add=True)
    score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    feedback = models.TextField(blank=True)
    released_at = models.DateTimeField(null=True, blank=True)
    graded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['assignment', 'student'], name='one_submission_per_student_per_assignment'),
        ]

    def __str__(self):
        return f"{self.student.email} - {self.assignment.title}"


class GroupSet(models.Model):
    offering = models.OneToOneField(Offering, on_delete=models.CASCADE, related_name='group_set')
    naming_scheme = models.CharField(max_length=10, choices=[('letters', 'letters'), ('numbers', 'numbers')])
    students_per_group = models.IntegerField()

    def __str__(self):
        return f"GroupSet for {self.offering.unit.code}"


class StudentGroup(models.Model):
    group_set = models.ForeignKey(GroupSet, on_delete=models.CASCADE, related_name='groups')
    name = models.CharField(max_length=10)  # "A".."G" or "1".."10"
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='study_groups')

    def __str__(self):
        return f"Group {self.name} ({self.group_set.offering.unit.code})"
