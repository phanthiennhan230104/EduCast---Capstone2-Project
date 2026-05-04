import apps.users.models
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.CharField(default=apps.users.models.generate_id, editable=False, max_length=26, primary_key=True, serialize=False)),
                ('email', models.EmailField(max_length=255, unique=True)),
                ('username', models.CharField(max_length=100, unique=True)),
                ('password_hash', models.CharField(max_length=255)),
                ('role', models.CharField(choices=[('user', 'User'), ('admin', 'Admin')], default='user', max_length=20)),
                ('status', models.CharField(choices=[('active', 'Active'), ('inactive', 'Inactive'), ('suspended', 'Suspended'), ('banned', 'Banned')], default='active', max_length=20)),
                ('auth_provider', models.CharField(choices=[('local', 'Local'), ('google', 'Google'), ('facebook', 'Facebook')], default='local', max_length=20)),
                ('is_verified', models.BooleanField(default=False)),
                ('last_login_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'users',
            },
        ),
        migrations.CreateModel(
            name='RefreshToken',
            fields=[
                ('id', models.CharField(default=apps.users.models.generate_id, editable=False, max_length=26, primary_key=True, serialize=False)),
                ('token_hash', models.CharField(max_length=255)),
                ('expires_at', models.DateTimeField()),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='refresh_tokens', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'refresh_tokens',
            },
        ),
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.CharField(default=apps.users.models.generate_id, editable=False, max_length=26, primary_key=True, serialize=False)),
                ('display_name', models.CharField(max_length=150)),
                ('bio', models.TextField(blank=True, null=True)),
                ('avatar_url', models.URLField(blank=True, max_length=500, null=True)),
                ('cover_url', models.URLField(blank=True, max_length=500, null=True)),
                ('headline', models.CharField(blank=True, max_length=255, null=True)),
                ('age_group', models.CharField(blank=True, choices=[('16_22', '16_22'), ('23_30', '23_30'), ('31_40', '31_40')], max_length=20, null=True)),
                ('learning_field', models.CharField(blank=True, max_length=100, null=True)),
                ('interests', models.JSONField(blank=True, null=True)),
                ('preferred_language', models.CharField(default='vi', max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='profile', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'user_profiles',
            },
        ),
        migrations.CreateModel(
            name='UserSettings',
            fields=[
                ('id', models.CharField(default=apps.users.models.generate_id, editable=False, max_length=26, primary_key=True, serialize=False)),
                ('email_notifications', models.BooleanField(default=True)),
                ('push_notifications', models.BooleanField(default=True)),
                ('notify_likes', models.BooleanField(default=True)),
                ('notify_comments', models.BooleanField(default=True)),
                ('notify_follows', models.BooleanField(default=True)),
                ('notify_messages', models.BooleanField(default=True)),
                ('profile_visibility', models.CharField(choices=[('public', 'Public'), ('followers_only', 'Followers Only'), ('private', 'Private')], default='public', max_length=30)),
                ('allow_messages_from', models.CharField(choices=[('everyone', 'Everyone'), ('followers_only', 'Followers Only'), ('nobody', 'Nobody')], default='everyone', max_length=30)),
                ('autoplay_audio', models.BooleanField(default=True)),
                ('theme_mode', models.CharField(choices=[('light', 'Light'), ('dark', 'Dark'), ('system', 'System')], default='dark', max_length=20)),
                ('language_code', models.CharField(default='vi', max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='settings', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'user_settings',
            },
        ),
    ]
