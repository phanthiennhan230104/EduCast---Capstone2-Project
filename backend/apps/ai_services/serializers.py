from rest_framework import serializers


class AssistantHistoryItemSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant"])
    content = serializers.CharField(allow_blank=False, trim_whitespace=True)


class AssistantContextSerializer(serializers.Serializer):
    tone = serializers.CharField(required=False, allow_blank=True, default="")
    target_audience = serializers.CharField(required=False, allow_blank=True, default="")
    format = serializers.CharField(required=False, allow_blank=True, default="feed_post")
    length = serializers.CharField(required=False, allow_blank=True, default="medium")
    language = serializers.CharField(required=False, allow_blank=True, default="vi")


class AssistantChatSerializer(serializers.Serializer):
    message = serializers.CharField(allow_blank=False, trim_whitespace=True, max_length=4000)
    history = AssistantHistoryItemSerializer(many=True, required=False, default=list)
    context = AssistantContextSerializer(required=False, default=dict)


class AssistantGeneratedContentSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True, default="")
    description = serializers.CharField(required=False, allow_blank=True, default="")
    body = serializers.CharField(required=False, allow_blank=True, default="")
    bullets = serializers.ListField(
        child=serializers.CharField(allow_blank=False),
        required=False,
        default=list,
    )
    hashtags = serializers.ListField(
        child=serializers.CharField(allow_blank=False),
        required=False,
        default=list,
    )


class AssistantGeneratedPayloadSerializer(serializers.Serializer):
    type = serializers.ChoiceField(
        choices=["generate", "search_result", "welcome"],
        required=False,
        default="generate",
    )
    intent = serializers.CharField(required=False, allow_blank=True, default="draft")
    summary = serializers.CharField(required=False, allow_blank=True, default="")
    content = AssistantGeneratedContentSerializer(required=False, default=dict)
    suggestions = serializers.ListField(
        child=serializers.CharField(allow_blank=False),
        required=False,
        default=list,
    )