from rest_framework import serializers


class FeedTagSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    slug = serializers.CharField()


class FeedAuthorSerializer(serializers.Serializer):
    id = serializers.CharField()
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
    title = serializers.CharField()
    description = serializers.CharField(allow_null=True)
    created_at = serializers.DateTimeField()
    thumbnail_url = serializers.CharField(allow_null=True)
    listen_count = serializers.IntegerField()
    author = FeedAuthorSerializer()
    tags = FeedTagSerializer(many=True)
    audio = FeedAudioSerializer(allow_null=True)
    stats = FeedStatsSerializer()
    viewer_state = FeedViewerStateSerializer()