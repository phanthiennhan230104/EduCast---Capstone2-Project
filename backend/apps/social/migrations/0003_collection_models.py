from django.db import migrations
from django.db import connection


def create_tables(apps, schema_editor):
    """Create collections and collection_posts tables"""
    with connection.cursor() as cursor:
        # Create collections table
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'collections')
            BEGIN
                CREATE TABLE collections (
                    id CHAR(26) PRIMARY KEY,
                    user_id CHAR(26) NOT NULL,
                    name NVARCHAR(100) NOT NULL,
                    description NVARCHAR(MAX),
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(user_id, name)
                )
            END
        """)
        
        # Create collection_posts table
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'collection_posts')
            BEGIN
                CREATE TABLE collection_posts (
                    id CHAR(26) PRIMARY KEY,
                    collection_id CHAR(26) NOT NULL,
                    post_id CHAR(26) NOT NULL,
                    added_at DATETIME NOT NULL,
                    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
                    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                    UNIQUE(collection_id, post_id)
                )
            END
        """)
        
        # Add collection_id column to saved_posts if not exists
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                          WHERE TABLE_NAME = 'saved_posts' AND COLUMN_NAME = 'collection_id')
            BEGIN
                ALTER TABLE saved_posts ADD collection_id CHAR(26) NULL
                ALTER TABLE saved_posts ADD CONSTRAINT FK_saved_posts_collection 
                    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL
            END
        """)


def drop_tables(apps, schema_editor):
    """Drop collections and collection_posts tables"""
    with connection.cursor() as cursor:
        # Drop foreign key from saved_posts
        cursor.execute("""
            IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                      WHERE TABLE_NAME = 'saved_posts' AND COLUMN_NAME = 'collection_id')
            BEGIN
                ALTER TABLE saved_posts DROP CONSTRAINT FK_saved_posts_collection
                ALTER TABLE saved_posts DROP COLUMN collection_id
            END
        """)
        
        # Drop tables
        cursor.execute("DROP TABLE IF EXISTS collection_posts")
        cursor.execute("DROP TABLE IF EXISTS collections")


class Migration(migrations.Migration):

    dependencies = [
        ('social', '0002_playbackhistory_commentlike'),
    ]

    operations = [
        migrations.RunPython(create_tables, drop_tables),
    ]