import apps.users.models
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0002_posttag_tag'),
        ('users', '0003_usertagpreference_usertopicpreference'),
    ]

    operations = [
        migrations.AlterField(
            model_name='usertagpreference',
            name='tag_id',
            field=models.ForeignKey(db_column='tag_id', on_delete=django.db.models.deletion.CASCADE, related_name='user_preferences', to='content.tag'),
        ),
        migrations.RenameField(
            model_name='usertagpreference',
            old_name='tag_id',
            new_name='tag',
        ),
        migrations.AlterUniqueTogether(
            name='usertagpreference',
            unique_together={('user', 'tag')},
        ),
    ]
