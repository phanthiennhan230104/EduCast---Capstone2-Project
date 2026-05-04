from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Comment',
            fields=[
                ('id', models.CharField(max_length=26, primary_key=True, serialize=False)),
                ('content', models.TextField()),
                ('status', models.CharField(choices=[('active', 'Active'), ('hidden', 'Hidden'), ('deleted', 'Deleted')], default='active', max_length=20)),
                ('created_at', models.DateTimeField()),
                ('updated_at', models.DateTimeField()),
            ],
            options={
                'db_table': 'comments',
                'ordering': ['-created_at'],
                'managed': False,
            },
        ),
        migrations.CreateModel(
            name='Follow',
            fields=[
                ('id', models.CharField(max_length=26, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField()),
            ],
            options={
                'db_table': 'follows',
                'ordering': ['-created_at'],
                'managed': False,
            },
        ),
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.CharField(max_length=26, primary_key=True, serialize=False)),
                ('type', models.CharField(choices=[('like', 'Like'), ('comment', 'Comment'), ('follow', 'Follow'), ('message', 'Message'), ('system', 'System'), ('report_update', 'Report Update'), ('new_post', 'New Post')], max_length=20)),
                ('title', models.CharField(max_length=255)),
                ('body', models.TextField(blank=True, null=True)),
                ('reference_type', models.CharField(blank=True, max_length=50, null=True)),
                ('reference_id', models.CharField(blank=True, max_length=26, null=True)),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField()),
            ],
            options={
                'db_table': 'notifications',
                'ordering': ['-created_at'],
                'managed': False,
            },
        ),
        migrations.CreateModel(
            name='PostLike',
            fields=[
                ('id', models.CharField(max_length=26, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField()),
            ],
            options={
                'db_table': 'post_likes',
                'ordering': ['-created_at'],
                'managed': False,
            },
        ),
        migrations.CreateModel(
            name='PostShare',
            fields=[
                ('id', models.CharField(max_length=26, primary_key=True, serialize=False)),
                ('share_type', models.CharField(choices=[('copy_link', 'Copy Link'), ('facebook', 'Facebook'), ('messenger', 'Messenger'), ('zalo', 'Zalo'), ('other', 'Other')], default='copy_link', max_length=20)),
                ('created_at', models.DateTimeField()),
            ],
            options={
                'db_table': 'post_shares',
                'ordering': ['-created_at'],
                'managed': False,
            },
        ),
        migrations.CreateModel(
            name='SavedPost',
            fields=[
                ('id', models.CharField(max_length=26, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField()),
            ],
            options={
                'db_table': 'saved_posts',
                'ordering': ['-created_at'],
                'managed': False,
            },
        ),
    ]
