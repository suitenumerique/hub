"""Contract tests for synchronous Matrix Application Service ingestion."""

import json
import uuid
from unittest.mock import patch

from django.test import Client
from django.urls import reverse

import pytest

from matrix_bridge import reducers
from matrix_bridge.models import (
    AppServiceTransaction,
    Group,
    GroupMatrixRoom,
    GroupMembership,
    GroupRoomRole,
    GroupStatus,
    MembershipState,
)
from matrix_bridge.services import GROUP_METADATA_EVENT

pytestmark = pytest.mark.django_db

HS_TOKEN = "hub-groups-hs-token-dev-only"
ACCOUNT_ID = "matrix-local"
CREATOR_MXID = "@alice:localhost"


def create_group_room(
    *,
    room_id="!group:localhost",
    status=GroupStatus.AWAITING_REQUESTER_JOIN,
    control_homeserver=ACCOUNT_ID,
):
    """Create a minimal authoritative registry room."""
    group = Group.objects.create(
        status=status,
        created_by_matrix_id=CREATOR_MXID,
        created_via_account_id=control_homeserver,
        control_homeserver=control_homeserver,
        idempotency_key=str(uuid.uuid4()),
        provisioning_nonce=str(uuid.uuid4()),
    )
    room = GroupMatrixRoom.objects.create(
        group=group,
        room_id=room_id,
        control_homeserver=control_homeserver,
        room_version="12",
        role=GroupRoomRole.ACTIVE,
    )
    group.active_room = room
    group.save(update_fields=("active_room", "updated_at"))
    return group, room


def event(event_type, room_id="!group:localhost", **overrides):
    """Build a valid state-event envelope."""
    value = {
        "event_id": f"${uuid.uuid4()}",
        "room_id": room_id,
        "sender": "@hub-bot:localhost",
        "state_key": "",
        "origin_server_ts": 1_700_000_000_000,
        "type": event_type,
        "content": {},
    }
    value.update(overrides)
    return value


def put_transaction(txn_id, events, *, client=None):
    """Send one authenticated AS transaction."""
    client = client or Client()
    return client.put(
        reverse("matrix-appservice-transaction", args=(txn_id,)),
        data=json.dumps({"events": events}),
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {HS_TOKEN}",
    )


def test_relevant_transaction_is_projected_before_ack():
    group, room = create_group_room()
    response = put_transaction(
        "txn-relevant",
        [
            event("m.room.name", content={"name": "New name"}),
            event(
                "m.room.member",
                state_key=CREATOR_MXID,
                content={"membership": "invite", "displayname": "Alice"},
            ),
            event(
                "m.room.member",
                state_key=CREATOR_MXID,
                content={"membership": "join", "displayname": "Alice"},
            ),
        ],
    )

    assert response.status_code == 200
    assert AppServiceTransaction.objects.filter(txn_id="txn-relevant").exists()
    room.refresh_from_db()
    group.refresh_from_db()
    assert room.name == "New name"
    assert group.status == GroupStatus.ACTIVE
    assert room.memberships.get(mxid=CREATOR_MXID).membership == MembershipState.JOIN


def test_irrelevant_and_malformed_events_are_deterministically_ignored():
    response = put_transaction(
        "txn-ignored",
        [
            event("m.room.message", content={"body": "secret"}),
            "not-an-object",
            event("m.room.name", content={"name": 123}),
        ],
    )

    assert response.status_code == 200
    assert AppServiceTransaction.objects.filter(txn_id="txn-ignored").exists()


def test_successful_duplicate_is_not_applied_twice():
    _, room = create_group_room()
    first_response = put_transaction(
        "txn-duplicate", [event("m.room.name", content={"name": "First"})]
    )
    marker = AppServiceTransaction.objects.get(txn_id="txn-duplicate")

    second_response = put_transaction(
        "txn-duplicate", [event("m.room.name", content={"name": "Second"})]
    )

    assert first_response.status_code == second_response.status_code == 200
    room.refresh_from_db()
    assert AppServiceTransaction.objects.filter(txn_id="txn-duplicate").count() == 1
    assert AppServiceTransaction.objects.get(txn_id="txn-duplicate").id == marker.id
    assert room.name == "First"


def test_successful_transaction_ignores_a_redelivery_with_different_payload():
    _, room = create_group_room()
    put_transaction(
        "txn-hash-mismatch", [event("m.room.name", content={"name": "Original"})]
    )
    response = put_transaction(
        "txn-hash-mismatch", [event("m.room.name", content={"name": "Forged"})]
    )

    assert response.status_code == 200
    room.refresh_from_db()
    assert AppServiceTransaction.objects.filter(txn_id="txn-hash-mismatch").count() == 1
    assert room.name == "Original"


