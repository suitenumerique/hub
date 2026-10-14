"""Client serializers for the hub core app."""

# pylint: disable=abstract-method

from django.utils.text import slugify

from rest_framework import serializers

from core import models


class UserSerializer(serializers.ModelSerializer):
    """Serialize users."""

    full_name = serializers.SerializerMethodField(read_only=True)
    short_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = models.User
        fields = ["id", "email", "full_name", "short_name", "language"]
        read_only_fields = ["id", "email", "full_name", "short_name"]

    def get_full_name(self, instance):
        """Return the full name of the user."""
        if not instance.full_name:
            email = instance.email.split("@")[0]
            return slugify(email)

        return instance.full_name

    def get_short_name(self, instance):
        """Return the short name of the user."""
        if not instance.short_name:
            email = instance.email.split("@")[0]
            return slugify(email)

        return instance.short_name


class UserLightSerializer(UserSerializer):
    """Serialize users with limited fields."""

    class Meta:
        model = models.User
        fields = ["full_name", "short_name"]
        read_only_fields = ["full_name", "short_name"]


class CallSerializer(serializers.ModelSerializer):
    """Serialize calls."""

    chat_service_id = serializers.CharField(source="room.chat_service_id")
    url = serializers.URLField(source="room.url")
    status = serializers.ChoiceField(choices=models.CallStatus.choices)

    class Meta:
        model = models.Call
        fields = ["id", "chat_service_id", "url", "status", "started_at", "ended_at"]
        read_only_fields = fields


class CallCreateSerializer(serializers.Serializer):
    """Validate the conversation in which a call is started."""

    chat_service_id = serializers.CharField(max_length=255)


class CallListQuerySerializer(serializers.Serializer):
    """Validate the filters applied when listing calls."""

    chat_service_id = serializers.ListField(
        child=serializers.CharField(max_length=255), min_length=1, max_length=50
    )
    status = serializers.ChoiceField(choices=models.CallStatus.choices, required=False)


class MeetWebhookRoomSerializer(serializers.Serializer):
    """Validate the room a Visio webhook is about."""

    id = serializers.UUIDField()


class MeetWebhookCallSerializer(serializers.Serializer):
    """Validate the call a Visio webhook is about."""

    id = serializers.CharField(max_length=255)
    started_at = serializers.DateTimeField(required=False, allow_null=True)
    ended_at = serializers.DateTimeField(required=False, allow_null=True)


class MeetWebhookDataSerializer(serializers.Serializer):
    """Validate the data of a Visio webhook."""

    room = MeetWebhookRoomSerializer()
    call = MeetWebhookCallSerializer()


class MeetWebhookSerializer(serializers.Serializer):
    """Validate a webhook sent by Visio."""

    type = serializers.CharField()
    timestamp = serializers.DateTimeField()
    data = MeetWebhookDataSerializer()
