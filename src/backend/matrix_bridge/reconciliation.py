"""Synchronous reconciliation of the minimal Matrix group projection."""

import logging

from django.db import transaction

from matrix_bridge.client import MatrixClient, MatrixHomeserver
from matrix_bridge.models import Group, GroupRoom, GroupRoomRole, GroupStatus
from matrix_bridge.services import (
    PendingUpgradeRejected,
    complete_pending_upgrade,
    register_pending_upgrade,
    sync_group_snapshot,
)

logger = logging.getLogger(__name__)

RECONCILIABLE_GROUP_STATUSES = (
    GroupStatus.AWAITING_JOIN,
    GroupStatus.ACTIVE,
    GroupStatus.MIGRATION_PENDING,
)


def reconciliable_group_ids():
    """Return eligible group ids in a stable order."""
    return (
        Group.objects.filter(status__in=RECONCILIABLE_GROUP_STATUSES)
        .order_by("id")
        .values_list("id", flat=True)
    )


def _empty_state_event(state: list[dict], event_type: str) -> dict:
    """Return one empty-state-key event without retaining it."""
    return next(
        (
            event
            for event in state
            if event.get("type") == event_type and event.get("state_key", "") == ""
        ),
        {},
    )


def reconcile_matrix_group(group_id) -> bool:
    """Retry a pending upgrade or refresh only selected active-room data."""
    group = Group.objects.get(id=group_id)
    pending = group.rooms.filter(role=GroupRoomRole.SUCCESSOR_PENDING).first()
    if pending:
        try:
            return complete_pending_upgrade(pending.id)
        except PendingUpgradeRejected as error:
            logger.warning(
                "Matrix group successor is still invalid",
                extra={
                    "matrix_group_id": str(group.id),
                    "matrix_upgrade_rejection": error.reason,
                },
            )
            return False

    homeserver = MatrixHomeserver.for_account(group.matrix_account_id)
    client = MatrixClient(homeserver)
    discovered_pending_id = None
    with transaction.atomic():
        locked_group = Group.objects.select_for_update().get(id=group.id)
        active = (
            GroupRoom.objects.select_for_update()
            .filter(group=locked_group, role=GroupRoomRole.ACTIVE)
            .first()
        )
        if active is None:
            logger.info(
                "Skipping Matrix group reconciliation without an active room",
                extra={"matrix_group_id": str(group.id)},
            )
            return False

        # Holding the active-room lock ensures any AppService event received
        # after this snapshot is applied after it, avoiding stale overwrite
        # without storing reconciliation timestamps.
        state = client.room_state(active.room_id)
        joined = client.joined_members(active.room_id)
        sync_group_snapshot(locked_group, state, joined, homeserver.bot_mxid)

        tombstone = _empty_state_event(state, "m.room.tombstone")
        replacement = tombstone.get("content", {}).get("replacement_room")
        if isinstance(replacement, str):
            active.group = locked_group
            pending = register_pending_upgrade(active, replacement)
            discovered_pending_id = pending.id if pending else None

    if discovered_pending_id:
        sender = tombstone.get("sender", "")
        via = [sender.rsplit(":", 1)[-1]] if ":" in sender else None
        try:
            complete_pending_upgrade(discovered_pending_id, via=via)
        except PendingUpgradeRejected as error:
            logger.warning(
                "Discovered Matrix successor remains pending",
                extra={
                    "matrix_group_id": str(group.id),
                    "matrix_upgrade_rejection": error.reason,
                },
            )

    logger.info(
        "Matrix group reconciliation completed",
        extra={"matrix_group_id": str(group.id)},
    )
    return True
