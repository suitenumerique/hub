"""Matrix command workflows and minimal group projection helpers."""

import copy
import logging
from dataclasses import dataclass

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from matrix_bridge.client import MatrixBridgeError, MatrixClient, MatrixHomeserver
from matrix_bridge.models import (
    Group,
    GroupMember,
    GroupMemberRole,
    GroupRoom,
    GroupRoomRole,
    GroupStatus,
    MatrixAccountBinding,
    MatrixAccountBindingStatus,
)

logger = logging.getLogger(__name__)

GROUP_METADATA_EVENT = "fr.gouv.lasuite.hub.group.metadata"
GROUP_ROOM_TYPE = "fr.gouv.lasuite.hub.group"
CONTROL_ROOM_TYPE = "fr.gouv.lasuite.hub.control"
CONTROL_ROOM_ALIAS_LOCALPART = "_hub_control"


class PendingUpgradeRejected(Exception):
    """A permanent successor validation or Matrix authorization failure."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class VerifiedMatrixActor:
    """Short-lived proof resolved from Matrix; the token is deliberately omitted."""

    mxid: str
    homeserver: MatrixHomeserver


def verify_matrix_actor(
    user, account_id: str, access_token: str
) -> VerifiedMatrixActor:
    """Verify a browser-held Matrix token and persist only its identity binding."""
    if not access_token:
        raise MatrixBridgeError(
            "Matrix identity proof is required.",
            status_code=400,
            errcode="MATRIX_PROOF_REQUIRED",
        )
    homeserver = MatrixHomeserver.for_account(account_id)
    mxid = MatrixClient(homeserver).whoami(access_token)
    now = timezone.now()
    try:
        binding, created = MatrixAccountBinding.objects.get_or_create(
            user=user,
            account_id=account_id,
            defaults={
                "mxid": mxid,
                "homeserver": mxid.rsplit(":", 1)[-1],
                "verification_source": "matrix_whoami",
                "verified_at": now,
                "last_seen_at": now,
            },
        )
    except IntegrityError as error:
        raise MatrixBridgeError(
            "This Matrix account is already bound to another Hub user.",
            status_code=403,
            errcode="MATRIX_ACCOUNT_ALREADY_BOUND",
        ) from error
    if binding.status != MatrixAccountBindingStatus.ACTIVE:
        raise MatrixBridgeError(
            "Matrix account binding is revoked.",
            status_code=403,
            errcode="BINDING_REVOKED",
        )
    if not created and binding.mxid != mxid:
        raise MatrixBridgeError(
            "The selected Matrix account no longer matches its verified binding.",
            status_code=409,
            errcode="BINDING_MISMATCH",
        )
    if not created:
        binding.homeserver = mxid.rsplit(":", 1)[-1]
        binding.verified_at = now
        binding.last_seen_at = now
        binding.save(
            update_fields=(
                "homeserver",
                "verified_at",
                "last_seen_at",
                "updated_at",
            )
        )

    # A Matrix user can join before their Hub account is ever bound. Linking
    # the existing projections here makes the relation useful immediately.
    GroupMember.objects.filter(
        group__matrix_account_id=account_id,
        mxid=mxid,
    ).exclude(hub_user=user).update(hub_user=user)
    return VerifiedMatrixActor(mxid=mxid, homeserver=homeserver)


def control_room_alias(homeserver: MatrixHomeserver) -> str:
    """Return the one reserved control-room alias for a homeserver."""
    return f"#{CONTROL_ROOM_ALIAS_LOCALPART}:{homeserver.server_name}"


def ensure_control_room(client: MatrixClient) -> str:
    """Resolve or create the private room that authorizes restricted joins."""
    alias = control_room_alias(client.homeserver)
    try:
        return client.resolve_room_alias(alias)
    except MatrixBridgeError as error:
        if error.upstream_status_code != 404 and error.errcode != "M_NOT_FOUND":
            raise

    try:
        return client.create_room(
            {
                "room_alias_name": CONTROL_ROOM_ALIAS_LOCALPART,
                "visibility": "private",
                "preset": "private_chat",
                "is_direct": False,
                "creation_content": {
                    "m.federate": False,
                    "type": CONTROL_ROOM_TYPE,
                },
                "initial_state": [
                    {
                        "type": "m.room.join_rules",
                        "state_key": "",
                        "content": {"join_rule": "invite"},
                    },
                    {
                        "type": "m.room.history_visibility",
                        "state_key": "",
                        "content": {"history_visibility": "joined"},
                    },
                ],
            }
        )
    except MatrixBridgeError as error:
        # Two workers can both observe a missing alias. The alias is the
        # authority, so resolve the winner after an alias collision.
        if error.status_code not in {400, 409} and error.errcode not in {
            "M_ROOM_IN_USE",
            "M_UNKNOWN",
        }:
            raise
        return client.resolve_room_alias(alias)


def _validate_external_invitees(
    actor_mxid: str, invitees: list[str], allow_external_guests: bool
) -> None:
    """Enforce the selected external-guest policy against MXID domains."""
    if allow_external_guests:
        return
    actor_domain = actor_mxid.rsplit(":", 1)[-1]
    if any(mxid.rsplit(":", 1)[-1] != actor_domain for mxid in invitees):
        raise MatrixBridgeError(
            "External guests are disabled for this group.",
            status_code=400,
            errcode="EXTERNAL_GUESTS_DISABLED",
        )


def _power_levels(requester_mxid: str) -> dict:
    """Allow the owner to manage the group and initiate room upgrades."""
    return {
        "users": {requester_mxid: 75},
        "users_default": 0,
        "events_default": 0,
        "state_default": 100,
        "invite": 50,
        "kick": 50,
        "ban": 50,
        "redact": 50,
        "events": {
            "m.room.name": 50,
            GROUP_METADATA_EVENT: 50,
            # This is deliberately reachable by the level-75 owner so an
            # upgrade made from any Matrix client reaches the AppService.
            "m.room.tombstone": 75,
        },
    }


def _creation_payload(  # noqa: PLR0913  # pylint: disable=too-many-arguments
    *,
    group: Group,
    name: str,
    requester_mxid: str,
    control_room_id: str,
    predecessor_room_id: str | None = None,
    is_encrypted: bool = False,
) -> dict:
    """Build the minimal Matrix room created for one Hub group."""
    creation_content: dict = {"m.federate": True, "type": GROUP_ROOM_TYPE}
    if predecessor_room_id:
        creation_content["predecessor"] = {"room_id": predecessor_room_id}
    initial_state = [
        {
            "type": GROUP_METADATA_EVENT,
            "state_key": "",
            "content": {
                "emoji": group.emoji,
                "allow_external_guests": group.allow_external_guests,
            },
        },
        {
            "type": "m.room.join_rules",
            "state_key": "",
            "content": {
                "join_rule": "restricted",
                "allow": [
                    {
                        "type": "m.room_membership",
                        "room_id": control_room_id,
                    }
                ],
            },
        },
        {
            "type": "m.room.history_visibility",
            "state_key": "",
            "content": {"history_visibility": "shared"},
        },
    ]
    if is_encrypted:
        initial_state.append(
            {
                "type": "m.room.encryption",
                "state_key": "",
                "content": {"algorithm": "m.megolm.v1.aes-sha2"},
            }
        )
    return {
        "room_version": "12",
        "visibility": "private",
        "preset": "private_chat",
        "is_direct": False,
        "name": name,
        "creation_content": creation_content,
        "initial_state": initial_state,
        "power_level_content_override": _power_levels(requester_mxid),
    }


def _create_registry_group(  # noqa: PLR0913  # pylint: disable=too-many-arguments
    *,
    user,
    actor: VerifiedMatrixActor,
    account_id: str,
    idempotency_key: str,
    name: str,
    allow_external_guests: bool,
    emoji: str,
) -> tuple[Group, bool]:
    """Create the stable group once for one user idempotency key."""
    existing = Group.objects.filter(
        created_by=user, idempotency_key=idempotency_key
    ).first()
    if existing:
        return existing, False
    try:
        with transaction.atomic():
            group = Group.objects.create(
                name=name,
                created_by=user,
                created_by_matrix_id=actor.mxid,
                matrix_account_id=account_id,
                idempotency_key=idempotency_key,
                allow_external_guests=allow_external_guests,
                emoji=emoji,
            )
    except IntegrityError:
        existing = Group.objects.filter(
            created_by=user, idempotency_key=idempotency_key
        ).first()
        if existing:
            return existing, False
        raise
    return group, True


def _invite_targets(
    *,
    client: MatrixClient,
    room_id: str,
    requester_mxid: str,
    invitees: list[str],
) -> None:
    """Invite the owner first, with failures for other targets remaining partial."""
    for mxid in dict.fromkeys([requester_mxid, *invitees]):
        try:
            client.invite(room_id, mxid)
        except MatrixBridgeError:
            if mxid == requester_mxid:
                raise
            logger.warning(
                "Unable to invite Matrix group member",
                extra={"matrix_room_id": room_id, "matrix_invitee": mxid},
            )


def create_group(  # noqa: PLR0913  # pylint: disable=too-many-arguments
    *,
    user,
    account_id: str,
    access_token: str,
    idempotency_key: str,
    name: str,
    invitees: list[str],
    allow_external_guests: bool,
    emoji: str,
) -> Group:
    """Create one minimal Matrix group room and project only joined members."""
    actor = verify_matrix_actor(user, account_id, access_token)
    _validate_external_invitees(actor.mxid, invitees, allow_external_guests)
    with transaction.atomic():
        group, created = _create_registry_group(
            user=user,
            actor=actor,
            account_id=account_id,
            idempotency_key=idempotency_key,
            name=name,
            allow_external_guests=allow_external_guests,
            emoji=emoji,
        )
        if not created:
            return group

    client = MatrixClient(actor.homeserver)
    try:
        control_room_id = ensure_control_room(client)
        room_id = client.create_room(
            _creation_payload(
                group=group,
                name=name,
                requester_mxid=actor.mxid,
                control_room_id=control_room_id,
            )
        )
        GroupRoom.objects.create(
            group=group,
            room_id=room_id,
            role=GroupRoomRole.ACTIVE,
            sequence=0,
        )
        GroupMember.objects.create(
            group=group,
            mxid=actor.homeserver.bot_mxid,
            role=GroupMemberRole.BOT,
            power_level=100,
        )
        _invite_targets(
            client=client,
            room_id=room_id,
            requester_mxid=actor.mxid,
            invitees=invitees,
        )
        group.status = GroupStatus.AWAITING_JOIN
        group.save(update_fields=("status", "updated_at"))
    except MatrixBridgeError:
        group.status = GroupStatus.FAILED
        group.save(update_fields=("status", "updated_at"))
        raise
    return group


def _state_event(state: list[dict], event_type: str) -> dict:
    """Return one complete empty-key Matrix state event."""
    return next(
        (
            event
            for event in state
            if event.get("type") == event_type and event.get("state_key", "") == ""
        ),
        {},
    )


def _state_by_type(state: list[dict], event_type: str) -> dict:
    """Return the content of one empty-key Matrix state event."""
    return _state_event(state, event_type).get("content", {})


def _freeze_predecessor_best_effort(
    *,
    client: MatrixClient,
    room_id: str,
    access_token: str,
    actor_mxid: str,
    power_levels: dict,
) -> tuple[bool, str]:
    """Make the old timeline read-only when the requester has enough power."""
    actor_level = power_levels.get("users", {}).get(
        actor_mxid, power_levels.get("users_default", 0)
    )
    if actor_level <= 75:
        return False, "INSUFFICIENT_POWER_TO_FREEZE"

    frozen = copy.deepcopy(power_levels)
    for field in ("events_default", "state_default", "invite"):
        frozen[field] = max(frozen.get(field, 0), actor_level)
    events = frozen.setdefault("events", {})
    for event_type, required_level in list(events.items()):
        if required_level <= actor_level:
            events[event_type] = actor_level
    events["m.room.message"] = actor_level

    try:
        client.send_state(
            room_id,
            "m.room.power_levels",
            frozen,
            access_token=access_token,
        )
    except MatrixBridgeError:
        return False, "MATRIX_REJECTED_FREEZE"
    return True, ""


def promote_conversation(  # noqa: PLR0913
    # pylint: disable=too-many-arguments,too-many-locals
    *,
    user,
    account_id: str,
    access_token: str,
    idempotency_key: str,
    source_room_id: str,
    name: str,
    allow_external_guests: bool,
    emoji: str,
) -> Group:
    """Replace a multi-party conversation with a minimal Hub group successor."""
    actor = verify_matrix_actor(user, account_id, access_token)
    existing = Group.objects.filter(
        created_by=user, idempotency_key=idempotency_key
    ).first()
    if existing:
        return existing
    if GroupRoom.objects.filter(room_id=source_room_id).exists():
        raise MatrixBridgeError(
            "This room is already registered as a Hub group.",
            status_code=409,
            errcode="ALREADY_A_GROUP",
        )
    client = MatrixClient(actor.homeserver)
    state = client.room_state(source_room_id, access_token)
    joined = client.joined_members(source_room_id, access_token)
    if actor.mxid not in joined:
        raise MatrixBridgeError(
            "Requester is not joined to the source room.",
            status_code=403,
            errcode="REQUESTER_NOT_JOINED",
        )
    human_members = [mxid for mxid in joined if mxid != actor.homeserver.bot_mxid]
    if len(human_members) < 3:
        raise MatrixBridgeError(
            "A direct conversation cannot be transformed into a group.",
            status_code=400,
            errcode="DIRECT_CONVERSATION",
        )
    _validate_external_invitees(actor.mxid, human_members, allow_external_guests)

    power_levels = _state_by_type(state, "m.room.power_levels")
    actor_level = power_levels.get("users", {}).get(
        actor.mxid, power_levels.get("users_default", 0)
    )
    tombstone_level = power_levels.get("events", {}).get(
        "m.room.tombstone", power_levels.get("state_default", 50)
    )
    if actor_level < tombstone_level:
        raise MatrixBridgeError(
            "Requester cannot replace this conversation.",
            status_code=403,
            errcode="TOMBSTONE_FORBIDDEN",
        )

    with transaction.atomic():
        group, created = _create_registry_group(
            user=user,
            actor=actor,
            account_id=account_id,
            idempotency_key=idempotency_key,
            name=name,
            allow_external_guests=allow_external_guests,
            emoji=emoji,
        )
        if not created:
            return group
        GroupRoom.objects.create(
            group=group,
            room_id=source_room_id,
            role=GroupRoomRole.PREDECESSOR,
            sequence=0,
        )

    try:
        control_room_id = ensure_control_room(client)
        successor_id = client.create_room(
            _creation_payload(
                group=group,
                name=name,
                requester_mxid=actor.mxid,
                control_room_id=control_room_id,
                predecessor_room_id=source_room_id,
                is_encrypted=bool(_state_by_type(state, "m.room.encryption")),
            )
        )
        GroupRoom.objects.create(
            group=group,
            room_id=successor_id,
            role=GroupRoomRole.ACTIVE,
            sequence=1,
        )
        GroupMember.objects.create(
            group=group,
            mxid=actor.homeserver.bot_mxid,
            role=GroupMemberRole.BOT,
            power_level=100,
        )
        _invite_targets(
            client=client,
            room_id=successor_id,
            requester_mxid=actor.mxid,
            invitees=[mxid for mxid in human_members if mxid != actor.mxid],
        )
        client.send_state(
            source_room_id,
            "m.room.tombstone",
            {
                "body": "This conversation has been replaced by a Hub group",
                "replacement_room": successor_id,
            },
            access_token=access_token,
        )
        group.status = GroupStatus.AWAITING_JOIN
        group.save(update_fields=("status", "updated_at"))
        _freeze_predecessor_best_effort(
            client=client,
            room_id=source_room_id,
            access_token=access_token,
            actor_mxid=actor.mxid,
            power_levels=power_levels,
        )
    except MatrixBridgeError:
        group.status = GroupStatus.FAILED
        group.save(update_fields=("status", "updated_at"))
        raise
    return group


def _derive_role(mxid: str, power_level: int, bot_mxid: str) -> str:
    """Map Matrix power levels to the smaller role vocabulary exposed by Hub."""
    if mxid == bot_mxid:
        return GroupMemberRole.BOT
    if power_level >= 75:
        return GroupMemberRole.OWNER
    if power_level >= 50:
        return GroupMemberRole.MODERATOR
    return GroupMemberRole.MEMBER


def _joined_member_values(
    group: Group,
    joined: dict[str, dict],
    power_levels: dict,
    bot_mxid: str,
    creator_mxids: set[str],
) -> list[dict]:
    """Build the join-only projection values for one Matrix snapshot."""
    users = power_levels.get("users", {})
    users_default = power_levels.get("users_default", 0)
    bindings = {
        binding.mxid: binding.user
        for binding in MatrixAccountBinding.objects.filter(
            account_id=group.matrix_account_id,
            mxid__in=joined,
            status=MatrixAccountBindingStatus.ACTIVE,
        ).select_related("user")
    }
    values = []
    for mxid, details in joined.items():
        member_details = details if isinstance(details, dict) else {}
        level = users.get(mxid, users_default)
        if not isinstance(level, int) or isinstance(level, bool):
            level = 0
        # Room v12 creators have an implicit infinite power level and are
        # deliberately absent from m.room.power_levels.users. We only derive
        # that fact from the pulled create event; it is never mirrored in DB.
        if mxid in creator_mxids:
            level = 100
        if mxid == bot_mxid and mxid not in users:
            level = 100
        values.append(
            {
                "mxid": mxid,
                "hub_user": bindings.get(mxid),
                "display_name": member_details.get("display_name")
                or member_details.get("displayname")
                or "",
                "power_level": level,
                "role": _derive_role(mxid, level, bot_mxid),
            }
        )
    return values


def sync_group_snapshot(
    group: Group,
    state: list[dict],
    joined: dict[str, dict],
    bot_mxid: str,
) -> None:
    """Replace only the selected group metadata and current joined members."""
    power_levels = _state_by_type(state, "m.room.power_levels")
    create_event = _state_event(state, "m.room.create")
    create_content = create_event.get("content", {})
    creator_mxids = {
        value
        for value in (
            create_event.get("sender"),
            create_content.get("creator"),
        )
        if isinstance(value, str)
    }
    additional_creators = create_content.get("additional_creators", [])
    if isinstance(additional_creators, list):
        creator_mxids.update(
            value for value in additional_creators if isinstance(value, str)
        )
    members = _joined_member_values(
        group,
        joined,
        power_levels,
        bot_mxid,
        creator_mxids,
    )
    GroupMember.objects.filter(group=group).delete()
    for values in members:
        GroupMember.objects.create(group=group, **values)

    update_fields = {"updated_at"}
    name_event = _state_event(state, "m.room.name")
    name = name_event.get("content", {}).get("name")
    if isinstance(name, str) and len(name) <= 255:
        group.name = name
        update_fields.add("name")

    metadata = _state_by_type(state, GROUP_METADATA_EVENT)
    emoji = metadata.get("emoji")
    if isinstance(emoji, str) and len(emoji) <= 16:
        group.emoji = emoji
        update_fields.add("emoji")
    allow_external_guests = metadata.get("allow_external_guests")
    if isinstance(allow_external_guests, bool):
        group.allow_external_guests = allow_external_guests
        update_fields.add("allow_external_guests")

    if group.status in {GroupStatus.PROVISIONING, GroupStatus.AWAITING_JOIN}:
        group.status = (
            GroupStatus.ACTIVE
            if group.created_by_matrix_id in joined
            else GroupStatus.AWAITING_JOIN
        )
    else:
        # Once a group has become active, its business lifecycle is no longer
        # tied to the historical creator remaining in every successor room.
        group.status = GroupStatus.ACTIVE
    update_fields.add("status")
    group.save(update_fields=tuple(sorted(update_fields)))


def register_pending_upgrade(  # noqa: PLR0911
    # pylint: disable=too-many-return-statements
    active_room: GroupRoom,
    replacement_room_id: str,
) -> GroupRoom | None:
    """Record one successor announced by the active room's tombstone."""
    group = active_room.group
    if active_room.role != GroupRoomRole.ACTIVE or not replacement_room_id:
        return None
    if replacement_room_id == active_room.room_id:
        group.status = GroupStatus.MIGRATION_PENDING
        group.save(update_fields=("status", "updated_at"))
        logger.warning(
            "Ignoring cyclic Matrix room successor",
            extra={"matrix_group_id": str(group.id)},
        )
        return None

    existing_pending = group.rooms.filter(role=GroupRoomRole.SUCCESSOR_PENDING).first()
    if existing_pending:
        if existing_pending.room_id == replacement_room_id:
            return existing_pending
        group.status = GroupStatus.MIGRATION_PENDING
        group.save(update_fields=("status", "updated_at"))
        logger.warning(
            "Ignoring conflicting Matrix room successor",
            extra={"matrix_group_id": str(group.id)},
        )
        return None

    existing_room = GroupRoom.objects.filter(room_id=replacement_room_id).first()
    if existing_room:
        group.status = GroupStatus.MIGRATION_PENDING
        group.save(update_fields=("status", "updated_at"))
        logger.warning(
            "Ignoring cyclic or already registered Matrix successor",
            extra={"matrix_group_id": str(group.id)},
        )
        return None

    try:
        pending = GroupRoom.objects.create(
            group=group,
            room_id=replacement_room_id,
            role=GroupRoomRole.SUCCESSOR_PENDING,
            sequence=active_room.sequence + 1,
        )
    except (IntegrityError, ValidationError):
        group.status = GroupStatus.MIGRATION_PENDING
        group.save(update_fields=("status", "updated_at"))
        logger.warning(
            "Unable to register Matrix successor",
            extra={"matrix_group_id": str(group.id)},
        )
        return None
    group.status = GroupStatus.MIGRATION_PENDING
    group.save(update_fields=("status", "updated_at"))
    return pending


