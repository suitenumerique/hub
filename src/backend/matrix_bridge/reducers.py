"""Idempotent reducers for the deliberately small Matrix group projection."""

import logging
import time

from django.db import IntegrityError, transaction

from matrix_bridge.client import MatrixHomeserver
from matrix_bridge.models import (
    AppServiceTransaction,
    GroupMember,
    GroupMemberRole,
    GroupRoom,
    GroupRoomRole,
    GroupStatus,
    MatrixAccountBinding,
    MatrixAccountBindingStatus,
)
from matrix_bridge.services import GROUP_METADATA_EVENT, register_pending_upgrade

logger = logging.getLogger(__name__)

MATRIX_MEMBERSHIPS = {"invite", "join", "leave", "ban", "knock"}
ALLOWED_EVENT_TYPES = {
    "m.room.member",
    "m.room.power_levels",
    "m.room.name",
    "m.room.tombstone",
    GROUP_METADATA_EVENT,
}

CONTENT_KEYS = {
    "m.room.member": {"membership", "displayname"},
    "m.room.power_levels": {
        "users",
        "users_default",
        "events",
        "events_default",
        "state_default",
        "invite",
        "kick",
        "ban",
        "redact",
    },
    "m.room.name": {"name"},
    "m.room.tombstone": {"replacement_room"},
    GROUP_METADATA_EVENT: {"emoji", "allow_external_guests"},
}


def _is_int(value) -> bool:
    """Return whether a JSON value is an integer, excluding booleans."""
    return isinstance(value, int) and not isinstance(value, bool)


def _is_string(value, max_length: int) -> bool:
    """Return whether a value fits one bounded Django string field."""
    return isinstance(value, str) and len(value) <= max_length


def _has_valid_content(event_type: str, state_key: str, content: dict) -> bool:
    """Validate exactly the values consumed by the minimal reducers."""
    if event_type == "m.room.member":
        return (
            bool(state_key)
            and content.get("membership") in MATRIX_MEMBERSHIPS
            and (
                "displayname" not in content or _is_string(content["displayname"], 255)
            )
        )
    if event_type == "m.room.power_levels":
        users = content.get("users", {})
        numeric_keys = {
            "users_default",
            "events_default",
            "state_default",
            "invite",
            "kick",
            "ban",
            "redact",
        }
        return (
            isinstance(users, dict)
            and all(
                _is_string(mxid, 255) and _is_int(level)
                for mxid, level in users.items()
            )
            and all(key not in content or _is_int(content[key]) for key in numeric_keys)
            and isinstance(content.get("events", {}), dict)
            and all(
                _is_string(name, 255) and _is_int(level)
                for name, level in content.get("events", {}).items()
            )
        )
    if event_type == "m.room.name":
        return "name" not in content or _is_string(content["name"], 255)
    if event_type == "m.room.tombstone":
        return _is_string(content.get("replacement_room"), 255) and bool(
            content["replacement_room"]
        )
    if event_type == GROUP_METADATA_EVENT:
        return ("emoji" not in content or _is_string(content["emoji"], 16)) and (
            "allow_external_guests" not in content
            or isinstance(content["allow_external_guests"], bool)
        )
    return True


def _sanitize_event(  # noqa: PLR0911  # pylint: disable=too-many-return-statements
    event, default_room_id: str | None
) -> dict | None:
    """Keep one valid state event with only reducer-consumed fields."""
    if not isinstance(event, dict):
        return None
    event_type = event.get("type")
    if event_type not in ALLOWED_EVENT_TYPES:
        return None
    room_id = event.get("room_id", default_room_id)
    state_key = event.get("state_key")
    content = event.get("content")
    if not (
        _is_string(room_id, 255)
        and bool(room_id)
        and _is_string(state_key, 255)
        and isinstance(content, dict)
    ):
        return None
    for key in ("event_id", "sender"):
        if key in event and not _is_string(event[key], 255):
            return None
    timestamp = event.get("origin_server_ts")
    if timestamp is not None and (not _is_int(timestamp) or timestamp < 0):
        return None
    sanitized_content = {
        key: content[key] for key in CONTENT_KEYS[event_type] if key in content
    }
    if not _has_valid_content(event_type, state_key, sanitized_content):
        return None
    return {
        key: value
        for key, value in event.items()
        if key
        in {
            "event_id",
            "sender",
            "state_key",
            "origin_server_ts",
            "type",
        }
    } | {"room_id": room_id, "content": sanitized_content}


def sanitize_events(
    events: list[object], *, default_room_id: str | None = None
) -> list[dict]:
    """Drop messages and retain only valid fields used by the projection."""
    sanitized = []
    for index, event in enumerate(events):
        sanitized_event = _sanitize_event(event, default_room_id)
        if sanitized_event is not None:
            sanitized.append(sanitized_event)
        elif isinstance(event, dict) and event.get("type") in ALLOWED_EVENT_TYPES:
            logger.warning(
                "Ignoring malformed Matrix state event",
                extra={
                    "matrix_event_index": index,
                    "matrix_event_id": (
                        event.get("event_id")
                        if _is_string(event.get("event_id"), 255)
                        else None
                    ),
                    "matrix_event_type": event.get("type"),
                },
            )
    return sanitized


def _derive_role(mxid: str, power_level: int, bot_mxid: str) -> str:
    """Map Matrix power levels to the smaller Hub role vocabulary."""
    if mxid == bot_mxid:
        return GroupMemberRole.BOT
    if power_level >= 75:
        return GroupMemberRole.OWNER
    if power_level >= 50:
        return GroupMemberRole.MODERATOR
    return GroupMemberRole.MEMBER


