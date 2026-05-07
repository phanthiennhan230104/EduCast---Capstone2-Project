import apps.users.models
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_alter_user_status_userlocklog'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserTagPreference',
            fields=[
                ('id', models.CharField(default=apps.users.models.generate_id, editable=False, max_length=26, primary_key=True, serialize=False)),
                ('tag_id', models.CharField(db_column='tag_id', max_length=26)),
                ('score', models.FloatField(default=1.0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(db_column='user_id', on_delete=django.db.models.deletion.CASCADE, related_name='tag_preferences', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'user_tag_preferences',
                'ordering': ['-score', '-created_at'],
                'unique_together': {('user', 'tag_id')},
            },
        ),
        migrations.CreateModel(
            name='UserTopicPreference',
            fields=[
                ('id', models.CharField(default=apps.users.models.generate_id, editable=False, max_length=26, primary_key=True, serialize=False)),
                ('topic_id', models.CharField(db_column='topic_id', max_length=26)),
                ('score', models.FloatField(default=1.0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(db_column='user_id', on_delete=django.db.models.deletion.CASCADE, related_name='topic_preferences', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'user_topic_preferences',
                'ordering': ['-score', '-created_at'],
                'unique_together': {('user', 'topic_id')},
            },
        ),
    ]
