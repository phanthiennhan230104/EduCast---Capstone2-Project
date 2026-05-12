from django.db import models


class Topic(models.Model):
    id = models.CharField(max_length=26, primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    slug = models.CharField(max_length=120, unique=True)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField()

    class Meta:
        db_table = "topics"
        managed = False

    def __str__(self):
        return self.name


class Tag(models.Model):
    id = models.CharField(max_length=26, primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    slug = models.CharField(max_length=120, unique=True)
    created_at = models.DateTimeField()

    class Meta:
        db_table = "tags"
        managed = False

    def __str__(self):
        return self.name


class Post(models.Model):
    class VisibilityChoices(models.TextChoices):
        PUBLIC = "public", "Public"
        PRIVATE = "private", "Private"
        UNLISTED = "unlisted", "Unlisted"

    class SourceTypeChoices(models.TextChoices):
        MANUAL = "manual", "Manual"
        UPLOADED_DOCUMENT = "uploaded_document", "Uploaded Document"
        AI_GENERATED = "ai_generated", "AI Generated"

    class StatusChoices(models.TextChoices):
        DRAFT = "draft", "Draft"
        PROCESSING = "processing", "Processing"
        PUBLISHED = "published", "Published"
        FAILED = "failed", "Failed"
        ARCHIVED = "archived", "Archived"
        HIDDEN = "hidden", "Hidden"

    id = models.CharField(max_length=26, primary_key=True)
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        db_column="user_id",
        related_name="posts",
    )
    title = models.CharField(max_length=255)
    slug = models.CharField(max_length=255, unique=True)
    description = models.TextField(null=True, blank=True)
    original_text = models.TextField(null=True, blank=True)
    summary_text = models.TextField(null=True, blank=True)
    dialogue_script = models.TextField(null=True, blank=True)
    transcript_text = models.TextField(null=True, blank=True)
    source_type = models.CharField(
        max_length=20,
        choices=SourceTypeChoices.choices,
        default=SourceTypeChoices.MANUAL,
    )
    is_ai_generated = models.BooleanField(default=False)
    language_code = models.CharField(max_length=10, default="vi")
    visibility = models.CharField(
        max_length=20,
        choices=VisibilityChoices.choices,
        default=VisibilityChoices.PUBLIC,
    )
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.DRAFT,
    )
    learning_field = models.CharField(max_length=100, null=True, blank=True)
    audio_url = models.CharField(max_length=500, null=True, blank=True)
    thumbnail_url = models.CharField(max_length=500, null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)
    download_count = models.IntegerField(default=0)
    view_count = models.IntegerField(default=0)
    listen_count = models.IntegerField(default=0)
    like_count = models.IntegerField(default=0)
    comment_count = models.IntegerField(default=0)
    save_count = models.IntegerField(default=0)
    share_count = models.IntegerField(default=0)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "posts"
        managed = False

    def __str__(self):
        return self.title


class PostTopic(models.Model):
    post = models.ForeignKey(
        "content.Post",
        on_delete=models.CASCADE,
        db_column="post_id",
        related_name="post_topics",
        primary_key=True,
    )
    topic = models.ForeignKey(
        "content.Topic",
        on_delete=models.CASCADE,
        db_column="topic_id",
        related_name="topic_posts",
    )
    created_at = models.DateTimeField()

    class Meta:
        db_table = "post_topics"
        managed = False
        unique_together = ("post", "topic")

    def __str__(self):
        return f"{self.post.id} - {self.topic.id}"


class PostTag(models.Model):
    post = models.ForeignKey(
        "content.Post",
        on_delete=models.CASCADE,
        db_column="post_id",
        related_name="post_tags",
        primary_key=True,
    )
    tag = models.ForeignKey(
        "content.Tag",
        on_delete=models.CASCADE,
        db_column="tag_id",
        related_name="tag_posts",
    )
    created_at = models.DateTimeField()

    class Meta:
        db_table = "post_tags"
        managed = False
        unique_together = ("post", "tag")

    def __str__(self):
        return f"{self.post.id} - {self.tag.id}"


class PostAudioVersion(models.Model):
    id = models.CharField(max_length=26, primary_key=True)
    post = models.ForeignKey(
        "content.Post",
        on_delete=models.CASCADE,
        db_column="post_id",
        related_name="audio_versions",
    )
    voice_name = models.CharField(max_length=100)
    format = models.CharField(max_length=20, default="mp3")
    bitrate_kbps = models.IntegerField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)
    audio_url = models.CharField(max_length=500)
    storage_path = models.CharField(max_length=500, null=True, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField()

    class Meta:
        db_table = "post_audio_versions"
        managed = False

    def __str__(self):
        return f"{self.post.id} - {self.voice_name}"


class PostDocument(models.Model):
    id = models.CharField(max_length=26, primary_key=True)
    post = models.ForeignKey(
        "content.Post",
        on_delete=models.CASCADE,
        db_column="post_id",
        related_name="documents",
    )
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=50)
    file_size = models.BigIntegerField()
    document_url = models.CharField(max_length=500)
    storage_path = models.CharField(max_length=500, null=True, blank=True)
    uploaded_at = models.DateTimeField()

    class Meta:
        db_table = "post_documents"
        managed = False

    def __str__(self):
        return self.file_name