def _validate_successor_state(
    *, state: list[dict], predecessor_room_id: str, control_room_id: str
) -> None:
    """Reject a successor that is not the expected upgraded Hub room."""
    create = _state_by_type(state, "m.room.create")
    predecessor = create.get("predecessor", {})
    if (
        not isinstance(predecessor, dict)
        or predecessor.get("room_id") != predecessor_room_id
    ):
        raise PendingUpgradeRejected("INVALID_PREDECESSOR")
    if create.get("type") != GROUP_ROOM_TYPE:
        raise PendingUpgradeRejected("INVALID_ROOM_TYPE")

    join_rules = _state_by_type(state, "m.room.join_rules")
    allow = join_rules.get("allow", [])
    if join_rules.get("join_rule") != "restricted" or not any(
        isinstance(rule, dict)
        and rule.get("type") == "m.room_membership"
        and rule.get("room_id") == control_room_id
        for rule in allow
    ):
        raise PendingUpgradeRejected("INVALID_JOIN_RULE")


def _as_temporary_not_found(error: MatrixBridgeError) -> MatrixBridgeError:
    """Treat a not-yet-visible replacement room as retryable propagation lag."""
    if error.upstream_status_code == 404 or error.errcode == "M_NOT_FOUND":
        return MatrixBridgeError(
            "Matrix successor is not available yet.",
            status_code=503,
            errcode="MATRIX_SUCCESSOR_NOT_READY",
            upstream_status_code=error.upstream_status_code,
        )
    return error


