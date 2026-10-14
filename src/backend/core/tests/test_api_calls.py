"""
Test calls API endpoints in the hub core app.
"""

from datetime import timedelta
from uuid import uuid4

from django.utils import timezone

import pytest
import responses
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db

MEET_API_URL = "https://visio.test/external-api/v1.0"
CHAT_ID = "!abcdef:matrix.test"


@pytest.fixture(autouse=True)
def meet_settings(settings):
    """Configure the Visio API for every test."""
    settings.MEET_API_URL = MEET_API_URL
    settings.MEET_APPLICATION_CLIENT_ID = "hub"
    settings.MEET_APPLICATION_CLIENT_SECRET = "secret"
    settings.MEET_ROOM_ACCESS_LEVEL = "trusted"
    settings.MEET_CALL_JOIN_GRACE_PERIOD = 300


def mock_meet_room():
    """Mock the Visio endpoints used to create a room and return its id."""
    meet_room_id = str(uuid4())
    responses.post(
        f"{MEET_API_URL}/application/token/",
        json={"access_token": "token", "token_type": "Bearer", "expires_in": 3600},
    )
    responses.post(
        f"{MEET_API_URL}/rooms/",
        json={
            "id": meet_room_id,
            "slug": "abc-defg-hij",
            "access_level": "trusted",
            "url": "https://visio.test/abc-defg-hij",
        },
        status=201,
    )
    return meet_room_id


def test_api_calls_create_anonymous():
    """Anonymous users should not be allowed to start a call."""
    response = APIClient().post(
        "/api/v1.0/calls/", {"chat_service_id": CHAT_ID}, format="json"
    )

    assert response.status_code == 401
    assert not models.Call.objects.exists()


@responses.activate
def test_api_calls_create_first_call():
    """The first call of a conversation should create its Visio room."""
    user = factories.UserFactory(email="jean@work.test")
    client = APIClient()
    client.force_login(user)
    meet_room_id = mock_meet_room()

    response = client.post(
        "/api/v1.0/calls/", {"chat_service_id": CHAT_ID}, format="json"
    )

    assert response.status_code == 201
    call = models.Call.objects.get()
    assert response.json() == {
        "id": str(call.id),
        "chat_service_id": CHAT_ID,
        "url": "https://visio.test/abc-defg-hij",
        "status": "ongoing",
        "started_at": call.started_at.isoformat().replace("+00:00", "Z"),
        "ended_at": None,
    }
    assert call.started_by == user
    assert str(call.room.meet_room_id) == meet_room_id
    assert call.room.created_by == user

    # The room is created on behalf of the user starting the call
    token_request, room_request = [call.request for call in responses.calls]
    assert b'"scope": "jean@work.test"' in token_request.body
    assert room_request.headers["Authorization"] == "Bearer token"
    assert room_request.body == b'{"access_level": "trusted"}'


@responses.activate
def test_api_calls_create_reuses_room():
    """Following calls of a conversation should be held in the same Visio room."""
    client = APIClient()
    client.force_login(factories.UserFactory())
    room = factories.MeetRoomFactory(chat_service_id=CHAT_ID)
    factories.CallFactory(room=room, ended_at=timezone.now())

    response = client.post(
        "/api/v1.0/calls/", {"chat_service_id": CHAT_ID}, format="json"
    )

    assert response.status_code == 201
    assert response.json()["url"] == room.url
    assert models.MeetRoom.objects.count() == 1
    assert room.calls.count() == 2
    assert len(responses.calls) == 0