def reduce_event(  # noqa: PLR0912  # pylint: disable=too-many-branches
    room: GroupRoom, event: dict, bot_mxid: str
) -> None:
    """Converge one sanitized event onto the active group's small projection."""
    # Historical and not-yet-validated rooms are identifiers only. Late state
    # events from them must never overwrite the current group projection.
    if room.role != GroupRoomRole.ACTIVE:
        return

    group = room.group
    event_type = event.get("type")
    content = event.get("content", {})
    if event_type == "m.room.member":
        mxid = event.get("state_key")
        membership = content.get("membership")
        if membership != "join":
            GroupMember.objects.filter(group=group, mxid=mxid).delete()
            return

        existing = GroupMember.objects.filter(group=group, mxid=mxid).first()
        if mxid == bot_mxid:
            power_level = existing.power_level if existing else 100
        elif mxid == group.created_by_matrix_id:
            power_level = existing.power_level if existing else 75
        else:
            power_level = existing.power_level if existing else 0
        binding = MatrixAccountBinding.objects.filter(
            account_id=group.matrix_account_id,
            mxid=mxid,
            status=MatrixAccountBindingStatus.ACTIVE,
        ).first()
        GroupMember.objects.update_or_create(
            group=group,
            mxid=mxid,
            defaults={
                "hub_user": binding.user if binding else None,
                "display_name": content.get("displayname", ""),
                "power_level": power_level,
                "role": _derive_role(mxid, power_level, bot_mxid),
            },
        )
        if (
            mxid == group.created_by_matrix_id
            and group.status == GroupStatus.AWAITING_JOIN
        ):
            group.status = GroupStatus.ACTIVE
            group.save(update_fields=("status", "updated_at"))
    elif event_type == "m.room.power_levels":
        users = content.get("users", {})
        users_default = content.get("users_default", 0)
        for member in group.members.all():
            level = users.get(member.mxid, users_default)
            if member.mxid == bot_mxid and member.mxid not in users:
                level = 100
            member.power_level = level
            member.role = _derive_role(member.mxid, level, bot_mxid)
            member.save(update_fields=("power_level", "role", "updated_at"))
    elif event_type == "m.room.name":
        group.name = content.get("name", "")
        group.save(update_fields=("name", "updated_at"))
    elif event_type == GROUP_METADATA_EVENT:
        update_fields = {"updated_at"}
        if "emoji" in content:
            group.emoji = content["emoji"]
            update_fields.add("emoji")
        if "allow_external_guests" in content:
            group.allow_external_guests = content["allow_external_guests"]
            update_fields.add("allow_external_guests")
        if len(update_fields) > 1:
            group.save(update_fields=tuple(sorted(update_fields)))
    elif event_type == "m.room.tombstone":
        register_pending_upgrade(room, content.get("replacement_room", ""))


def process_transaction(
    *,
    source_registration: str,
    source_homeserver: str,
    transaction_id: str,
    events: list[dict],
) -> bool:
    """Atomically project events and persist one successful transaction marker."""
    started_at = time.monotonic()
    if AppServiceTransaction.objects.filter(
        source_registration=source_registration, txn_id=transaction_id
    ).exists():
        return False

    homeserver = MatrixHomeserver.for_account(source_homeserver)
    try:
        with transaction.atomic():
            room_ids = sorted(
                {event["room_id"] for event in events if event.get("room_id")}
            )
            rooms = (
                GroupRoom.objects.select_for_update()
                .select_related("group")
                .filter(room_id__in=room_ids)
                .order_by("room_id")
            )
            rooms_by_id = {room.room_id: room for room in rooms}
            if AppServiceTransaction.objects.filter(
                source_registration=source_registration, txn_id=transaction_id
            ).exists():
                return False

            for index, event in enumerate(events):
                room = rooms_by_id.get(event.get("room_id"))
                if room is None:
                    logger.info(
                        "Ignoring Matrix event for an unknown registry room",
                        extra={
                            "matrix_transaction_id": transaction_id,
                            "matrix_event_index": index,
                            "matrix_event_id": event.get("event_id"),
                            "matrix_event_type": event.get("type"),
                        },
                    )
                    continue
                if room.group.matrix_account_id != source_homeserver:
                    logger.warning(
                        "Ignoring Matrix event from a foreign registration",
                        extra={
                            "matrix_registration": source_registration,
                            "matrix_transaction_id": transaction_id,
                            "matrix_event_index": index,
                            "matrix_event_id": event.get("event_id"),
                            "matrix_room_id": room.room_id,
                        },
                    )
                    continue
                reduce_event(room, event, homeserver.bot_mxid)

            AppServiceTransaction.objects.create(
                source_registration=source_registration,
                txn_id=transaction_id,
            )
    except IntegrityError:
        if AppServiceTransaction.objects.filter(
            source_registration=source_registration, txn_id=transaction_id
        ).exists():
            return False
        raise

    logger.info(
        "Matrix AppService transaction processing finished",
        extra={
            "matrix_registration": source_registration,
            "matrix_transaction_id": transaction_id,
            "matrix_event_count": len(events),
            "matrix_event_types": sorted(
                {event.get("type") for event in events if event.get("type")}
            ),
            "matrix_duration_ms": round((time.monotonic() - started_at) * 1000, 2),
        },
    )
    return True