def complete_pending_upgrade(  # pylint: disable=too-many-locals
    pending_room_id, *, via: list[str] | None = None
) -> bool:
    """Join, validate, snapshot and atomically activate one pending successor."""
    pending = (
        GroupRoom.objects.select_related("group")
        .filter(id=pending_room_id, role=GroupRoomRole.SUCCESSOR_PENDING)
        .first()
    )
    if pending is None:
        return False
    group = pending.group
    active = group.rooms.filter(role=GroupRoomRole.ACTIVE).first()
    if active is None:
        raise PendingUpgradeRejected("ACTIVE_ROOM_MISSING")

    homeserver = MatrixHomeserver.for_account(group.matrix_account_id)
    client = MatrixClient(homeserver)
    try:
        control_room_id = ensure_control_room(client)
        client.join(
            pending.room_id,
            via=via or [homeserver.server_name],
        )
        state = client.room_state(pending.room_id)
        joined = client.joined_members(pending.room_id)
    except MatrixBridgeError as original_error:
        error = _as_temporary_not_found(original_error)
        if error.is_temporary:
            if error is original_error:
                raise
            raise error from original_error
        raise PendingUpgradeRejected(error.errcode) from original_error

    _validate_successor_state(
        state=state,
        predecessor_room_id=active.room_id,
        control_room_id=control_room_id,
    )

    next_pending_id = None
    next_via = None
    with transaction.atomic():
        locked_group = Group.objects.select_for_update().get(id=group.id)
        locked_pending = (
            GroupRoom.objects.select_for_update()
            .select_related("group")
            .get(id=pending.id)
        )
        if locked_pending.role != GroupRoomRole.SUCCESSOR_PENDING:
            return False
        locked_active = GroupRoom.objects.select_for_update().get(
            group=locked_group, role=GroupRoomRole.ACTIVE
        )
        _validate_successor_state(
            state=state,
            predecessor_room_id=locked_active.room_id,
            control_room_id=control_room_id,
        )

        locked_active.role = GroupRoomRole.PREDECESSOR
        locked_active.save(update_fields=("role", "updated_at"))
        locked_pending.role = GroupRoomRole.ACTIVE
        locked_pending.save(update_fields=("role", "updated_at"))
        sync_group_snapshot(locked_group, state, joined, homeserver.bot_mxid)

        # If the bot only reached the successor after it had itself already
        # been upgraded, continue the same ordered chain on reconciliation.
        tombstone = _state_event(state, "m.room.tombstone")
        replacement = tombstone.get("content", {}).get("replacement_room")
        if isinstance(replacement, str):
            locked_pending.group = locked_group
            next_pending = register_pending_upgrade(locked_pending, replacement)
            if next_pending:
                next_pending_id = next_pending.id
                sender = tombstone.get("sender", "")
                sender_server = sender.rsplit(":", 1)[-1] if ":" in sender else None
                next_via = (
                    [sender_server] if sender_server else [homeserver.server_name]
                )
    if next_pending_id:
        complete_pending_upgrade(next_pending_id, via=next_via)
    return True


