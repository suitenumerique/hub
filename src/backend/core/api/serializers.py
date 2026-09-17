"""Client serializers for the hub core app."""

import zoneinfo

from django.core.validators import URLValidator
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


def validate_time_zone(value):
    """An IANA time zone name, as `Intl` gives it."""
    try:
        zoneinfo.ZoneInfo(value)
    except (zoneinfo.ZoneInfoNotFoundError, ValueError) as error:
        raise serializers.ValidationError("Unknown time zone.") from error
    return value


class MeetingAttachmentSerializer(serializers.Serializer):  # pylint: disable=abstract-method
    """A text file attached to a planned meeting."""

    name = serializers.CharField(max_length=255)
    content = serializers.CharField(
        max_length=200_000, allow_blank=True, trim_whitespace=False
    )


class MeetingCreateSerializer(serializers.Serializer):  # pylint: disable=abstract-method
    """What the Hub keeps of a meeting it creates a Meet room for."""

    chat_id = serializers.CharField(max_length=255, required=False, default="")
    title = serializers.CharField(
        max_length=200, required=False, allow_blank=True, default=""
    )
    starts_at = serializers.DateTimeField(required=False, allow_null=True)
    planned_end_at = serializers.DateTimeField(required=False, allow_null=True)
    agenda = serializers.CharField(
        max_length=20_000, required=False, allow_blank=True, default=""
    )
    time_zone = serializers.CharField(
        max_length=64,
        required=False,
        default="UTC",
        validators=[validate_time_zone],
    )
    attachments = MeetingAttachmentSerializer(
        many=True, required=False, default=list, max_length=20
    )


class MeetingUpdateSerializer(serializers.Serializer):  # pylint: disable=abstract-method
    """A renaming or an extension, from the organizer's window."""

    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    extend_minutes = serializers.IntegerField(
        required=False, min_value=1, max_value=24 * 60
    )


class MeetingTranscriptSerializer(serializers.Serializer):  # pylint: disable=abstract-method
    """The meeting name, as shown in the Hub, to title its transcript."""

    title = serializers.CharField(max_length=200, trim_whitespace=True)


class MeetingDocumentLinkSerializer(serializers.Serializer):  # pylint: disable=abstract-method
    """A document listed in the meeting state."""

    title = serializers.CharField(max_length=300)
    url = serializers.URLField(
        max_length=2000, validators=[URLValidator(schemes=["http", "https"])]
    )


class MeetingArchiveSerializer(serializers.Serializer):  # pylint: disable=abstract-method
    """
    Who asks for the archive, proven by an OpenID token of their Matrix account
    (not needed for the organizer), and the links the meeting state lists.
    """

    openid_token = serializers.CharField(
        max_length=512, required=False, allow_blank=True, default=""
    )
    documents = MeetingDocumentLinkSerializer(
        many=True, required=False, default=list, max_length=50
    )


class ScribeSegmentSerializer(serializers.Serializer):  # pylint: disable=abstract-method
    """One final sentence of the live subtitles, relayed by the scribe."""

    id = serializers.CharField(max_length=128)
    speaker_identity = serializers.CharField(max_length=255)
    speaker_name = serializers.CharField(
        max_length=255, allow_blank=True, required=False, default=""
    )
    text = serializers.CharField(max_length=5000, trim_whitespace=True)


class ScribeSegmentsSerializer(serializers.Serializer):  # pylint: disable=abstract-method
    """A batch of sentences for one meeting."""

    segments = ScribeSegmentSerializer(many=True, max_length=200)


class ScribeChatMessageSerializer(serializers.Serializer):  # pylint: disable=abstract-method
    """One message of the call chat, relayed by the scribe."""

    id = serializers.CharField(max_length=128)
    sender_identity = serializers.CharField(max_length=255)
    sender_name = serializers.CharField(
        max_length=255, allow_blank=True, required=False, default=""
    )
    text = serializers.CharField(max_length=10_000, trim_whitespace=True)


class ScribeChatMessagesSerializer(serializers.Serializer):  # pylint: disable=abstract-method
    """A batch of chat messages for one meeting."""

    messages = ScribeChatMessageSerializer(many=True, max_length=200)


class ScribeParticipantSerializer(serializers.Serializer):  # pylint: disable=abstract-method
    """Someone in the call."""

    identity = serializers.CharField(max_length=255)
    name = serializers.CharField(
        max_length=255, allow_blank=True, required=False, default=""
    )


class ScribePresenceSerializer(serializers.Serializer):  # pylint: disable=abstract-method
    """Who is in the call now; empty when nobody is."""

    participants = ScribeParticipantSerializer(many=True, max_length=500)
