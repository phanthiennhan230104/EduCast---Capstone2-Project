from rest_framework import serializers

class AssistantHistoryItemSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant"])
    content = serializers.CharField(
        allow_blank=False, 
        trim_whitespace=True,
        max_length=10000,
        error_messages={
            'required': 'Nội dung tin nhắn là bắt buộc.',
            'blank': 'Nội dung tin nhắn không được bỏ trống.',
            'max_length': 'Nội dung tin nhắn không được vượt quá 10000 ký tự.',
        }
    )


class AssistantContextSerializer(serializers.Serializer):
    tone = serializers.CharField(required=False, allow_blank=True, default="", max_length=500)
    target_audience = serializers.CharField(required=False, allow_blank=True, default="", max_length=500)
    format = serializers.CharField(required=False, allow_blank=True, default="feed_post", max_length=100)
    length = serializers.CharField(required=False, allow_blank=True, default="medium", max_length=100)
    language = serializers.CharField(required=False, allow_blank=True, default="vi", max_length=20)


class AssistantChatSerializer(serializers.Serializer):
    message = serializers.CharField(
        allow_blank=False, 
        trim_whitespace=True, 
        max_length=4000,
        error_messages={
            'required': 'Tin nhắn là bắt buộc.',
            'blank': 'Tin nhắn không được bỏ trống.',
            'max_length': 'Tin nhắn không được vượt quá 4000 ký tự.',
        }
    )
    history = AssistantHistoryItemSerializer(
        many=True, 
        required=False, 
        default=list,
        error_messages={
            'not_a_list': 'History phải là một danh sách các tin nhắn.'
        }
    )
    context = AssistantContextSerializer(
        required=False, 
        default=dict,
        error_messages={
            'not_a_dict': 'Context phải là một đối tượng.'
        }
    )
    
    def validate_history(self, value):
        """Validate history length"""
        if len(value) > 100:
            raise serializers.ValidationError("History không được vượt quá 100 tin nhắn.")
        return value


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