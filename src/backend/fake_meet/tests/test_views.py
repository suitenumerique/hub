"""
Test the Visio stand-in.
"""

import json
from uuid import uuid4

from django.test import Client

import pytest
import responses

from core.services.meet import verify_webhook

pytestmark = [pytest.mark.django_db, pytest.mark.urls("fake_meet.urls")]

WEBHOOK_URL = "http://localhost:80/api/v1.0/webhooks/meet/"


@pytest.fixture(autouse=True)
def meet_settings(settings):
    """Configure the stand-in for every test."""
    settings.FAKE_MEET_BASE_URL = "http://hub.test/fake-meet"
    settings.MEET_WEBHOOK_SECRET = "webhook-secret"


def test_fake_meet_create_room():
    """A room should be created the way the Visio external API does."""
    client = Client()

    response = client.post("/fake-meet/external-api/v1.0/application/token/")
    assert response.status_code == 200
    assert response.json()["access_token"]

    response = client.post(
        "/fake-meet/external-api/v1.0/rooms/",
        {"access_level": "restricted"},
        content_type="application/json",
    )
    assert response.status_code == 201
    room = response.json()
    assert room["access_level"] == "restricted"
    assert room["url"] == f"http://hub.test/fake-meet/rooms/{room['id']}/"


def webhook_events():
    """Return the type and call id of the webhooks sent to the Hub, once verified."""
    events = []
    for call in responses.calls:
        verify_webhook(call.request.headers, call.request.body)
        event = json.loads(call.request.body)
        events.append((event["type"], event["data"]["call"]["id"]))
    return events


def join(client, room_id):
    """Join a room and return the page shown to the participant with its link."""
    response = client.get(f"/fake-meet/rooms/{room_id}/?action=join")
    assert response.status_code == 302
    return client.get(response.url), response.url


@responses.activate
def test_fake_meet_room_join_then_leave():
    """Joining then leaving a room should send both signed webhooks to the Hub."""
    responses.post(WEBHOOK_URL, status=204)
    room_id = uuid4()
    client = Client()

    response = client.get(f"/fake-meet/rooms/{room_id}/")
    assert response.status_code == 200
    assert b"?action=join" in response.content
    assert len(responses.calls) == 0

    page, url = join(client, room_id)
    assert b"You are in the call. Participants: 1." in page.content
    started = json.loads(responses.calls[0].request.body)
    assert started["type"] == "call.started"
    assert started["data"]["room"]["id"] == str(room_id)

    # Reloading the page does not add a participant.
    assert b"Participants: 1." in client.get(url).content
    assert len(responses.calls) == 1

    response = client.get(f"{url}&action=leave", follow=True)
    assert b"You are not in the call. Participants: 0." in response.content
    call_id = started["data"]["call"]["id"]
    assert webhook_events() == [("call.started", call_id), ("call.ended", call_id)]

    # Leaving twice, with the link then by closing the page, ends the call once.
    assert client.post(f"{url}&action=leave").status_code == 204
    assert len(responses.calls) == 2


@responses.activate
def test_fake_meet_room_several_participants():
    """A call should start with its first participant and end with its last one."""
    responses.post(WEBHOOK_URL, status=204)
    room_id = uuid4()
    first, second = Client(), Client()

    _page, first_url = join(first, room_id)
    page, second_url = join(second, room_id)
    assert b"Participants: 2." in page.content
    assert len(responses.calls) == 1

    # The first participant closes the page.
    assert first.post(f"{first_url}&action=leave").status_code == 204
    assert len(responses.calls) == 1

    second.get(f"{second_url}&action=leave")
    call_id = webhook_events()[0][1]
    assert webhook_events() == [("call.started", call_id), ("call.ended", call_id)]

    # The next participant starts another call in the same room.
    join(first, room_id)
    assert webhook_events()[2][0] == "call.started"
    assert webhook_events()[2][1] != call_id
