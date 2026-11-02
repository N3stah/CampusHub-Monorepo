import copy

from django.core.management.color import no_style
from django.db import migrations


def _tables(connection):
    with connection.cursor() as cursor:
        return set(connection.introspection.table_names(cursor))


def _columns(connection, table):
    with connection.cursor() as cursor:
        return {
            column.name
            for column in connection.introspection.get_table_description(cursor, table)
        }


def _ensure_model_table(apps, schema_editor, app_label, model_name):
    model = apps.get_model(app_label, model_name)
    if model._meta.db_table not in _tables(schema_editor.connection):
        schema_editor.create_model(model)
    return model


def _ensure_field(apps, schema_editor, app_label, model_name, field_name, nullable=False):
    model = apps.get_model(app_label, model_name)
    field = model._meta.get_field(field_name)
    if field.column in _columns(schema_editor.connection, model._meta.db_table):
        return model, field, field

    field_to_add = copy.copy(field)
    field_to_add.model = model
    if nullable and not field.null:
        field_to_add.null = True
    schema_editor.add_field(model, field_to_add)
    return model, field_to_add, field


def _ensure_offerings(apps, schema_editor):
    connection = schema_editor.connection
    tables = _tables(connection)
    offering = _ensure_model_table(apps, schema_editor, 'academics', 'Offering')
    if 'academics_courseunit' not in tables:
        if 'academics_offering' in tables:
            return offering
        raise RuntimeError(
            'Cannot reconcile the academic schema: academics_courseunit is missing, '
            'so existing course-unit data cannot be mapped to offerings.'
        )

    with connection.cursor() as cursor:
        cursor.execute(
            '''
            INSERT INTO academics_offering (unit_id, course_id, is_active)
            SELECT unit_id, course_id, TRUE
            FROM academics_courseunit
            ON CONFLICT (unit_id, course_id) DO NOTHING
            '''
        )
    return offering


def _ensure_offering_field(apps, schema_editor, app_label, model_name):
    connection = schema_editor.connection
    model, temporary_field, final_field = _ensure_field(
        apps, schema_editor, app_label, model_name, 'offering', nullable=True
    )
    table = model._meta.db_table
    columns = _columns(connection, table)

    if 'course_unit_id' in columns:
        quoted_table = schema_editor.quote_name(table)
        with connection.cursor() as cursor:
            cursor.execute(
                f'''
                UPDATE {quoted_table} AS target
                SET offering_id = offering.id
                FROM academics_courseunit AS course_unit
                JOIN academics_offering AS offering
                  ON offering.unit_id = course_unit.unit_id
                 AND offering.course_id = course_unit.course_id
                WHERE target.course_unit_id = course_unit.id
                  AND target.offering_id IS NULL
                '''
            )

    if not final_field.null:
        with connection.cursor() as cursor:
            cursor.execute(
                f'SELECT COUNT(*) FROM {schema_editor.quote_name(table)} '
                'WHERE offering_id IS NULL'
            )
            missing = cursor.fetchone()[0]
        if missing:
            raise RuntimeError(
                f'Cannot reconcile {table}: {missing} row(s) have no matching offering.'
            )
        if temporary_field.null:
            schema_editor.alter_field(model, temporary_field, final_field)


def _rename_column_if_needed(connection, schema_editor, table, old_name, new_name):
    columns = _columns(connection, table)
    if new_name in columns or old_name not in columns:
        return
    with connection.cursor() as cursor:
        cursor.execute(
            f'ALTER TABLE {schema_editor.quote_name(table)} '
            f'RENAME COLUMN {schema_editor.quote_name(old_name)} '
            f'TO {schema_editor.quote_name(new_name)}'
        )


def _copy_legacy_lessons(apps, schema_editor):
    connection = schema_editor.connection
    tables = _tables(connection)
    lesson = _ensure_model_table(apps, schema_editor, 'academics', 'Lesson')
    if 'academics_unitlesson' not in tables:
        return

    table = schema_editor.quote_name(lesson._meta.db_table)
    with connection.cursor() as cursor:
        cursor.execute(
            f'''
            INSERT INTO {table}
                (id, title, description, scheduled_at, duration_minutes, created_at, offering_id)
            SELECT old_lesson.id, old_lesson.title, old_lesson.description,
                   old_lesson.scheduled_at, old_lesson.duration_minutes,
                   old_lesson.created_at, offering.id
            FROM academics_unitlesson AS old_lesson
            JOIN academics_courseunit AS course_unit
              ON course_unit.id = old_lesson.course_unit_id
            JOIN academics_offering AS offering
              ON offering.unit_id = course_unit.unit_id
             AND offering.course_id = course_unit.course_id
            ON CONFLICT (id) DO NOTHING
            '''
        )
    for statement in connection.ops.sequence_reset_sql(
        no_style(), [lesson]
    ):
        with connection.cursor() as cursor:
            cursor.execute(statement)