def complete_pending_upgrades_for_events(events: list[dict], *, account_id: str) -> int:
    """Attempt successors announced by this AS transaction, including retries."""
    completed = 0
    homeserver = MatrixHomeserver.for_account(account_id)
    candidates = []
    for event in events:
        if event.get("type") != "m.room.tombstone":
            continue
        replacement = event.get("content", {}).get("replacement_room")
        if not isinstance(replacement, str):
            continue
        sender = event.get("sender", "")
        sender_server = sender.rsplit(":", 1)[-1] if ":" in sender else None
        candidates.append((replacement, sender_server))

    for replacement, sender_server in candidates:
        pending = GroupRoom.objects.filter(
            room_id=replacement,
            role=GroupRoomRole.SUCCESSOR_PENDING,
            group__matrix_account_id=account_id,
        ).first()
        if pending is None:
            continue
        current = pending
        via = [sender_server] if sender_server else [homeserver.server_name]
        while current is not None:
            try:
                changed = complete_pending_upgrade(current.id, via=via)
            except PendingUpgradeRejected as error:
                logger.warning(
                    "Matrix successor remains pending after permanent rejection",
                    extra={
                        "matrix_group_id": str(current.group_id),
                        "matrix_upgrade_rejection": error.reason,
                    },
                )
                break
            if not changed:
                break
            completed += 1
            current = GroupRoom.objects.filter(
                group_id=current.group_id,
                role=GroupRoomRole.SUCCESSOR_PENDING,
            ).first()
            via = [homeserver.server_name]
    return completed