def test_api_calls_create_joins_ongoing_call():
    """Starting a call where one is ongoing should return the ongoing call."""
    client = APIClient()
    client.force_login(factories.UserFactory())
    call = factories.CallFactory(room__chat_service_id=CHAT_ID)

    response = client.post(
        "/api/v1.0/calls/", {"chat_service_id": CHAT_ID}, format="json"
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(call.id)
    assert models.Call.objects.count() == 1


def test_api_calls_create_replaces_abandoned_call():
    """A call nobody joined within the grace period should not be joined."""
    client = APIClient()
    client.force_login(factories.UserFactory())
    started_at = timezone.now() - timedelta(seconds=301)
    abandoned = factories.CallFactory(
        room__chat_service_id=CHAT_ID, started_at=started_at
    )

    response = client.post(
        "/api/v1.0/calls/", {"chat_service_id": CHAT_ID}, format="json"
    )

    assert response.status_code == 201
    assert response.json()["id"] != str(abandoned.id)
    abandoned.refresh_from_db()
    assert abandoned.ended_at == started_at


def test_api_calls_create_keeps_confirmed_call():
    """A call confirmed by Visio should stay ongoing after the grace period."""
    client = APIClient()
    client.force_login(factories.UserFactory())
    started_at = timezone.now() - timedelta(hours=2)
    call = factories.CallFactory(
        room__chat_service_id=CHAT_ID, started_at=started_at, confirmed_at=started_at
    )

    response = client.post(
        "/api/v1.0/calls/", {"chat_service_id": CHAT_ID}, format="json"
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(call.id)


@responses.activate
def test_api_calls_create_meet_unavailable():
    """A failure of Visio should be reported without creating anything."""
    client = APIClient()
    client.force_login(factories.UserFactory())
    responses.post(f"{MEET_API_URL}/application/token/", status=503)

    response = client.post(
        "/api/v1.0/calls/", {"chat_service_id": CHAT_ID}, format="json"
    )

    assert response.status_code == 502
    assert response.json() == {"detail": "Visio is unavailable."}
    assert not models.MeetRoom.objects.exists()


def test_api_calls_create_meet_not_configured(settings):
    """Calls should not be startable when Visio is not configured."""
    settings.MEET_API_URL = None
    client = APIClient()
    client.force_login(factories.UserFactory())

    response = client.post(
        "/api/v1.0/calls/", {"chat_service_id": CHAT_ID}, format="json"
    )

    assert response.status_code == 404


def test_api_calls_create_missing_chat_service_id():
    """The conversation is required to start a call."""
    client = APIClient()
    client.force_login(factories.UserFactory())

    response = client.post("/api/v1.0/calls/", {}, format="json")

    assert response.status_code == 400
    assert response.json() == {"chat_service_id": ["This field is required."]}


def test_api_calls_retrieve():
    """Authenticated users should be able to retrieve a call from its id."""
    client = APIClient()
    client.force_login(factories.UserFactory())
    started_at = timezone.now() - timedelta(minutes=30)
    ended_at = timezone.now()
    call = factories.CallFactory(
        started_at=started_at, confirmed_at=started_at, ended_at=ended_at
    )

    response = client.get(f"/api/v1.0/calls/{call.id!s}/")

    assert response.status_code == 200
    assert response.json() == {
        "id": str(call.id),
        "chat_service_id": call.room.chat_service_id,
        "url": call.room.url,
        "status": "ended",
        "started_at": started_at.isoformat().replace("+00:00", "Z"),
        "ended_at": ended_at.isoformat().replace("+00:00", "Z"),
    }


def test_api_calls_retrieve_anonymous():
    """Anonymous users should not be allowed to retrieve a call."""
    call = factories.CallFactory()

    response = APIClient().get(f"/api/v1.0/calls/{call.id!s}/")

    assert response.status_code == 401


def test_api_calls_retrieve_abandoned_call():
    """A call nobody joined within the grace period should be seen as ended."""
    client = APIClient()
    client.force_login(factories.UserFactory())
    call = factories.CallFactory(started_at=timezone.now() - timedelta(seconds=301))

    response = client.get(f"/api/v1.0/calls/{call.id!s}/")

    assert response.status_code == 200
    assert response.json()["status"] == "ended"
    assert response.json()["ended_at"] == response.json()["started_at"]


def test_api_calls_list_requires_conversations():
    """Calls should only be listed for conversations known to the user."""
    client = APIClient()
    client.force_login(factories.UserFactory())
    factories.CallFactory()

    response = client.get("/api/v1.0/calls/")

    assert response.status_code == 400
    assert response.json() == {
        "chat_service_id": ["Ensure this field has at least 1 elements."]
    }


def test_api_calls_list_filters():
    """Calls should be filtered by conversation and status, most recent first."""
    client = APIClient()
    client.force_login(factories.UserFactory())
    room = factories.MeetRoomFactory(chat_service_id=CHAT_ID)
    ended = factories.CallFactory(
        room=room,
        started_at=timezone.now() - timedelta(hours=1),
        ended_at=timezone.now(),
    )
    ongoing = factories.CallFactory(room=room)
    other = factories.CallFactory(room__chat_service_id="!other:matrix.test")
    factories.CallFactory(room__chat_service_id="!hidden:matrix.test")

    response = client.get("/api/v1.0/calls/", {"chat_service_id": CHAT_ID})
    assert response.status_code == 200
    assert [call["id"] for call in response.json()] == [str(ongoing.id), str(ended.id)]

    response = client.get(
        "/api/v1.0/calls/",
        {"chat_service_id": [CHAT_ID, "!other:matrix.test"], "status": "ongoing"},
    )
    assert response.status_code == 200
    assert {call["id"] for call in response.json()} == {str(ongoing.id), str(other.id)}

    response = client.get(
        "/api/v1.0/calls/", {"chat_service_id": CHAT_ID, "status": "ended"}
    )
    assert [call["id"] for call in response.json()] == [str(ended.id)]

    response = client.get(
        "/api/v1.0/calls/", {"chat_service_id": CHAT_ID, "status": "unknown"}
    )
    assert response.status_code == 400


def test_api_calls_list_anonymous():
    """Anonymous users should not be allowed to list calls."""
    response = APIClient().get("/api/v1.0/calls/", {"chat_service_id": CHAT_ID})

    assert response.status_code == 401
