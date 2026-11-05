from django.db import migrations, models


def reconcile_assignment_attachment(apps, schema_editor):
    connection = schema_editor.connection
    Assignment = apps.get_model('academics', 'Assignment')
    table = Assignment._meta.db_table
    columns = [col.name for col in connection.introspection.get_table_description(connection.cursor(), table)]

    if 'attachment' in columns:
        if connection.vendor == 'postgresql':
            with connection.cursor() as cursor:
                cursor.execute(
                    f'ALTER TABLE {schema_editor.quote_name(table)} ALTER COLUMN attachment DROP NOT NULL;'
                )
    else:
        field = models.FileField(upload_to='assignments/%Y/%m/', null=True, blank=True)
        field.set_attributes_from_name('attachment')
        schema_editor.add_field(Assignment, field)


class Migration(migrations.Migration):
    dependencies = [
        ('academics', '0016_drop_legacy_assignment_course_unit_requirement'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='assignment',
                    name='attachment',
                    field=models.FileField(blank=True, null=True, upload_to='assignments/%Y/%m/'),
                ),
            ],
            database_operations=[
                migrations.RunPython(
                    reconcile_assignment_attachment,
                    migrations.RunPython.noop,
                ),
            ],
        ),
    ]

