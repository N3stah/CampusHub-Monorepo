from datetime import date, timedelta

import pytest

from apps.academics.models import AcademicPeriod, Registration


@pytest.fixture
def active_period(db):
    today = date.today()
    return AcademicPeriod.objects.create(
        name='Current semester',
        start_date=today - timedelta(days=30),
        end_date=today + timedelta(days=120),
        status='active',
    )


@pytest.fixture
def register_unit(active_period):
    def register(student, unit, period=active_period):
        return Registration.objects.create(
            student=student,
            academic_period=period,
            unit=unit,
            registered_on=date.today(),
        )

    return register
