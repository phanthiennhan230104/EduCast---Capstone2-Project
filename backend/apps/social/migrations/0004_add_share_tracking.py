from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('social', '0003_collection_models'),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE post_likes ADD COLUMN share_id CHAR(26) NULL;",
            reverse_sql="",
        ),
        migrations.RunSQL(
            sql="ALTER TABLE comments ADD COLUMN share_id CHAR(26) NULL;",
            reverse_sql="",
        ),
        migrations.RunSQL(
            sql="ALTER TABLE saved_posts ADD COLUMN share_id CHAR(26) NULL;",
            reverse_sql="",
        ),
    ]
