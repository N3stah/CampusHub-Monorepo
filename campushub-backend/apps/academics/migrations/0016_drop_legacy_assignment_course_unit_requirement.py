from django.db import migrations


def drop_legacy_assignment_course_unit_requirement(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor != 'postgresql':
        return

    columns = connection.introspection.get_table_description(
        connection.cursor(),
        'academics_assignment',
    )
    column_names = {column.name for column in columns}
    legacy_columns = [
        name for name in ('course_unit_id', 'attachment')
        if name in column_names
    ]
    if not legacy_columns:
        return

    with connection.cursor() as cursor:
        for column_name in legacy_columns:
            cursor.execute(
                f'''
                ALTER TABLE academics_assignment
                ALTER COLUMN {column_name} DROP NOT NULL;
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
