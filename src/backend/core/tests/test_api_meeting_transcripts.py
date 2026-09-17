"""
Test the meeting transcript endpoints: the scribe relay and the Docs export.
"""

import json
from datetime import timedelta

from django.test import override_settings
from django.utils import timezone

import pytest
import responses
from rest_framework.status import (
    HTTP_201_CREATED,
    HTTP_204_NO_CONTENT,
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
    HTTP_410_GONE,
    HTTP_502_BAD_GATEWAY,
    HTTP_503_SERVICE_UNAVAILABLE,
)
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db

SCRIBE_TOKEN = "scribe-secret"
DOCS_BASE_URL = "https://docs.test"
CREATE_FOR_OWNER_URL = f"{DOCS_BASE_URL}/api/v1.0/documents/create-for-owner/"

TRANSCRIPT_SETTINGS = {
    "MEETING_SCRIBE_TOKEN": SCRIBE_TOKEN,
    "DOCS_BASE_URL": DOCS_BASE_URL,
    "DOCS_SERVER_TO_SERVER_API_TOKEN": "docs-secret",
}


def _scribe_client(token=SCRIBE_TOKEN):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def _logged_in_client(user):
    client = APIClient()
    client.force_login(user)
    return client


def _segments_url(meeting):
    return f"/api/v1.0/scribe/rooms/{meeting.livekit_room}/segments/"


def _transcript_url(meeting):
    return f"/api/v1.0/meetings/{meeting.slug}/transcript/"


# Scribe: rooms to follow


@override_settings(**TRANSCRIPT_SETTINGS)
@pytest.mark.parametrize("token", ["", "wrong", "scribe-secreT", "é"])
def test_api_scribe_rooms_wrong_token(token):
    """Without the exact scribe token, nothing is listed."""
    factories.MeetingFactory()

    response = _scribe_client(token).get("/api/v1.0/scribe/rooms/")

    assert response.status_code in (HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN)


@override_settings(MEETING_SCRIBE_TOKEN=None)
def test_api_scribe_rooms_not_configured():
    """Without a configured token, even an empty one is refused."""
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer ")

    response = client.get("/api/v1.0/scribe/rooms/")

    assert response.status_code in (HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN)


@override_settings(**TRANSCRIPT_SETTINGS)
def test_api_scribe_rooms_user_session_refused():
    """A logged-in Hub user is not the scribe."""
    factories.MeetingFactory()
    client = _logged_in_client(factories.UserFactory())

    response = client.get("/api/v1.0/scribe/rooms/")

    assert response.status_code in (HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN)


@override_settings(**TRANSCRIPT_SETTINGS)
def test_api_scribe_rooms_lists_open_recent_meetings():
    """Only open meetings of the last day are followed."""
    open_meeting = factories.MeetingFactory()
    factories.MeetingFactory(closed_at=timezone.now())
    old = factories.MeetingFactory()
    models.Meeting.objects.filter(pk=old.pk).update(
        created_at=timezone.now() - timedelta(hours=25)
    )

    response = _scribe_client().get("/api/v1.0/scribe/rooms/")

    assert response.status_code == 200
    assert response.json() == {"rooms": [open_meeting.livekit_room]}


# Scribe: sentences


@override_settings(**TRANSCRIPT_SETTINGS)
def test_api_scribe_segments_wrong_token():
    """Sentences are refused without the scribe token."""
    meeting = factories.MeetingFactory()

    response = _scribe_client("wrong").post(
        _segments_url(meeting),
        {"segments": [{"id": "SG_1", "speaker_identity": "a", "text": "Bonjour"}]},
        format="json",
    )

    assert response.status_code in (HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN)
    assert not models.MeetingTranscriptSegment.objects.exists()


