"""
Test the meeting lifecycle kept by the Hub: details, presence, automatic
closing and the call chat.
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
    HTTP_404_NOT_FOUND,
    HTTP_410_GONE,
)
from rest_framework.test import APIClient

from bots import matrix
from core import factories, meeting_closing, models

pytestmark = pytest.mark.django_db

SCRIBE_TOKEN = "scribe-secret"
MEET_API_URL = "https://meet.test/external-api/v1.0"
DOCS_BASE_URL = "https://docs.test"

SETTINGS = {
    "MEETING_SCRIBE_TOKEN": SCRIBE_TOKEN,
    "MEET_API_URL": MEET_API_URL,
    "MEET_APPLICATION_CLIENT_ID": "hub-client-id",
    "MEET_APPLICATION_CLIENT_SECRET": "hub-client-secret",
    "DOCS_BASE_URL": DOCS_BASE_URL,
    "DOCS_SERVER_TO_SERVER_API_TOKEN": "docs-secret",
    "MATRIX_AS_TOKEN": "as-token",
    "MATRIX_ADMIN_TOKEN": "admin-token",
    "MATRIX_BOT_USER_ID": "@ariane:localhost",
}


@pytest.fixture(name="inline")
def fixture_inline(monkeypatch):
    """Run the background closing steps right away."""
    monkeypatch.setattr(
        meeting_closing, "run_in_background", lambda function, *args: function(*args)
    )


@pytest.fixture(name="room_state")
def fixture_room_state(monkeypatch):
    """A fake meeting state in Matrix, written as Ariane."""
    state = {"content": None, "joined": [], "written": []}

    def get_room_state(_room_id, event_type, _state_key):
        assert event_type == "io.lasuite.hub.meeting"
        return dict(state["content"])

    def set_room_state(room_id, _event_type, state_key, content):
        state["written"].append((room_id, state_key, content))

    monkeypatch.setattr(matrix, "ensure_in_room", state["joined"].append)
    monkeypatch.setattr(matrix, "get_room_state", get_room_state)
    monkeypatch.setattr(matrix, "set_room_state", set_room_state)
    return state


def _scribe_client():
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {SCRIBE_TOKEN}")
    return client


def _logged_in_client(user):
    client = APIClient()
    client.force_login(user)
    return client


def _presence(meeting, participants):
    return _scribe_client().post(
        f"/api/v1.0/scribe/rooms/{meeting.livekit_room}/presence/",
        {"participants": participants},
        format="json",
    )


# Creating a meeting with its details


@override_settings(**SETTINGS)
@responses.activate
def test_api_meetings_create_with_details():
    """The Hub keeps what it needs for the closing and the archive."""
    responses.post(f"{MEET_API_URL}/application/token/", json={"access_token": "t"})
    responses.post(
        f"{MEET_API_URL}/rooms/",
        status=201,
        json={"id": "room-uuid", "slug": "abc-defg-hij", "url": "https://m/abc"},
    )
    user = factories.UserFactory()

    response = _logged_in_client(user).post(
        "/api/v1.0/meetings/",
        {
            "chat_id": "!room:localhost",
            "title": "Point hebdo",
            "starts_at": "2026-09-17T09:00:00Z",
            "planned_end_at": "2026-09-17T10:00:00Z",
            "agenda": "1. Tour de table\n2. Démo",
            "time_zone": "Europe/Paris",
            "attachments": [
                {"name": "notes.md", "content": "# Notes\n"},
                {"name": "vide.txt", "content": ""},
            ],
        },
        format="json",
    )

    assert response.status_code == HTTP_201_CREATED
    meeting = models.Meeting.objects.get()
    assert (meeting.chat_id, meeting.title, meeting.time_zone) == (
        "!room:localhost",
        "Point hebdo",
        "Europe/Paris",
    )
    assert meeting.planned_end_at.isoformat() == "2026-09-17T10:00:00+00:00"
    assert meeting.agenda == "1. Tour de table\n2. Démo"
    assert [(a.name, a.content) for a in meeting.attachments.all()] == [
        ("notes.md", "# Notes\n"),
        ("vide.txt", ""),
    ]


@override_settings(**SETTINGS)
@responses.activate
@pytest.mark.parametrize(
    "body",
    [
        {"time_zone": "Mars/Olympus"},
        {"attachments": [{"name": "a.md"}]},
        {"planned_end_at": "demain"},
    ],
)
def test_api_meetings_create_invalid_details(body):
    """Invalid details are refused before any Meet room is created."""
    response = _logged_in_client(factories.UserFactory()).post(
        "/api/v1.0/meetings/", body, format="json"
    )

    assert response.status_code == HTTP_400_BAD_REQUEST
    assert len(responses.calls) == 0
    assert not models.Meeting.objects.exists()


@override_settings(**SETTINGS)
def test_api_meeting_update_title_and_extend():
    """The organizer's renaming and extension reach the Hub's copy."""
    end = timezone.now() + timedelta(minutes=10)
    meeting = factories.MeetingFactory(planned_end_at=end)
    client = _logged_in_client(meeting.organizer)

    response = client.patch(
        f"/api/v1.0/meetings/{meeting.slug}/",
        {"title": " Rétro ", "extend_minutes": 15},
        format="json",
    )

    assert response.status_code == HTTP_204_NO_CONTENT
    meeting.refresh_from_db()
    assert meeting.title == "Rétro"
    assert meeting.planned_end_at == end + timedelta(minutes=15)


@override_settings(**SETTINGS)
def test_api_meeting_update_without_plan_counts_from_now():
    """An unplanned meeting gets an end, counted from now."""
    meeting = factories.MeetingFactory()
    before = timezone.now()

    _logged_in_client(meeting.organizer).patch(
        f"/api/v1.0/meetings/{meeting.slug}/", {"extend_minutes": 15}, format="json"
    )

    meeting.refresh_from_db()
    assert meeting.planned_end_at >= before + timedelta(minutes=15)


@override_settings(**SETTINGS)
def test_api_meeting_update_not_organizer():
    """Only the organizer may change the meeting."""
    meeting = factories.MeetingFactory(title="Point")

    response = _logged_in_client(factories.UserFactory()).patch(
        f"/api/v1.0/meetings/{meeting.slug}/", {"title": "Piraté"}, format="json"
    )

    assert response.status_code == HTTP_404_NOT_FOUND
    meeting.refresh_from_db()
    assert meeting.title == "Point"


# Scribe: who is in the call


@override_settings(**SETTINGS)
def test_api_scribe_rooms_follow_scheduled_meetings_near_their_start():
    """A meeting scheduled for later is followed only shortly before it starts."""
    soon = factories.MeetingFactory(starts_at=timezone.now() + timedelta(minutes=5))
    factories.MeetingFactory(starts_at=timezone.now() + timedelta(hours=2))
    yesterday = factories.MeetingFactory(starts_at=timezone.now() - timedelta(hours=30))
    models.Meeting.objects.filter(pk=yesterday.pk).update(
        created_at=timezone.now() - timedelta(days=2)
    )

    response = _scribe_client().get("/api/v1.0/scribe/rooms/")

    assert response.json() == {"rooms": [soon.livekit_room]}


@override_settings(**SETTINGS)
def test_api_scribe_presence_records_participants():
    """Participants are kept once, with their latest name."""
    meeting = factories.MeetingFactory()

    assert (
        _presence(meeting, [{"identity": "a", "name": "Alice"}]).status_code
        == HTTP_204_NO_CONTENT
    )
    first_seen = models.MeetingParticipant.objects.get().first_seen_at
    assert (
        _presence(
            meeting, [{"identity": "a", "name": "Alice M."}, {"identity": "b"}]
        ).status_code
        == HTTP_204_NO_CONTENT
    )

    participants = list(meeting.participants.order_by("identity"))
    assert [(p.identity, p.name) for p in participants] == [
        ("a", "Alice M."),
        ("b", ""),
    ]
    assert participants[0].first_seen_at == first_seen
    assert participants[0].last_seen_at > first_seen
    meeting.refresh_from_db()
    assert meeting.last_occupied_at is not None
    assert meeting.closed_at is None


@override_settings(**SETTINGS)
@pytest.mark.usefixtures("inline")
def test_api_scribe_presence_empty_before_the_end_keeps_it_open(room_state):
    """An empty call before its planned end stays open."""
    meeting = factories.MeetingFactory(
        planned_end_at=timezone.now() + timedelta(minutes=5)
    )

    assert _presence(meeting, []).status_code == HTTP_204_NO_CONTENT

    meeting.refresh_from_db()
    assert meeting.closed_at is None
    assert room_state["written"] == []


@override_settings(**SETTINGS)
@pytest.mark.usefixtures("inline", "room_state")
def test_api_scribe_presence_occupied_past_the_end_keeps_it_open():
    """People still talking past the planned end keep the meeting open."""
    meeting = factories.MeetingFactory(
        planned_end_at=timezone.now() - timedelta(minutes=5)
    )

    response = _presence(meeting, [{"identity": "a", "name": "Alice"}])

    assert response.status_code == HTTP_204_NO_CONTENT
    meeting.refresh_from_db()
    assert meeting.closed_at is None


@override_settings(**SETTINGS)
@responses.activate
@pytest.mark.usefixtures("inline")
def test_api_scribe_presence_closes_an_empty_meeting_past_its_end(room_state):
    """
    Past its planned end and empty, the meeting closes: the transcript is saved
    and Ariane writes the closing into the meeting state.
    """
    meeting = factories.MeetingFactory(
        chat_id="!room:localhost",
        title="Point hebdo",
        planned_end_at=timezone.now() - timedelta(minutes=1),
    )
    factories.MeetingTranscriptSegmentFactory(meeting=meeting)
    responses.post(
        f"{DOCS_BASE_URL}/api/v1.0/documents/create-for-owner/",
        status=201,
        json={"id": "doc-1"},
    )
    agenda = {"id": "agenda", "title": "Ordre du jour", "url": "https://x/a"}
    room_state["content"] = {
        "meetingUrl": "https://m/abc",
        "startedAt": 1,
        "organizerId": "@orga:localhost",
        "documents": [agenda],
    }

    response = _presence(meeting, [])

    assert response.status_code == HTTP_410_GONE
    meeting.refresh_from_db()
    assert meeting.closed_at is not None
    assert meeting.auto_closed is True
    assert meeting.transcript_document_id == "doc-1"
    assert json.loads(responses.calls[0].request.body)["title"].endswith("Point hebdo")
    assert room_state["joined"] == ["!room:localhost"]
    [(room_id, state_key, content)] = room_state["written"]
    assert (room_id, state_key) == ("!room:localhost", meeting.slug)
    assert content["endedAt"] == int(meeting.closed_at.timestamp() * 1000)
    assert content["endedBy"] == "auto"
    assert content["organizerId"] == "@orga:localhost"
    assert content["documents"] == [
        agenda,
        {
            "id": "doc-1",
            "title": content["documents"][1]["title"],
            "url": f"{DOCS_BASE_URL}/docs/doc-1/",
        },
    ]

    # The scribe reporting again changes nothing.
    assert _presence(meeting, []).status_code == HTTP_410_GONE
    assert len(room_state["written"]) == 1


@override_settings(**SETTINGS)
@pytest.mark.usefixtures("inline", "room_state")
def test_api_scribe_presence_without_plan_never_closes():
    """A meeting without planned end is only closed by its organizer."""
    meeting = factories.MeetingFactory(planned_end_at=None)

    assert _presence(meeting, []).status_code == HTTP_204_NO_CONTENT
    meeting.refresh_from_db()
    assert meeting.closed_at is None


def test_publish_closed_keeps_an_organizer_closing(room_state):
    """A closing already written by the organizer is not replaced."""
    meeting = factories.MeetingFactory(chat_id="!room:localhost")
    meeting_closing.close(meeting)
    room_state["content"] = {"meetingUrl": "u", "startedAt": 1, "endedAt": 42}

    with override_settings(**SETTINGS):
        meeting_closing.publish_closed(meeting)

    assert room_state["written"] == []


def test_publish_closed_without_bot_writes_nothing(room_state):
    """Without Ariane's tokens, the members' clients stay in charge."""
    meeting = factories.MeetingFactory(chat_id="!room:localhost")
    meeting_closing.close(meeting, auto=True)

    with override_settings(MATRIX_AS_TOKEN=None):
        meeting_closing.publish_closed(meeting)

    assert room_state["joined"] == []


def test_publish_closed_matrix_failure_is_only_logged(monkeypatch, room_state):
    """A Matrix failure does not break the closing."""
    meeting = factories.MeetingFactory(chat_id="!room:localhost")
    meeting_closing.close(meeting, auto=True)

    def refuse(room_id):
        raise matrix.MatrixError("forbidden", errcode="M_FORBIDDEN")

    monkeypatch.setattr(matrix, "ensure_in_room", refuse)

    with override_settings(**SETTINGS):
        meeting_closing.publish_closed(meeting)

    assert room_state["written"] == []


# Scribe: the call chat


@override_settings(**SETTINGS)
def test_api_scribe_chat_records_messages_once():
    """Chat messages are kept once, in arrival order."""
    meeting = factories.MeetingFactory()
    url = f"/api/v1.0/scribe/rooms/{meeting.livekit_room}/chat/"
    message = {
        "id": "m1",
        "sender_identity": "a",
        "sender_name": "Alice",
        "text": "Le lien est dans le salon",
    }

    for _ in range(2):
        response = _scribe_client().post(url, {"messages": [message]}, format="json")
        assert response.status_code == HTTP_204_NO_CONTENT

    assert [
        (m.sender_name, m.text) for m in models.MeetingChatMessage.objects.all()
    ] == [("Alice", "Le lien est dans le salon")]


@override_settings(**SETTINGS)
def test_api_scribe_chat_closed_meeting():
    """A closed meeting takes no more messages."""
    meeting = factories.MeetingFactory(closed_at=timezone.now())

    response = _scribe_client().post(
        f"/api/v1.0/scribe/rooms/{meeting.livekit_room}/chat/",
        {"messages": [{"id": "m1", "sender_identity": "a", "text": "Salut"}]},
        format="json",
    )

    assert response.status_code == HTTP_410_GONE
    assert not models.MeetingChatMessage.objects.exists()


@override_settings(**SETTINGS)
def test_api_scribe_presence_wrong_token():
    """Presence reports need the scribe token."""
    meeting = factories.MeetingFactory(
        planned_end_at=timezone.now() - timedelta(minutes=1)
    )
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer nope")

    response = client.post(
        f"/api/v1.0/scribe/rooms/{meeting.livekit_room}/presence/",
        {"participants": []},
        format="json",
    )

    assert response.status_code in (401, 403)
    meeting.refresh_from_db()
    assert meeting.closed_at is None
