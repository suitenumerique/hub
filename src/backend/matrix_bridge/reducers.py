"""Idempotent projection reducers for sanitized Matrix state events."""

import logging
import time
import uuid
from datetime import datetime
from datetime import timezone as datetime_timezone

from django.db import IntegrityError, transaction
from django.utils import timezone

from matrix_bridge.client import MatrixHomeserver
from matrix_bridge.models import (
    AppServiceTransaction,
    GroupMatrixRoom,
    GroupMemberRole,
    GroupMembership,
    GroupRoomRole,
    GroupStatus,
    MatrixAccountBinding,
    MatrixAccountBindingStatus,
    MembershipState,
)
from matrix_bridge.services import GROUP_METADATA_EVENT

logger = logging.getLogger(__name__)

ALLOWED_EVENT_TYPES = {
    "m.room.create",
    "m.room.member",
    "m.room.power_levels",
    "m.room.name",
    "m.room.topic",
    "m.room.avatar",
    "m.room.join_rules",
    "m.room.history_visibility",
    "m.room.encryption",
    "m.room.tombstone",
    "m.room.canonical_alias",
    GROUP_METADATA_EVENT,
}

CONTENT_KEYS = {
    "m.room.create": {"room_version", "type", "creator", "predecessor"},
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
    "m.room.topic": {"topic"},
    "m.room.avatar": {"url"},
    "m.room.join_rules": {"join_rule"},
    "m.room.history_visibility": {"history_visibility"},
    "m.room.encryption": {"algorithm"},
    "m.room.tombstone": {"body", "replacement_room"},
    "m.room.canonical_alias": {"alias", "alt_aliases"},
    GROUP_METADATA_EVENT: {
        "schema_version",
        "group_id",
        "provisioning_nonce",
        "archived",
        "emoji",
        "announcements_only",
        "allow_external_guests",
    },
}


def _is_int(value) -> bool:
    """Return whether a JSON value is an integer, excluding booleans."""
    return isinstance(value, int) and not isinstance(value, bool)


def _is_string(value, max_length: int) -> bool:
    """Return whether a value fits one bounded Django string field."""
    return isinstance(value, str) and len(value) <= max_length