def test_reducer_failure_rolls_back_all_effects_without_saving_a_marker():
    _, room = create_group_room()
    original_reduce_event = reducers.reduce_event
    calls = 0

    def fail_on_second_event(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("injected reducer failure")
        return original_reduce_event(*args, **kwargs)

    with patch("matrix_bridge.reducers.reduce_event", side_effect=fail_on_second_event):
        response = put_transaction(
            "txn-rollback",
            [
                event("m.room.name", content={"name": "Must roll back"}),
                event("m.room.topic", content={"topic": "Failure"}),
            ],
        )

    assert response.status_code == 500
    room.refresh_from_db()
    assert room.name == ""
    assert room.topic == ""
    assert not AppServiceTransaction.objects.filter(txn_id="txn-rollback").exists()


def test_failed_transaction_can_be_retried_and_marked_as_successful():
    _, room = create_group_room()
    with patch("matrix_bridge.reducers.reduce_event", side_effect=RuntimeError):
        first_response = put_transaction(
            "txn-retry", [event("m.room.name", content={"name": "Stored"})]
        )

    assert first_response.status_code == 500
    assert not AppServiceTransaction.objects.filter(txn_id="txn-retry").exists()

    second_response = put_transaction(
        "txn-retry", [event("m.room.name", content={"name": "Replacement"})]
    )

    assert AppServiceTransaction.objects.filter(txn_id="txn-retry").count() == 1
    assert second_response.status_code == 200
    room.refresh_from_db()
    assert room.name == "Replacement"


def test_unknown_room_metadata_cannot_create_registry_records():
    group_id = uuid.uuid4()
    response = put_transaction(
        "txn-unknown-metadata",
        [
            event(
                GROUP_METADATA_EVENT,
                room_id="!unknown:localhost",
                content={
                    "schema_version": 1,
                    "group_id": str(group_id),
                    "provisioning_nonce": "forged",
                },
            )
        ],
    )

    assert response.status_code == 200
    assert not Group.objects.filter(id=group_id).exists()
    assert not GroupMatrixRoom.objects.filter(room_id="!unknown:localhost").exists()


def test_foreign_registration_cannot_modify_a_registry_room(caplog):
    _, room = create_group_room(control_homeserver="matrix-foreign")
    response = put_transaction(
        "txn-foreign",
        [event("m.room.name", content={"name": "Foreign update"})],
    )

    assert response.status_code == 200
    room.refresh_from_db()
    assert room.name == ""
    assert "foreign registration" in caplog.text


@patch("requests.request")
def test_ingestion_never_calls_matrix_http(request):
    create_group_room()
    response = put_transaction(
        "txn-no-network", [event("m.room.name", content={"name": "Local only"})]
    )

    assert response.status_code == 200
    request.assert_not_called()


@pytest.mark.parametrize("payload", [[], "events", 42, {"events": {}}])
def test_invalid_json_envelopes_are_rejected(payload):
    response = Client().put(
        reverse("matrix-appservice-transaction", args=("txn-bad-envelope",)),
        data=json.dumps(payload),
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {HS_TOKEN}",
    )

    assert response.status_code == 400
    assert response.json()["errcode"] == "M_BAD_JSON"
    assert not AppServiceTransaction.objects.exists()


def test_invalid_homeserver_token_is_forbidden():
    response = Client().put(
        reverse("matrix-appservice-transaction", args=("txn-forbidden",)),
        data=json.dumps({"events": []}),
        content_type="application/json",
        HTTP_AUTHORIZATION="Bearer wrong-token",
    )

    assert response.status_code == 403
    assert response.json()["errcode"] == "M_FORBIDDEN"
    assert not AppServiceTransaction.objects.exists()


def test_invalid_json_syntax_is_rejected():
    response = Client().put(
        reverse("matrix-appservice-transaction", args=("txn-invalid-json",)),
        data=b"{",
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {HS_TOKEN}",
    )

    assert response.status_code == 400
    assert response.json()["errcode"] == "M_BAD_JSON"


def test_oversized_content_length_is_rejected_before_reading_the_body():
    response = Client().put(
        reverse("matrix-appservice-transaction", args=("txn-too-large",)),
        data=b"{}",
        content_type="application/json",
        CONTENT_LENGTH=str(5 * 1024 * 1024 + 1),
        HTTP_AUTHORIZATION=f"Bearer {HS_TOKEN}",
    )

    assert response.status_code == 413
    assert response.json()["errcode"] == "PAYLOAD_TOO_LARGE"
