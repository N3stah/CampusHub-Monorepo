from django.db import migrations


def preserve_release_dates(apps, schema_editor):
    connection = schema_editor.connection
    table = 'academics_assignmentsubmission'
    with connection.cursor() as cursor:
        if table not in connection.introspection.table_names(cursor):
            return
        columns = {
            column.name
            for column in connection.introspection.get_table_description(cursor, table)
        }
        if not {'grade_released', 'released_at', 'graded_at'}.issubset(columns):
            return
        cursor.execute(
            '''
            UPDATE academics_assignmentsubmission
            SET released_at = graded_at
            WHERE grade_released IS TRUE
              AND released_at IS NULL
              AND graded_at IS NOT NULL
            '''
        )


class Migration(migrations.Migration):
    dependencies = [
        ('academics', '0012_reconcile_legacy_database_schema'),
    ]

    operations = [
        migrations.RunPython(preserve_release_dates, migrations.RunPython.noop),
    ]
