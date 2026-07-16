"""Synchronous Matrix-to-PostgreSQL reconciliation helpers."""

import logging

from django.db import transaction
from django.utils import timezone

from matrix_bridge.client import MatrixClient, MatrixHomeserver
from matrix_bridge.models import Group, GroupMatrixRoom, GroupStatus
from matrix_bridge.reducers import reduce_event, sanitize_events

logger = logging.getLogger(__name__)

RECONCILIABLE_GROUP_STATUSES = (
    GroupStatus.AWAITING_REQUESTER_JOIN,
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


def reconcile_matrix_group(group_id) -> bool:
    """Pull and apply fresh room state unless a newer AS event won the race."""
    group = Group.objects.select_related("active_room").get(id=group_id)
    room = group.active_room
    if room is None:
        logger.info(
            "Skipping Matrix group reconciliation without an active room",
            extra={"matrix_group_id": str(group.id)},
        )
        return False

    snapshot_started_at = timezone.now()
    homeserver = MatrixHomeserver.for_account(group.control_homeserver)
    state = MatrixClient(homeserver).room_state(room.room_id)
    events = sanitize_events(state, default_room_id=room.room_id)

    with transaction.atomic():
        locked_group = Group.objects.select_for_update().get(id=group.id)
        if locked_group.active_room_id != room.id:
            logger.info(
                "Skipping stale Matrix reconciliation after an active-room change",
                extra={"matrix_group_id": str(group.id)},
            )
            return False
        locked_room = (
            GroupMatrixRoom.objects.select_for_update()
            .select_related("group")
            .get(id=room.id)
        )
        if locked_room.updated_at > snapshot_started_at:
            logger.info(
                "Skipping stale Matrix reconciliation after a newer AS event",
                extra={
                    "matrix_group_id": str(group.id),
                    "matrix_room_id": room.room_id,
                },
            )
            return False
        for event in events:
            reduce_event(locked_room, event, homeserver.bot_mxid)
        locked_group.last_reconciled_at = timezone.now()
        locked_group.save(update_fields=("last_reconciled_at", "updated_at"))

    logger.info(
        "Matrix group reconciliation completed",
        extra={
            "matrix_group_id": str(group.id),
            "matrix_room_id": room.room_id,
            "matrix_event_count": len(events),
        },
    )
    return True
