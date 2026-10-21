from django.core.exceptions import ValidationError
from datetime import date

def deadline_must_be_future(value):
    if value <= date.today():
        raise ValidationError('Deadline must be a future date.')
