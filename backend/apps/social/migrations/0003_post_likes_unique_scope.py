"""
Replace post_likes.uq_post_like (post_id, user_id) with a scope-aware unique index.

MySQL previously enforced one like per (post, user). Share-card likes need the same user to
like (post, share_id=NULL) for the original AND (post, share_id=<share>) for a repost.

Uses a STORED generated column so NULL share_id maps to '' for uniqueness (one root like per user).
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("social", "0002_playbackhistory_commentlike"),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                # Add replacement unique index first so FK on post_id keeps a usable index; then drop old unique.
                """ALTER TABLE `post_likes`
                   ADD COLUMN `like_share_scope` VARCHAR(26)
                   GENERATED ALWAYS AS (COALESCE(`share_id`, '')) STORED""",
                """ALTER TABLE `post_likes`
                   ADD UNIQUE INDEX `uq_post_like_scope` (`post_id`, `user_id`, `like_share_scope`)""",
                "ALTER TABLE `post_likes` DROP INDEX `uq_post_like`",
            ],
            reverse_sql=[
                "ALTER TABLE `post_likes` ADD UNIQUE INDEX `uq_post_like` (`post_id`, `user_id`)",
                "ALTER TABLE `post_likes` DROP INDEX `uq_post_like_scope`",
                "ALTER TABLE `post_likes` DROP COLUMN `like_share_scope`",
            ],
        ),
    ]
