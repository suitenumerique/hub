"""
Endpoints for the meeting scribe, the service following the Hub meetings' calls.

The scribe has no user: it authenticates with the shared `MEETING_SCRIBE_TOKEN`.
It asks which LiveKit rooms belong to open Hub meetings, reports who is in each
call (which also closes a meeting that is over and empty), and relays the final
subtitles and the chat messages of the calls it is in. It only ever sees rooms
of meetings created from the Hub.
"""

import hmac
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models.functions import Coalesce
from django.utils import timezone

import rest_framework as drf
from rest_framework.permissions import BasePermission

from core import meeting_assistant, meeting_closing, models

from . import serializers

# A scheduled meeting is followed a little before its start: people join early.
EARLY_JOIN = timedelta(minutes=15)


def scribe_token_matches(request):
    """Whether the request carries the scribe token."""
    expected = settings.MEETING_SCRIBE_TOKEN
    if not expected:
        return False
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        return False
    # Bytes: `compare_digest` refuses non-ASCII strings, and headers are
    # decoded as latin-1.
    return hmac.compare_digest(
        token.encode("utf-8", "surrogateescape"),
        expected.encode("utf-8", "surrogateescape"),
    )


class HasScribeToken(BasePermission):
    """Only the scribe service, with the shared token."""

    def has_permission(self, request, view):
        return scribe_token_matches(request)


def followed_meetings():
    """
    Open meetings that have started (or are about to), recently enough to
    still be followed.
    """
    now = timezone.now()
    since = now - timedelta(hours=settings.MEETING_SCRIBE_MAX_AGE_HOURS)
    return models.Meeting.objects.annotate(
        begins_at=Coalesce("starts_at", "created_at")
    ).filter(
        closed_at__isnull=True,
        begins_at__gte=since,
        begins_at__lte=now + EARLY_JOIN,
    )


def _followed_meeting(livekit_room):
    """The meeting of a room, or the response telling the scribe to leave it."""
    meeting = models.Meeting.objects.filter(livekit_room=livekit_room).first()
    if meeting is None:
        return None, drf.response.Response(status=drf.status.HTTP_404_NOT_FOUND)
    if not followed_meetings().filter(pk=meeting.pk).exists():
        return None, drf.response.Response(status=drf.status.HTTP_410_GONE)
    return meeting, None


class ScribeView(drf.views.APIView):
    """Common settings of the scribe endpoints."""

    authentication_classes = []
    permission_classes = [HasScribeToken]


class ScribeRoomsView(ScribeView):
    """The LiveKit rooms the scribe should follow."""

    def get(self, request):
        """
        GET /api/v1.0/scribe/rooms/
            Answer `{"rooms": [...]}`, the LiveKit rooms of open meetings.
        """
        rooms = list(followed_meetings().values_list("livekit_room", flat=True))
        return drf.response.Response({"rooms": rooms})


class ScribePresenceView(ScribeView):
    """Who is in a call now."""

    def post(self, request, livekit_room):
        """
        POST /api/v1.0/scribe/rooms/<livekit_room>/presence/
            Record the people in the call (an empty list when nobody is).
            Answers 410 once the meeting is closed, including when this report
            closed it because its planned end has passed.
        """
        serializer = serializers.ScribePresenceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meeting, refusal = _followed_meeting(livekit_room)
        if refusal:
            return refusal

        closed = meeting_closing.record_presence(
            meeting, serializer.validated_data["participants"]
        )
        if closed:
            return drf.response.Response(status=drf.status.HTTP_410_GONE)
        return drf.response.Response(status=drf.status.HTTP_204_NO_CONTENT)


class ScribeSegmentsView(ScribeView):
    """Receive the sentences said in one meeting."""

    def post(self, request, livekit_room):
        """
        POST /api/v1.0/scribe/rooms/<livekit_room>/segments/
            Record final sentences. A sentence sent again (same `id`) replaces
            the text but keeps its place. Answers 410 once the meeting is
            closed, so the scribe leaves the room.
        """
        serializer = serializers.ScribeSegmentsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meeting, refusal = _followed_meeting(livekit_room)
        if refusal:
            return refusal

        now = timezone.now()
        with transaction.atomic():
            for segment in serializer.validated_data["segments"]:
                fields = {
                    "speaker_identity": segment["speaker_identity"],
                    "speaker_name": segment["speaker_name"],
                    "text": segment["text"],
                }
                models.MeetingTranscriptSegment.objects.update_or_create(
                    meeting=meeting,
                    segment_id=segment["id"],
                    defaults=fields,
                    create_defaults={**fields, "spoken_at": now},
                )
        return drf.response.Response(status=drf.status.HTTP_204_NO_CONTENT)


class ScribeChatView(ScribeView):
    """Receive the messages written in the chat of one call."""

    def post(self, request, livekit_room):
        """
        POST /api/v1.0/scribe/rooms/<livekit_room>/chat/
            Record chat messages; a message sent again (same `id`) is kept once.
            Answers 410 once the meeting is closed.
        """
        serializer = serializers.ScribeChatMessagesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meeting, refusal = _followed_meeting(livekit_room)
        if refusal:
            return refusal

        now = timezone.now()
        questions = []
        with transaction.atomic():
            for message in serializer.validated_data["messages"]:
                record, created = models.MeetingChatMessage.objects.get_or_create(
                    meeting=meeting,
                    message_id=message["id"],
                    defaults={
                        "sender_identity": message["sender_identity"],
                        "sender_name": message["sender_name"],
                        "text": message["text"],
                        "sent_at": now,
                    },
                )
                if created and meeting_assistant.is_for_assistant(record):
                    questions.append(record.pk)

        if meeting_assistant.is_available():
            for question in questions:
                meeting_closing.run_in_background(
                    meeting_assistant.answer_in_call, question
                )
        return drf.response.Response(status=drf.status.HTTP_204_NO_CONTENT)


class ScribeRepliesView(ScribeView):
    """Hand Ariane's answers to the scribe, once."""

    def post(self, request, livekit_room):
        """
        POST /api/v1.0/scribe/rooms/<livekit_room>/replies/
            Answer `{"assistant": name, "replies": [{"id", "text"}]}`, the
            answers not posted yet, oldest first; they are then marked
            delivered. Answers 410 once the meeting is closed.
        """
        meeting, refusal = _followed_meeting(livekit_room)
        if refusal:
            return refusal

        with transaction.atomic():
            pending = list(
                meeting.chat_messages.select_for_update()
                .filter(from_assistant=True, delivered_at__isnull=True)
                .order_by("sent_at")
            )
            models.MeetingChatMessage.objects.filter(
                pk__in=[reply.pk for reply in pending]
            ).update(delivered_at=timezone.now())

        return drf.response.Response(
            {
                "assistant": meeting_assistant.assistant_name(),
                "replies": [{"id": str(r.pk), "text": r.text} for r in pending],
            }
        )
