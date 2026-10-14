"""
Test the endpoint receiving Visio webhooks in the hub core app.
"""

import json
import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.services.meet import sign_webhook

pytestmark = pytest.mark.django_db

SECRET = "webhook-secret"
STARTED_AT = datetime(2026, 10, 5, 9, 0, tzinfo=timezone.utc)
ENDED_AT = STARTED_AT + timedelta(minutes=42)


@pytest.fixture(autouse=True)
def meet_settings(settings):
    """Configure the Visio webhooks for every test."""
    settings.MEET_WEBHOOK_SECRET = SECRET
    settings.MEET_WEBHOOK_TOLERANCE = 300
    settings.MEET_CALL_JOIN_GRACE_PERIOD = 300


def build_event(event_type, room, call_id="RM_first", **call):
    """Build the payload Visio sends for a call event."""
    return {
        "type": event_type,
        "timestamp": "2026-10-05T10:00:00Z",
        "data": {
            "room": {"id": str(room.meet_room_id), "slug": "abc-defg-hij"},
            "call": {"id": call_id, **call},
        },
    }


def post_event(event, secret=SECRET, timestamp=None, **headers):
    """Send a signed webhook to the Hub."""
    body = json.dumps(event).encode()
    timestamp = str(int(time.time()) if timestamp is None else timestamp)
    headers = {
        "webhook-id": "msg_1",
        "webhook-timestamp": timestamp,
        "webhook-signature": sign_webhook(secret, "msg_1", timestamp, body),
        **headers,
    }
    return APIClient().post(
        "/api/v1.0/webhooks/meet/",
        body,
        content_type="application/json",
        headers=headers,
    )


def test_api_webhooks_meet_started_confirms_call():
    """A started call should confirm the call opened from the Hub."""
    call = factories.CallFactory()

    response = post_event(
        build_event("call.started", call.room, started_at=STARTED_AT.isoformat())
    )

    assert response.status_code == 204
    call.refresh_from_db()
    assert call.confirmed_at == STARTED_AT
    assert call.meet_call_id == "RM_first"
    assert call.ended_at is None
    assert call.status == "ongoing"


def test_api_webhooks_meet_started_is_idempotent():
    """A started call received twice should be recorded once."""
    call = factories.CallFactory()
    event = build_event("call.started", call.room, started_at=STARTED_AT.isoformat())

    assert post_event(event).status_code == 204
    assert post_event(event).status_code == 204

    assert models.Call.objects.count() == 1


def test_api_webhooks_meet_started_from_visio():
    """A call started with the link of the room should be recorded as ongoing."""
    room = factories.MeetRoomFactory()

    response = post_event(
        build_event("call.started", room, started_at=STARTED_AT.isoformat())
    )

    assert response.status_code == 204
    call = room.calls.get()
    assert call.started_by is None
    assert call.started_at == STARTED_AT
    assert call.confirmed_at == STARTED_AT
    assert call.status == "ongoing"


def test_api_webhooks_meet_started_closes_unfinished_call():
    """A call whose end was missed should end when the following one starts."""
    missed = factories.CallFactory(
        started_at=STARTED_AT - timedelta(days=1),
        confirmed_at=STARTED_AT - timedelta(days=1),
        meet_call_id="RM_first",
    )

    response = post_event(
        build_event(
            "call.started",
            missed.room,
            call_id="RM_second",
            started_at=STARTED_AT.isoformat(),
        )
    )

    assert response.status_code == 204
    missed.refresh_from_db()
    assert missed.ended_at == STARTED_AT
    assert missed.room.calls.get(ended_at__isnull=True).meet_call_id == "RM_second"


def test_api_webhooks_meet_ended():
    """An ended call should end the matching call."""
    call = factories.CallFactory(
        started_at=STARTED_AT, confirmed_at=STARTED_AT, meet_call_id="RM_first"
    )

    response = post_event(
        build_event(
            "call.ended",
            call.room,
            started_at=STARTED_AT.isoformat(),
            ended_at=ENDED_AT.isoformat(),
        )
    )

    assert response.status_code == 204
    call.refresh_from_db()
    assert call.ended_at == ENDED_AT
    assert call.status == "ended"


