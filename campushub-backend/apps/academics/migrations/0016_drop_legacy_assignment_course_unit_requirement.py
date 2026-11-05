from django.db import migrations


def drop_legacy_assignment_course_unit_requirement(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor != 'postgresql':
        return

    columns = connection.introspection.get_table_description(
        connection.cursor(),
        'academics_assignment',
    )
    if not any(column.name == 'course_unit_id' for column in columns):
        return

    with connection.cursor() as cursor:
        cursor.execute(
            '''
            ALTER TABLE academics_assignment
            ALTER COLUMN course_unit_id DROP NOT NULL;
            '''
        )


class Migration(migrations.Migration):
    dependencies = [
        ('academics', '0015_merge_20261105_0908'),
    ]

    operations = [
        migrations.RunPython(
            drop_legacy_assignment_course_unit_requirement,
            migrations.RunPython.noop,
        ),
    ]
