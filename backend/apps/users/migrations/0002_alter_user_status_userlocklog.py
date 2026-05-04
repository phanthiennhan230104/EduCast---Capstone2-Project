import apps.users.models
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='status',
            field=models.CharField(choices=[('active', 'Active'), ('inactive', 'Inactive'), ('locked', 'Locked'), ('suspended', 'Suspended'), ('banned', 'Banned')], default='active', max_length=20),
        ),
        migrations.CreateModel(
            name='UserLockLog',
            fields=[
                ('id', models.CharField(default=apps.users.models.generate_id, editable=False, max_length=26, primary_key=True, serialize=False)),
                ('reason', models.TextField()),
                ('lock_type', models.CharField(choices=[('temporary', 'Temporary'), ('permanent', 'Permanent')], default='temporary', max_length=20)),
                ('locked_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('locked_until', models.DateTimeField(blank=True, null=True)),
                ('unlocked_at', models.DateTimeField(blank=True, null=True)),
                ('unlock_reason', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('locked_by', models.ForeignKey(db_column='locked_by_id', on_delete=django.db.models.deletion.RESTRICT, related_name='created_lock_logs', to=settings.AUTH_USER_MODEL)),
                ('unlocked_by', models.ForeignKey(blank=True, db_column='unlocked_by_id', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='resolved_lock_logs', to=settings.AUTH_USER_MODEL)),
                ('user', models.ForeignKey(db_column='user_id', on_delete=django.db.models.deletion.CASCADE, related_name='lock_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'user_lock_logs',
                'ordering': ['-locked_at', '-created_at'],
            },
        ),
    ]
