import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('social', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PlaybackHistory',
            fields=[
                ('id', models.CharField(max_length=26, primary_key=True, serialize=False)),
                ('progress_seconds', models.IntegerField(default=0)),
                ('duration_seconds', models.IntegerField(default=0)),
                ('completed_ratio', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('is_completed', models.BooleanField(default=False)),
                ('last_played_at', models.DateTimeField()),
            ],
            options={
                'db_table': 'playback_history',
                'ordering': ['-last_played_at'],
                'managed': False,
            },
        ),
        migrations.CreateModel(
            name='CommentLike',
            fields=[
                ('id', models.CharField(max_length=26, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('comment', models.ForeignKey(db_column='comment_id', on_delete=django.db.models.deletion.CASCADE, related_name='comment_likes', to='social.comment')),
                ('user', models.ForeignKey(db_column='user_id', on_delete=django.db.models.deletion.CASCADE, related_name='liked_comments', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'comment_likes',
                'constraints': [models.UniqueConstraint(fields=('comment', 'user'), name='uq_comment_like')],
            },
        ),
    ]