def test_api_webhooks_meet_ended_without_start():
    """An ended call whose start was missed should end the unconfirmed call."""
    call = factories.CallFactory(started_at=STARTED_AT)

    response = post_event(
        build_event("call.ended", call.room, ended_at=ENDED_AT.isoformat())
    )

    assert response.status_code == 204
    call.refresh_from_db()
    assert call.ended_at == ENDED_AT
    assert call.meet_call_id == "RM_first"


def test_api_webhooks_meet_ended_late_keeps_following_call():
    """A late end should not end the call that followed the one it is about."""
    room = factories.MeetRoomFactory()
    factories.CallFactory(
        room=room,
        started_at=STARTED_AT,
        confirmed_at=STARTED_AT,
        ended_at=ENDED_AT,
        meet_call_id="RM_first",
    )
    following = factories.CallFactory(room=room)

    response = post_event(
        build_event("call.ended", room, ended_at=ENDED_AT.isoformat())
    )

    assert response.status_code == 204
    following.refresh_from_db()
    assert following.ended_at is None


def test_api_webhooks_meet_ended_defaults_to_event_timestamp():
    """The timestamp of the event should be used when the call has no end date."""
    call = factories.CallFactory(
        started_at=STARTED_AT, confirmed_at=STARTED_AT, meet_call_id="RM_first"
    )

    response = post_event(build_event("call.ended", call.room))

    assert response.status_code == 204
    call.refresh_from_db()
    assert call.ended_at == datetime(2026, 10, 5, 10, 0, tzinfo=timezone.utc)


def test_api_webhooks_meet_unknown_room():
    """Events about rooms the Hub did not create should be ignored."""
    room = factories.MeetRoomFactory.build(meet_room_id=uuid4())

    response = post_event(build_event("call.started", room))

    assert response.status_code == 204
    assert not models.Call.objects.exists()


def test_api_webhooks_meet_unknown_type():
    """Events of an unknown type should be acknowledged and ignored."""
    call = factories.CallFactory()

    response = post_event(build_event("call.recorded", call.room))

    assert response.status_code == 204
    call.refresh_from_db()
    assert call.confirmed_at is None


def test_api_webhooks_meet_invalid_payload():
    """A signed but malformed event should be rejected."""
    response = post_event({"type": "call.started", "timestamp": "2026-10-05T10:00Z"})

    assert response.status_code == 400
    assert response.json() == {"data": ["This field is required."]}


def test_api_webhooks_meet_wrong_secret():
    """An event signed with another secret should be rejected."""
    call = factories.CallFactory()

    response = post_event(build_event("call.started", call.room), secret="other")

    assert response.status_code == 401
    call.refresh_from_db()
    assert call.confirmed_at is None


def test_api_webhooks_meet_tampered_body():
    """An event whose signature covers another body should be rejected."""
    call = factories.CallFactory()
    signature = sign_webhook(SECRET, "msg_1", str(int(time.time())), b"{}")

    response = post_event(
        build_event("call.started", call.room), **{"webhook-signature": signature}
    )

    assert response.status_code == 401


def test_api_webhooks_meet_expired_timestamp():
    """An event replayed after the tolerance should be rejected."""
    call = factories.CallFactory()

    response = post_event(
        build_event("call.started", call.room), timestamp=int(time.time()) - 301
    )

    assert response.status_code == 401


def test_api_webhooks_meet_missing_signature():
    """An unsigned event should be rejected."""
    call = factories.CallFactory()

    response = APIClient().post(
        "/api/v1.0/webhooks/meet/",
        build_event("call.started", call.room),
        format="json",
    )

    assert response.status_code == 401


def test_api_webhooks_meet_rotated_secret():
    """One valid signature among several should be enough during a rotation."""
    call = factories.CallFactory()
    event = build_event("call.started", call.room)
    timestamp = str(int(time.time()))
    body = json.dumps(event).encode()
    signatures = " ".join(
        [
            sign_webhook("previous", "msg_1", timestamp, body),
            sign_webhook(SECRET, "msg_1", timestamp, body),
        ]
    )

    response = post_event(
        event, timestamp=timestamp, **{"webhook-signature": signatures}
    )

    assert response.status_code == 204


def test_api_webhooks_meet_no_secret_configured(settings):
    """Every event should be rejected when no secret is configured."""
    settings.MEET_WEBHOOK_SECRET = None
    call = factories.CallFactory()

    response = post_event(build_event("call.started", call.room), secret="")

    assert response.status_code == 401
