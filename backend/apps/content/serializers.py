from rest_framework import serializers
from .models import (
    Post,
    PostAudioVersion,
    PostDocument,
    Topic,
)


class DraftCreateSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    original_text = serializers.CharField(required=False, allow_blank=True)
    source_type = serializers.ChoiceField(
        choices=[
            Post.SourceTypeChoices.MANUAL,
            Post.SourceTypeChoices.UPLOADED_DOCUMENT,
            Post.SourceTypeChoices.AI_GENERATED,
        ],
        default=Post.SourceTypeChoices.MANUAL,
    )

    def validate(self, attrs):
        source_type = attrs.get("source_type")
        original_text = (attrs.get("original_text") or "").strip()

        if source_type == Post.SourceTypeChoices.MANUAL and not original_text:
            raise serializers.ValidationError({
                "original_text": "Vui lòng nhập nội dung."
            })

        return attrs


class AudioPreviewSerializer(serializers.Serializer):
    original_text = serializers.CharField(required=True)
    mode = serializers.ChoiceField(
        choices=["summary", "dialogue", "original", "translate"],
        default="summary",
    )
    voice_name = serializers.CharField(default="Minh Tuấn")

    def validate_original_text(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Nội dung không được để trống.")
        return value


class SaveDraftWithAudioSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    original_text = serializers.CharField(required=False, allow_blank=True)

    topic_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list
    )

    source_type = serializers.ChoiceField(
        choices=[
            Post.SourceTypeChoices.MANUAL,
            Post.SourceTypeChoices.UPLOADED_DOCUMENT,
            Post.SourceTypeChoices.AI_GENERATED,
        ],
        default=Post.SourceTypeChoices.MANUAL,
    )

    mode = serializers.ChoiceField(
        choices=["summary", "dialogue", "original", "translate"],
        default="summary",
    )
    processed_text = serializers.CharField(required=False, allow_blank=True)
    summary_text = serializers.CharField(required=False, allow_blank=True)
    dialogue_script = serializers.CharField(required=False, allow_blank=True)
    transcript_text = serializers.CharField(required=False, allow_blank=True)
    audio_url = serializers.CharField(required=True)
    public_id = serializers.CharField(required=False, allow_blank=True)
    voice_name = serializers.CharField(default="Minh Tuấn")
    format = serializers.CharField(default="mp3")
    bytes = serializers.IntegerField(required=False, allow_null=True)
    duration_seconds = serializers.IntegerField(required=False, allow_null=True)

    document_url = serializers.CharField(required=False, allow_blank=True)
    document_public_id = serializers.CharField(required=False, allow_blank=True)
    file_name = serializers.CharField(required=False, allow_blank=True)
    file_type = serializers.CharField(required=False, allow_blank=True)
    file_size = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        source_type = attrs.get("source_type")
        audio_url = (attrs.get("audio_url") or "").strip()

        if not audio_url:
            raise serializers.ValidationError({
                "audio_url": "Audio URL là bắt buộc."
            })

        if source_type == Post.SourceTypeChoices.UPLOADED_DOCUMENT:
            document_url = (attrs.get("document_url") or "").strip()
            if not document_url:
                raise serializers.ValidationError({
                    "document_url": "Thiếu thông tin tài liệu đã upload."
                })

        return attrs
    
    def validate_topic_ids(self, value):
        deduped = []
        for item in value:
            item = (item or "").strip()
            if item and item not in deduped:
                deduped.append(item)

        existing_ids = set(
            Topic.objects.filter(id__in=deduped).values_list("id", flat=True)
        )

        invalid_ids = [item for item in deduped if item not in existing_ids]
        if invalid_ids:
            raise serializers.ValidationError(
                f"Topic không tồn tại: {', '.join(invalid_ids)}"
            )

        return deduped[:5]


class PostAudioVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostAudioVersion
        fields = [
            "id",
            "voice_name",
            "format",
            "bitrate_kbps",
            "duration_seconds",
            "audio_url",
            "storage_path",
            "is_default",
            "created_at",
        ]


class PostDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostDocument
        fields = [
            "id",
            "file_name",
            "file_type",
            "file_size",
            "document_url",
            "storage_path",
            "uploaded_at",
        ]


class DraftDetailSerializer(serializers.ModelSerializer):
    audio_versions = PostAudioVersionSerializer(many=True, read_only=True)
    documents = PostDocumentSerializer(many=True, read_only=True)
    topics = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "original_text",
            "summary_text",
            "dialogue_script",
            "transcript_text",
            "source_type",
            "is_ai_generated",
            "language_code",
            "visibility",
            "status",
            "learning_field",
            "audio_url",
            "thumbnail_url",
            "duration_seconds",
            "published_at",
            "created_at",
            "updated_at",
            "audio_versions",
            "documents",
            "topics",
        ]

    def get_topics(self, obj):
        return [
            {"id": pt.topic_id, "name": pt.topic.name}
            for pt in obj.post_topics.all()
        ]


class DraftUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    original_text = serializers.CharField(required=False, allow_blank=True)

    summary_text = serializers.CharField(required=False, allow_blank=True)
    dialogue_script = serializers.CharField(required=False, allow_blank=True)
    transcript_text = serializers.CharField(required=False, allow_blank=True)

    audio_url = serializers.CharField(required=False, allow_blank=True)
    public_id = serializers.CharField(required=False, allow_blank=True)
    voice_name = serializers.CharField(required=False, allow_blank=True)
    format = serializers.CharField(required=False, allow_blank=True)
    duration_seconds = serializers.IntegerField(required=False, allow_null=True)
    
    status = serializers.ChoiceField(
        choices=[
            Post.StatusChoices.DRAFT,
            Post.StatusChoices.PROCESSING,
            Post.StatusChoices.PUBLISHED,
            Post.StatusChoices.FAILED,
            Post.StatusChoices.ARCHIVED,
            Post.StatusChoices.HIDDEN,
        ],
        required=False,
    )


class UploadDocumentSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, file):
        allowed_extensions = [".txt", ".docx", ".pdf"]
        name = file.name.lower()

        if not any(name.endswith(ext) for ext in allowed_extensions):
            raise serializers.ValidationError("Chỉ hỗ trợ file .txt, .docx, .pdf")

        if file.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("File quá lớn. Tối đa 10MB.")

        return file
    


class FeedTagSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    slug = serializers.CharField()


class FeedAuthorSerializer(serializers.Serializer):
    id = serializers.CharField()
    username = serializers.CharField(allow_null=True)
    name = serializers.CharField()
    avatar_url = serializers.CharField(allow_null=True)


class FeedAudioSerializer(serializers.Serializer):
    id = serializers.CharField()
    voice_name = serializers.CharField(allow_null=True)
    audio_url = serializers.CharField(allow_null=True)
    duration_seconds = serializers.IntegerField(allow_null=True)


class FeedStatsSerializer(serializers.Serializer):
    likes = serializers.IntegerField()
    comments = serializers.IntegerField()
    shares = serializers.IntegerField()
    saves = serializers.IntegerField()


class FeedViewerStateSerializer(serializers.Serializer):
    is_liked = serializers.BooleanField()
    is_saved = serializers.BooleanField()
    is_following_author = serializers.BooleanField()
    progress_seconds = serializers.IntegerField()
    duration_seconds = serializers.IntegerField()
    completed_ratio = serializers.FloatField()
    is_completed = serializers.BooleanField()


class FeedItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    type = serializers.CharField(required=False)
    post_id = serializers.CharField(required=False, allow_null=True)
    share_id = serializers.CharField(required=False, allow_null=True)
    title = serializers.CharField()
    description = serializers.CharField(allow_null=True)
    created_at = serializers.DateTimeField()
    shared_at = serializers.DateTimeField(required=False, allow_null=True)
    post_created_at = serializers.DateTimeField(required=False, allow_null=True)
    share_caption = serializers.CharField(required=False, allow_null=True)
    thumbnail_url = serializers.CharField(allow_null=True)
    listen_count = serializers.IntegerField()

    author = FeedAuthorSerializer()
    shared_by = FeedAuthorSerializer(required=False, allow_null=True)
    tags = FeedTagSerializer(many=True)
    audio = FeedAudioSerializer(allow_null=True)
    stats = FeedStatsSerializer()
    viewer_state = FeedViewerStateSerializer()

class PublishPostSerializer(serializers.Serializer):
    draft_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    original_text = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    transcript_text = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    dialogue_script = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    summary_text = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    source_type = serializers.ChoiceField(
        choices=['manual', 'uploaded_document', 'ai_generated'],
        default='ai_generated'
    )
    is_ai_generated = serializers.BooleanField(default=True)
    audio_url = serializers.URLField()
    duration_seconds = serializers.IntegerField(required=False, allow_null=True)
    public_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    thumbnail_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)

    topic_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list
    )

    tags = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        default=list
    )

    learning_field = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        allow_null=True
    )
    visibility = serializers.ChoiceField(
        choices=['public', 'private', 'unlisted'],
        default='public'
    )

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Tiêu đề không được để trống')
        return value

    def validate_topic_ids(self, value):
        deduped = []
        for item in value:
            item = (item or "").strip()
            if item and item not in deduped:
                deduped.append(item)

        existing_ids = set(
            Topic.objects.filter(id__in=deduped).values_list("id", flat=True)
        )
        invalid_ids = [item for item in deduped if item not in existing_ids]
        if invalid_ids:
            raise serializers.ValidationError(
                f"Topic không tồn tại: {', '.join(invalid_ids)}"
            )

        return deduped[:5]

    def validate_tags(self, value):
        cleaned = []
        for tag in value:
            t = (tag or "").strip().lower()
            t = t.lstrip("#")
            t = " ".join(t.split())

            if not t:
                continue
            if len(t) > 30:
                continue
            if t not in cleaned:
                cleaned.append(t)

        return cleaned[:5]
    
class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ["id", "name", "slug", "description"]