@override_settings(**TRANSCRIPT_SETTINGS)
def test_api_scribe_segments_recorded_and_replaced():
    """A sentence sent again replaces its text and keeps its time."""
    meeting = factories.MeetingFactory()
    client = _scribe_client()
    first = {
        "id": "SG_1",
        "speaker_identity": "alice-id",
        "speaker_name": "Alice",
        "text": "Bonjour à tous",
    }

    response = client.post(_segments_url(meeting), {"segments": [first]}, format="json")
    assert response.status_code == HTTP_204_NO_CONTENT
    spoken_at = models.MeetingTranscriptSegment.objects.get().spoken_at

    response = client.post(
        _segments_url(meeting),
        {
            "segments": [
                {**first, "text": "Bonjour à toutes et à tous"},
                {"id": "SG_2", "speaker_identity": "bob-id", "text": "Salut"},
            ]
        },
        format="json",
    )

    assert response.status_code == HTTP_204_NO_CONTENT
    segments = list(meeting.transcript_segments.order_by("segment_id"))
    assert [(s.segment_id, s.speaker_name, s.text) for s in segments] == [
        ("SG_1", "Alice", "Bonjour à toutes et à tous"),
        ("SG_2", "", "Salut"),
    ]
    assert segments[0].spoken_at == spoken_at


@override_settings(**TRANSCRIPT_SETTINGS)
def test_api_scribe_segments_unknown_room():
    """A room the Hub did not create is not recorded."""
    response = _scribe_client().post(
        "/api/v1.0/scribe/rooms/not-a-hub-room/segments/",
        {"segments": [{"id": "SG_1", "speaker_identity": "a", "text": "Bonjour"}]},
        format="json",
    )

    assert response.status_code == HTTP_404_NOT_FOUND
    assert not models.MeetingTranscriptSegment.objects.exists()


@override_settings(**TRANSCRIPT_SETTINGS)
def test_api_scribe_segments_closed_meeting():
    """Once closed, the meeting takes no more sentences: the scribe leaves."""
    meeting = factories.MeetingFactory(closed_at=timezone.now())

    response = _scribe_client().post(
        _segments_url(meeting),
        {"segments": [{"id": "SG_1", "speaker_identity": "a", "text": "Bonjour"}]},
        format="json",
    )

    assert response.status_code == HTTP_410_GONE
    assert not models.MeetingTranscriptSegment.objects.exists()


@override_settings(**TRANSCRIPT_SETTINGS)
def test_api_scribe_segments_invalid_payload():
    """Malformed sentences are refused as a whole."""
    meeting = factories.MeetingFactory()

    response = _scribe_client().post(
        _segments_url(meeting),
        {
            "segments": [
                {"id": "SG_1", "speaker_identity": "a", "text": "Bonjour"},
                {"id": "SG_2", "text": "sans orateur"},
            ]
        },
        format="json",
    )

    assert response.status_code == HTTP_400_BAD_REQUEST
    assert not models.MeetingTranscriptSegment.objects.exists()


# Organizer: saving the transcript in Docs


@override_settings(**TRANSCRIPT_SETTINGS)
def test_api_meeting_transcript_anonymous():
    """Anonymous users cannot save a transcript."""
    meeting = factories.MeetingFactory()

    response = APIClient().post(_transcript_url(meeting), {"title": "Point"})

    assert response.status_code == HTTP_401_UNAUTHORIZED


@override_settings(**TRANSCRIPT_SETTINGS)
@responses.activate
def test_api_meeting_transcript_not_organizer():
    """Another user gets a 404 and the meeting stays open."""
    meeting = factories.MeetingFactory()
    factories.MeetingTranscriptSegmentFactory(meeting=meeting)

    response = _logged_in_client(factories.UserFactory()).post(
        _transcript_url(meeting), {"title": "Point"}
    )

    assert response.status_code == HTTP_404_NOT_FOUND
    meeting.refresh_from_db()
    assert meeting.closed_at is None
    assert len(responses.calls) == 0


@override_settings(**TRANSCRIPT_SETTINGS)
def test_api_meeting_transcript_title_required():
    """The meeting name titles the document."""
    meeting = factories.MeetingFactory()

    response = _logged_in_client(meeting.organizer).post(
        _transcript_url(meeting), {"title": "  "}
    )

    assert response.status_code == HTTP_400_BAD_REQUEST