def _copy_legacy_group_memberships(apps, schema_editor):
    connection = schema_editor.connection
    tables = _tables(connection)
    student_group = apps.get_model('academics', 'StudentGroup')
    members_field = student_group._meta.get_field('members')
    through = members_field.remote_field.through

    if through._meta.db_table not in tables:
        schema_editor.create_model(through)
        tables = _tables(connection)
    if 'academics_groupmembership' not in tables:
        return

    source_field = through._meta.get_field(members_field.m2m_field_name())
    target_field = through._meta.get_field(members_field.m2m_reverse_field_name())
    table = schema_editor.quote_name(through._meta.db_table)
    source_column = schema_editor.quote_name(source_field.column)
    target_column = schema_editor.quote_name(target_field.column)
    student_table = schema_editor.quote_name(
        target_field.remote_field.model._meta.db_table
    )
    student_group_table = schema_editor.quote_name(student_group._meta.db_table)
    with connection.cursor() as cursor:
        cursor.execute(
            f'''
            INSERT INTO {table} ({source_column}, {target_column})
            SELECT group_membership.group_id, group_membership.student_id
            FROM academics_groupmembership AS group_membership
            JOIN {student_group_table} AS student_group
              ON student_group.id = group_membership.group_id
            JOIN {student_table} AS student
              ON student.id = group_membership.student_id
            ON CONFLICT DO NOTHING
            '''
        )


def reconcile_legacy_schema(apps, schema_editor):
    connection = schema_editor.connection
    tables = _tables(connection)

    _ensure_offerings(apps, schema_editor)
    _ensure_model_table(apps, schema_editor, 'academics', 'UnitTeachingAssignment')

    for app_label, model_name in (
        ('academics', 'ClassSession'),
        ('academics', 'Assignment'),
        ('academics', 'GroupSet'),
        ('resources', 'Resource'),
        ('resources', 'Announcement'),
    ):
        _ensure_offering_field(apps, schema_editor, app_label, model_name)

    _ensure_field(
        apps, schema_editor, 'academics', 'School', 'is_active'
    )
    _ensure_field(apps, schema_editor, 'academics', 'School', 'created_at')
    _ensure_field(
        apps, schema_editor, 'academics', 'AssignmentSubmission', 'released_at'
    )

    attendance_table = 'academics_attendancerecord'
    if attendance_table in tables:
        for old_name, new_name in (
            ('class_session_id', 'session_id'),
            ('attendance_date', 'date'),
            ('marked_at', 'recorded_at'),
            ('marked_by_id', 'recorded_by_id'),
        ):
            _rename_column_if_needed(
                connection, schema_editor, attendance_table, old_name, new_name
            )

    _ensure_field(apps, schema_editor, 'resources', 'Announcement', 'scheduled_for')
    _ensure_field(apps, schema_editor, 'resources', 'Announcement', 'dispatched_at')
    announcement, group_field, _ = _ensure_field(
        apps, schema_editor, 'resources', 'Announcement', 'group'
    )
    announcement_columns = _columns(connection, announcement._meta.db_table)
    if 'target_group_id' in announcement_columns:
        with connection.cursor() as cursor:
            cursor.execute(
                '''
                UPDATE resources_announcement
                SET group_id = target_group_id
                WHERE group_id IS NULL
                  AND target_group_id IN (SELECT id FROM academics_studentgroup)
                '''
            )
    with connection.cursor() as cursor:
        if 'publish_at' in announcement_columns:
            cursor.execute(
                '''
                UPDATE resources_announcement
                SET scheduled_for = publish_at
                WHERE scheduled_for IS NULL
                  AND publish_at IS NOT NULL
                '''
            )
        if 'notified_at' in announcement_columns:
            cursor.execute(
                '''
                UPDATE resources_announcement
                SET dispatched_at = notified_at
                WHERE dispatched_at IS NULL
                  AND notified_at IS NOT NULL
                '''
            )

    _copy_legacy_lessons(apps, schema_editor)

    if 'academics_teachingassignment' in _tables(connection):
        with connection.cursor() as cursor:
            cursor.execute(
                '''
                INSERT INTO academics_unitteachingassignment (offering_id, lecturer_id)
                SELECT offering.id, teaching_assignment.lecturer_id
                FROM academics_teachingassignment AS teaching_assignment
                JOIN academics_courseunit AS course_unit
                  ON course_unit.id = teaching_assignment.course_unit_id
                JOIN academics_offering AS offering
                  ON offering.unit_id = course_unit.unit_id
                 AND offering.course_id = course_unit.course_id
                ON CONFLICT (offering_id, lecturer_id) DO NOTHING
                '''
            )

    _copy_legacy_group_memberships(apps, schema_editor)


class Migration(migrations.Migration):
    dependencies = [
        ('academics', '0011_attendance_record'),
        ('resources', '0005_announcement_scheduled_and_group'),
    ]

    operations = [
        migrations.RunPython(
            reconcile_legacy_schema,
            migrations.RunPython.noop,
        ),
    ]
