from django.contrib.auth import get_user_model
from django.db.models import Q
from .models import Offering, Unit

User = get_user_model()


def student_unit_ids(user):
    return Unit.objects.filter(
        registrations__student=user,
        registrations__status='registered',
        registrations__academic_period__status='active',
        registrations__unit__is_active=True,
        registrations__unit__offerings__is_active=True,
        registrations__unit__offerings__course__is_active=True,
        registrations__unit__offerings__course__enrollments__student=user,
        registrations__unit__offerings__course__enrollments__status='active',
    ).filter(
        Q(registrations__unit__offerings__period__isnull=True)
        | Q(registrations__unit__offerings__period__status='active')
    ).values_list('id', flat=True).distinct()


def student_has_offering_access(user, offering_id):
    return student_unit_offering_ids(user).filter(pk=offering_id).exists()


def unit_offering_ids(unit_id):
    return unit_offering_ids_for_units([unit_id])


def student_unit_offering_ids(user, unit_id=None):
    units = student_unit_ids(user)
    if unit_id is not None:
        units = units.filter(pk=unit_id)
    return unit_offering_ids_for_units(units)


def unit_offering_ids_for_units(units):
    return Offering.objects.filter(
        unit_id__in=units,
        is_active=True,
        course__is_active=True,
    ).filter(
        Q(period__isnull=True) | Q(period__status='active')
    ).values_list('id', flat=True)


def student_ids_for_unit(unit_id):
    return User.objects.filter(
        role='student',
        is_active=True,
        unit_registrations__unit_id=unit_id,
        unit_registrations__unit__is_active=True,
        unit_registrations__status='registered',
        unit_registrations__academic_period__status='active',
        enrollments__status='active',
        enrollments__course__offerings__unit_id=unit_id,
        enrollments__course__offerings__is_active=True,
        enrollments__course__is_active=True,
    ).filter(
        Q(enrollments__course__offerings__period__isnull=True)
        | Q(enrollments__course__offerings__period__status='active')
    ).values_list('id', flat=True).distinct()