@override_settings(**TRANSCRIPT_SETTINGS)
@responses.activate
def test_api_meeting_transcript_nothing_said():
    """Without any sentence, the meeting is closed and no document is created."""
    meeting = factories.MeetingFactory()

    response = _logged_in_client(meeting.organizer).post(
        _transcript_url(meeting), {"title": "Point"}
    )

    assert response.status_code == HTTP_204_NO_CONTENT
    meeting.refresh_from_db()
    assert meeting.closed_at is not None
    assert len(responses.calls) == 0


@override_settings(
    MEETING_SCRIBE_TOKEN=SCRIBE_TOKEN,
    DOCS_BASE_URL=None,
    DOCS_SERVER_TO_SERVER_API_TOKEN=None,
)
def test_api_meeting_transcript_docs_not_configured():
    """Without Docs, the meeting is still closed for the scribe."""
    meeting = factories.MeetingFactory()
    factories.MeetingTranscriptSegmentFactory(meeting=meeting)

    response = _logged_in_client(meeting.organizer).post(
        _transcript_url(meeting), {"title": "Point"}
    )

    assert response.status_code == HTTP_503_SERVICE_UNAVAILABLE
    meeting.refresh_from_db()
    assert meeting.closed_at is not None


@override_settings(**TRANSCRIPT_SETTINGS)
@responses.activate
def test_api_meeting_transcript_saved_in_docs():
    """The organizer gets a Docs document holding the transcript, once."""
    organizer = factories.UserFactory(
        sub="organizer-sub", email="orga@example.com", language="fr-fr"
    )
    meeting = factories.MeetingFactory(organizer=organizer)
    for segment_id, name, text in [
        ("SG_1", "Alice", "Bonjour à tous."),
        ("SG_2", "Alice", "On commence ?"),
        ("SG_3", "Bob", "Oui, allons-y."),
    ]:
        factories.MeetingTranscriptSegmentFactory(
            meeting=meeting,
            segment_id=segment_id,
            speaker_name=name,
            text=text,
            spoken_at=timezone.now(),
        )
    responses.post(CREATE_FOR_OWNER_URL, status=201, json={"id": "doc-123"})
    client = _logged_in_client(organizer)

    response = client.post(_transcript_url(meeting), {"title": "Point hebdo"})

    assert response.status_code == HTTP_201_CREATED
    assert response.json() == {
        "id": "doc-123",
        "title": "Transcription : Point hebdo",
        "url": "https://docs.test/docs/doc-123/",
    }
    assert len(responses.calls) == 1
    request = responses.calls[0].request
    assert request.headers["Authorization"] == "Bearer docs-secret"
    body = json.loads(request.body)
    assert {k: body[k] for k in ("title", "sub", "email", "language")} == {
        "title": "Transcription : Point hebdo",
        "sub": "organizer-sub",
        "email": "orga@example.com",
        "language": "fr-fr",
    }
    assert body["send_notification_email"] is False
    content = body["content"]
    assert "**Alice**" in content
    assert "Bonjour à tous.\nOn commence ?" in content
    assert content.index("**Alice**") < content.index("**Bob**")
    assert content.count("**Alice**") == 1

    meeting.refresh_from_db()
    assert meeting.closed_at is not None
    assert meeting.transcript_document_id == "doc-123"

    # Closing it again answers the same document without a new one.
    response = client.post(_transcript_url(meeting), {"title": "Point hebdo"})
    assert response.status_code == HTTP_201_CREATED
    assert response.json()["id"] == "doc-123"
    assert len(responses.calls) == 1


@override_settings(**TRANSCRIPT_SETTINGS)
@responses.activate
def test_api_meeting_transcript_docs_failure():
    """A Docs failure is reported without leaking its answer, and can be retried."""
    meeting = factories.MeetingFactory()
    factories.MeetingTranscriptSegmentFactory(meeting=meeting)
    responses.post(CREATE_FOR_OWNER_URL, status=400, json={"email": ["invalid"]})

    response = _logged_in_client(meeting.organizer).post(
        _transcript_url(meeting), {"title": "Point"}
    )

    assert response.status_code == HTTP_502_BAD_GATEWAY
    assert response.json() == {"detail": "Docs could not save the transcript."}
    meeting.refresh_from_db()
    assert meeting.transcript_document_id is None
