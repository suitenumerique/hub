"""Focused validation and reducer invariant tests."""

import uuid

import pytest

from matrix_bridge.models import GroupStatus, MembershipState
from matrix_bridge.reducers import reduce_event, sanitize_events
from matrix_bridge.services import GROUP_METADATA_EVENT
from matrix_bridge.tests.test_appservice import CREATOR_MXID, create_group_room, event

pytestmark = pytest.mark.django_db


def test_sanitizer_drops_message_bodies_and_non_dictionary_events():
    events = [
        event("m.room.message", content={"body": "do not retain"}),
        None,
        event("m.room.name", content={"name": "Allowed", "extra": "removed"}),
    ]

    assert sanitize_events(events) == [
        {key: value for key, value in events[2].items() if key != "content"}
        | {"content": {"name": "Allowed"}}
    ]


@pytest.mark.parametrize(
    "status",
    [GroupStatus.FAILED, GroupStatus.ARCHIVED, GroupStatus.DELETED],
)
def test_late_creator_join_does_not_reactivate_terminal_groups(status):
    group, room = create_group_room(status=status)

    reduce_event(
        room,
        event(
            "m.room.member",
            state_key=CREATOR_MXID,
            content={"membership": MembershipState.JOIN},
        ),
        "@hub-bot:localhost",
    )

    group.refresh_from_db()
    assert group.status == status


def test_creator_invite_and_other_member_join_do_not_activate_group():
    group, room = create_group_room()
    reduce_event(
        room,
        event(
            "m.room.member",
            state_key=CREATOR_MXID,
            content={"membership": MembershipState.INVITE},
        ),
        "@hub-bot:localhost",
    )
    reduce_event(
        room,
        event(
            "m.room.member",
            state_key="@bob:localhost",
            content={"membership": MembershipState.JOIN},
        ),
        "@hub-bot:localhost",
    )

    group.refresh_from_db()
    assert group.status == GroupStatus.AWAITING_REQUESTER_JOIN


@pytest.mark.parametrize("mismatch", ["group", "nonce"])
def test_inconsistent_metadata_is_ignored(mismatch):
    group, room = create_group_room()
    group_id = uuid.uuid4() if mismatch == "group" else group.id
    nonce = "wrong" if mismatch == "nonce" else group.provisioning_nonce

    reduce_event(
        room,
        event(
            GROUP_METADATA_EVENT,
            content={
                "schema_version": 1,
                "group_id": str(group_id),
                "provisioning_nonce": nonce,
            },
        ),
        "@hub-bot:localhost",
    )

    room.refresh_from_db()
    assert room.metadata_group_id is None
    assert room.metadata_schema_version is None
