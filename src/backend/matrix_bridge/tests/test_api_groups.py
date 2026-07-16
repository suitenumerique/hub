"""Focused tests for authoritative Matrix room candidate resolution."""

import uuid
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from core import factories

from matrix_bridge.client import MatrixBridgeError
from matrix_bridge.models import (
    Group,
    GroupMatrixRoom,
    GroupMembership,
    GroupRoomRole,
    GroupStatus,
    MatrixAccountBinding,
    MembershipState,
)

pytestmark = pytest.mark.django_db

RESOLVE_URL = "/api/v1.0/groups/resolve/"
ACCOUNT_ID = "matrix-local"
MXID = "@alice:localhost"


def create_group_room(*, user, room_id, membership=MembershipState.JOIN, status=None):
    """Create the smallest valid registry projection needed by the API."""
    group = Group.objects.create(
        status=status or GroupStatus.ACTIVE,
        created_by=user,
        created_by_matrix_id=MXID,
        created_via_account_id=ACCOUNT_ID,
        control_homeserver=ACCOUNT_ID,
        idempotency_key=str(uuid.uuid4()),
        provisioning_nonce=str(uuid.uuid4()),
    )
    room = GroupMatrixRoom.objects.create(
        group=group,
        room_id=room_id,
        control_homeserver=ACCOUNT_ID,
        room_version="12",
        role=GroupRoomRole.ACTIVE,
    )
    group.active_room = room
    group.save(update_fields=("active_room", "updated_at"))
    if membership:
        GroupMembership.objects.create(
            room=room,
            mxid=MXID,
            membership=membership,
        )
    return group


def resolve(client, room_ids):
    """Resolve candidate ids with the standard short-lived Matrix proof."""
    return client.post(
        RESOLVE_URL,
        {
            "matrix_account_id": ACCOUNT_ID,
            "matrix_access_token": "browser-token",
            "room_ids": room_ids,
        },
        format="json",
    )


def test_resolve_requires_an_authenticated_hub_user():
    """The public Matrix marker never exposes registry data anonymously."""
    response = resolve(APIClient(), ["!group:localhost"])

    assert response.status_code in (401, 403)


@patch(
    "matrix_bridge.services.MatrixClient.whoami",
    side_effect=MatrixBridgeError(
        "Invalid Matrix token.", status_code=403, errcode="M_UNKNOWN_TOKEN"
    ),
)
def test_resolve_requires_a_valid_matrix_identity_proof(_whoami):
    """A Hub session alone cannot resolve registry rooms for an arbitrary MXID."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)

    response = resolve(client, ["!group:localhost"])

    assert response.status_code == 403
    assert response.json()["code"] == "M_UNKNOWN_TOKEN"
    assert not MatrixAccountBinding.objects.filter(user=user).exists()


@patch("matrix_bridge.services.MatrixClient.whoami", return_value=MXID)
def test_resolve_confirms_only_visible_registry_rooms_and_deduplicates(_whoami):
    """Invites are visible, while forged, unrelated and failed rooms stay out."""
    user = factories.UserFactory()
    other_user = factories.UserFactory()
    official = create_group_room(
        user=other_user,
        room_id="!official:localhost",
        membership=MembershipState.INVITE,
    )
    joined = create_group_room(
        user=other_user,
        room_id="!joined:localhost",
        membership=MembershipState.JOIN,
    )
    created = create_group_room(
        user=user,
        room_id="!created:localhost",
        membership=None,
    )
    create_group_room(
        user=other_user,
        room_id="!unrelated:localhost",
        membership=None,
    )
    create_group_room(
        user=user,
        room_id="!failed:localhost",
        status=GroupStatus.FAILED,
    )
    client = APIClient()
    client.force_login(user)

    response = resolve(
        client,
        [
            "!official:localhost",
            "!official:localhost",
            "!joined:localhost",
            "!created:localhost",
            "!forged:localhost",
            "!unrelated:localhost",
            "!failed:localhost",
        ],
    )

    assert response.status_code == 200
    assert {group["id"] for group in response.json()["groups"]} == {
        str(official.id),
        str(joined.id),
        str(created.id),
    }
    assert MatrixAccountBinding.objects.filter(
        user=user, account_id=ACCOUNT_ID, mxid=MXID
    ).exists()


@patch("matrix_bridge.services.MatrixClient.whoami", return_value=MXID)
def test_resolve_is_not_limited_by_the_group_list_page_size(_whoami):
    """The resolver returns every candidate match instead of the first 20."""
    user = factories.UserFactory()
    room_ids = [f"!group-{index}:localhost" for index in range(21)]
    for room_id in room_ids:
        create_group_room(user=user, room_id=room_id)
    client = APIClient()
    client.force_login(user)

    response = resolve(client, room_ids)

    assert response.status_code == 200
    assert len(response.json()["groups"]) == 21