def _has_valid_content(  # noqa: PLR0911  # pylint: disable=too-many-return-statements
    event_type: str, state_key: str, content: dict
) -> bool:
    """Validate values consumed by reducers and Django model fields."""
    if event_type == "m.room.member":
        return (
            bool(state_key)
            and content.get("membership") in MembershipState.values
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
                _is_string(event_name, 255) and _is_int(level)
                for event_name, level in content.get("events", {}).items()
            )
        )
    string_limits = {
        "m.room.name": (("name", 255),),
        "m.room.topic": (("topic", 65535),),
        "m.room.avatar": (("url", 255),),
        "m.room.join_rules": (("join_rule", 32),),
        "m.room.history_visibility": (("history_visibility", 32),),
        "m.room.encryption": (("algorithm", 255),),
        "m.room.tombstone": (("body", 65535), ("replacement_room", 255)),
    }
    if event_type in string_limits:
        return all(
            key not in content or _is_string(content[key], limit)
            for key, limit in string_limits[event_type]
        )
    if event_type == "m.room.create":
        predecessor = content.get("predecessor", {})
        return (
            ("room_version" not in content or _is_string(content["room_version"], 32))
            and ("type" not in content or _is_string(content["type"], 255))
            and ("creator" not in content or _is_string(content["creator"], 255))
            and isinstance(predecessor, dict)
            and (
                "room_id" not in predecessor or _is_string(predecessor["room_id"], 255)
            )
        )
    if event_type == "m.room.canonical_alias":
        aliases = content.get("alt_aliases", [])
        return (
            ("alias" not in content or _is_string(content["alias"], 255))
            and isinstance(aliases, list)
            and all(_is_string(alias, 255) for alias in aliases)
        )
    if event_type == GROUP_METADATA_EVENT:
        try:
            uuid.UUID(content.get("group_id", ""))
        except (AttributeError, TypeError, ValueError):
            return False
        boolean_keys = {"archived", "announcements_only", "allow_external_guests"}
        return (
            ("schema_version" not in content or _is_int(content["schema_version"]))
            and (
                "provisioning_nonce" not in content
                or _is_string(content["provisioning_nonce"], 255)
            )
            and ("emoji" not in content or _is_string(content["emoji"], 16))
            and all(
                key not in content or isinstance(content[key], bool)
                for key in boolean_keys
            )
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
    optional_strings = {"event_id": 255, "sender": 255}
    if any(
        key in event and not _is_string(event[key], limit)
        for key, limit in optional_strings.items()
    ):
        return None
    timestamp = event.get("origin_server_ts")
    if timestamp is not None and (not _is_int(timestamp) or timestamp < 0):
        return None
    allowed_keys = CONTENT_KEYS[event_type]
    sanitized_content = {key: content[key] for key in allowed_keys if key in content}
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
    """Retain only deterministic, valid, allowlisted Matrix state fields."""
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


def _event_datetime(event: dict) -> datetime:
    """Convert a Matrix millisecond timestamp, or use the current time."""
    timestamp = event.get("origin_server_ts")
    if isinstance(timestamp, int):
        return datetime.fromtimestamp(timestamp / 1000, tz=datetime_timezone.utc)
    return timezone.now()


def _derive_role(mxid: str, power_level: int | None, bot_mxid: str) -> str:
    """Map Matrix power levels to the simpler roles exposed by Hub."""
    if mxid == bot_mxid:
        return GroupMemberRole.BOT
    if (power_level or 0) >= 75:
        return GroupMemberRole.OWNER
    if (power_level or 0) >= 50:
        return GroupMemberRole.MODERATOR
    return GroupMemberRole.MEMBER


def reduce_event(  # noqa: PLR0912, PLR0915
    # pylint: disable=too-many-branches,too-many-statements
    room,
    event: dict,
    bot_mxid: str,
) -> None:
    """Converge one sanitized event onto a known registry room."""
    event_type = event.get("type")
    content = event.get("content", {})
    if event_type == GROUP_METADATA_EVENT:
        metadata_group_id = uuid.UUID(content["group_id"])
        nonce = content.get("provisioning_nonce")
        if metadata_group_id != room.group_id or (
            nonce is not None and nonce != room.group.provisioning_nonce
        ):
            logger.warning(
                "Ignoring inconsistent Matrix group metadata",
                extra={
                    "matrix_room_id": room.room_id,
                    "matrix_event_id": event.get("event_id"),
                    "matrix_group_id": str(room.group_id),
                },
            )
            return
    event_at = _event_datetime(event)
    room.last_state_event_at = event_at

    if event_type == "m.room.member":
        mxid = event.get("state_key")
        membership = content.get("membership")
        if not mxid or membership not in MembershipState.values:
            return
        existing = GroupMembership.objects.filter(room=room, mxid=mxid).first()
        power_level = (
            None if mxid == bot_mxid else (existing.power_level if existing else 0)
        )
        binding = MatrixAccountBinding.objects.filter(
            account_id=room.control_homeserver,
            mxid=mxid,
            status=MatrixAccountBindingStatus.ACTIVE,
        ).first()
        defaults = {
            "hub_user": binding.user if binding else None,
            "membership": membership,
            "display_name": content.get("displayname", ""),
            "power_level": power_level,
            "role": _derive_role(mxid, power_level, bot_mxid),
            "last_event_id": event.get("event_id", ""),
            "last_event_ts": event.get("origin_server_ts"),
        }
        if membership == MembershipState.INVITE:
            defaults["invited_at"] = event_at
        elif membership == MembershipState.JOIN:
            defaults["joined_at"] = event_at
        elif membership in (MembershipState.LEAVE, MembershipState.BAN):
            defaults["left_at"] = event_at
        GroupMembership.objects.update_or_create(
            room=room, mxid=mxid, defaults=defaults
        )
        group = room.group
        if (
            room.role == GroupRoomRole.ACTIVE
            and mxid == group.created_by_matrix_id
            and membership == MembershipState.JOIN
            and group.status == GroupStatus.AWAITING_REQUESTER_JOIN
        ):
            group.status = GroupStatus.ACTIVE
            group.save(update_fields=("status", "updated_at"))
            room.activated_at = room.activated_at or event_at
    elif event_type == "m.room.power_levels":
        users = content.get("users", {})
        users_default = content.get("users_default", 0)
        for membership in room.memberships.all():
            power_level = (
                None
                if membership.mxid == bot_mxid
                else users.get(membership.mxid, users_default)
            )
            membership.power_level = power_level
            membership.role = _derive_role(membership.mxid, power_level, bot_mxid)
            membership.save(update_fields=("power_level", "role", "updated_at"))
    elif event_type == "m.room.name":
        room.name = content.get("name", "")
    elif event_type == "m.room.topic":
        room.topic = content.get("topic", "")
    elif event_type == "m.room.avatar":
        room.avatar_mxc = content.get("url", "")
    elif event_type == "m.room.join_rules":
        room.join_rule = content.get("join_rule", "")
    elif event_type == "m.room.history_visibility":
        room.history_visibility = content.get("history_visibility", "")
    elif event_type == "m.room.encryption":
        room.is_encrypted = bool(content.get("algorithm"))
    elif event_type == "m.room.tombstone":
        room.successor_room_id = content.get("replacement_room")
        room.tombstone_event_id = event.get("event_id")
    elif event_type == "m.room.create":
        room.create_event_id = event.get("event_id")
        room.room_version = str(content.get("room_version", room.room_version))
        predecessor = content.get("predecessor", {})
        if isinstance(predecessor, dict):
            room.predecessor_room_id = predecessor.get("room_id")
    elif event_type == GROUP_METADATA_EVENT:
        room.metadata_schema_version = content.get("schema_version")
        room.metadata_group_id = uuid.UUID(content["group_id"])

    room.save()


def process_transaction(
    *,
    source_registration: str,
    source_homeserver: str,
    transaction_id: str,
    events: list[dict],
) -> bool:
    """Atomically project events and persist only a successful transaction marker."""
    started_at = time.monotonic()
    reducers_started_at = None
    known_room_event_count = 0
    unknown_room_event_count = 0
    foreign_room_event_count = 0
    if AppServiceTransaction.objects.filter(
        source_registration=source_registration, txn_id=transaction_id
    ).exists():
        logger.info(
            "Matrix AppService transaction already processed",
            extra={
                "matrix_registration": source_registration,
                "matrix_transaction_id": transaction_id,
                "matrix_duplicate": True,
            },
        )
        return False

    homeserver = MatrixHomeserver.for_account(source_homeserver)
    try:
        with transaction.atomic():
            reducers_started_at = time.monotonic()
            room_ids = sorted(
                {event["room_id"] for event in events if event.get("room_id")}
            )
            rooms = (
                GroupMatrixRoom.objects.select_for_update()
                .select_related("group")
                .filter(room_id__in=room_ids)
                .order_by("room_id")
            )
            rooms_by_id = {room.room_id: room for room in rooms}

            # A concurrent delivery may have completed while this request waited
            # for the room locks.
            if AppServiceTransaction.objects.filter(
                source_registration=source_registration, txn_id=transaction_id
            ).exists():
                return False

            for index, event in enumerate(events):
                room = rooms_by_id.get(event.get("room_id"))
                if room is None:
                    unknown_room_event_count += 1
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
                if room.control_homeserver != source_homeserver:
                    foreign_room_event_count += 1
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
                known_room_event_count += 1
                try:
                    reduce_event(room, event, homeserver.bot_mxid)
                except Exception:
                    logger.exception(
                        "Matrix AppService reducer failed",
                        extra={
                            "matrix_transaction_id": transaction_id,
                            "matrix_event_index": index,
                            "matrix_event_id": event.get("event_id"),
                            "matrix_event_type": event.get("type"),
                        },
                    )
                    raise

            AppServiceTransaction.objects.create(
                source_registration=source_registration,
                txn_id=transaction_id,
            )
    except IntegrityError:
        # A concurrent request may have inserted the same success marker. Its
        # transaction won; this request's projection changes were rolled back.
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
            "matrix_known_room_event_count": known_room_event_count,
            "matrix_unknown_room_event_count": unknown_room_event_count,
            "matrix_foreign_room_event_count": foreign_room_event_count,
            "matrix_duration_ms": round((time.monotonic() - started_at) * 1000, 2),
            "matrix_reducers_duration_ms": (
                round((time.monotonic() - reducers_started_at) * 1000, 2)
                if reducers_started_at is not None
                else 0
            ),
        },
    )
    return True
