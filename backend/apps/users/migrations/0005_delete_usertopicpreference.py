from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_alter_usertagpreference_tag'),
    ]

    operations = [
        migrations.DeleteModel(
            name='UserTopicPreference',
        ),
    ]
