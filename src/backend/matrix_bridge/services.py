"""Command-side workflows for creation, promotion and identity verification."""

import copy
import secrets
from dataclasses import dataclass

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from matrix_bridge.client import MatrixBridgeError, MatrixClient, MatrixHomeserver
from matrix_bridge.models import (
    Group,
    GroupMatrixRoom,
    GroupMemberRole,
    GroupMembership,
    GroupRoomRole,
    GroupStatus,
    MatrixAccountBinding,
    MatrixAccountBindingStatus,
    MembershipState,
)

GROUP_METADATA_EVENT = "fr.gouv.lasuite.hub.group.metadata"
GROUP_ROOM_TYPE = "fr.gouv.lasuite.hub.group"


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
    return VerifiedMatrixActor(mxid=mxid, homeserver=homeserver)


def _validate_external_invitees(
    actor_mxid: str, invitees: list[str], allow_external_guests: bool
) -> None:
    """Enforce the modal's external-guest policy against MXID domains."""
    if allow_external_guests:
        return
    actor_domain = actor_mxid.rsplit(":", 1)[-1]
    if any(mxid.rsplit(":", 1)[-1] != actor_domain for mxid in invitees):
        raise MatrixBridgeError(
            "External guests are disabled for this group.",
            status_code=400,
            errcode="EXTERNAL_GUESTS_DISABLED",
        )


def _power_levels(requester_mxid: str, announcements_only: bool) -> dict:
    """Build the permissions installed when Matrix creates the room."""
    # Moderators may edit visible room details; tombstones stay bot-controlled.
    events = {
        "m.room.name": 50,
        "m.room.topic": 50,
        "m.room.avatar": 50,
        "m.room.tombstone": 200,
    }
    if announcements_only:
        # Regular members have level 0, so level 50 makes the room read-only.
        events["m.room.message"] = 50
    return {
        # The requester owns the group without reaching protected bot levels.
        "users": {requester_mxid: 75},
        # Unlisted members and ordinary timeline events keep level 0.
        "users_default": 0,
        "events_default": 0,
        # Unlisted state changes require the room-v12 creator bot.
        "state_default": 150,
        # Owners and moderators may manage members and redact their events.
        "invite": 50,
        "kick": 50,
        "ban": 50,
        "redact": 50,
        "events": events,
    }


def _creation_payload(  # noqa: PLR0913  # pylint: disable=too-many-arguments
    *,
    group: Group,
    name: str,
    topic: str,
    requester_mxid: str,
    predecessor_room_id: str | None = None,
    is_encrypted: bool = False,
) -> dict:
    """Build a Matrix createRoom request with Hub state and permissions.

    See https://spec.matrix.org/latest/client-server-api/#post_matrixclientv3createroom
    """
    marker_mode = group_marker_mode()
    # creation_content becomes part of the immutable m.room.create event.
    creation_content: dict = {"m.federate": True}
    if marker_mode == "type_and_state":
        creation_content["type"] = GROUP_ROOM_TYPE
    if predecessor_room_id:
        creation_content["predecessor"] = {"room_id": predecessor_room_id}
    # initial_state is installed by Matrix while creating the room.
    initial_state = [
        {
            "type": GROUP_METADATA_EVENT,
            "state_key": "",
            "content": {
                "schema_version": 1,
                "group_id": str(group.id),
                "provisioning_nonce": group.provisioning_nonce,
                "archived": False,
                "emoji": group.emoji,
                "announcements_only": group.announcements_only,
                "allow_external_guests": group.allow_external_guests,
            },
        },
        {
            "type": "m.room.join_rules",
            "state_key": "",
            "content": {"join_rule": "invite"},
        },
        {
            "type": "m.room.history_visibility",
            "state_key": "",
            "content": {"history_visibility": "shared"},
        },
    ]
    if is_encrypted:
        # Encryption is enabled by adding its state event at creation time.
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
        "topic": topic,
        "creation_content": creation_content,
        "initial_state": initial_state,
        "power_level_content_override": _power_levels(
            requester_mxid, group.announcements_only
        ),
    }


def group_marker_mode() -> str:
    """Resolve and validate the deployment's client-compatibility mode."""
    mode = settings.MATRIX_GROUP_MARKER_MODE
    if mode not in {"type_and_state", "state_only"}:
        raise RuntimeError(
            "MATRIX_GROUP_MARKER_MODE must be type_and_state or state_only"
        )
    return mode


def _create_registry_group(  # noqa: PLR0913  # pylint: disable=too-many-arguments
    *,
    user,
    actor: VerifiedMatrixActor,
    account_id: str,
    idempotency_key: str,
    announcements_only: bool,
    allow_external_guests: bool,
    emoji: str,
) -> tuple[Group, bool]:
    """Create the stable group once for one user idempotency key."""
    # Fast path for a normal retry of the same frontend request.
    existing = Group.objects.filter(
        created_by=user, idempotency_key=idempotency_key
    ).first()
    if existing:
        return existing, False
    try:
        with transaction.atomic():
            group = Group.objects.create(
                created_by=user,
                created_by_matrix_id=actor.mxid,
                created_via_account_id=account_id,
                control_homeserver=actor.homeserver.account_id,
                idempotency_key=idempotency_key,
                provisioning_nonce=secrets.token_urlsafe(32),
                announcements_only=announcements_only,
                allow_external_guests=allow_external_guests,
                emoji=emoji,
            )
    except IntegrityError:
        # The database constraint resolves two concurrent identical requests.
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
) -> list[dict]:
    """Invite the owner first, then every distinct target independently."""
    results = []
    # The requester goes first because the group is unusable without its owner.
    ordered_targets = [requester_mxid, *invitees]
    for mxid in dict.fromkeys(ordered_targets):
        try:
            client.invite(room_id, mxid)
        except MatrixBridgeError as error:
            results.append(
                {"mxid": mxid, "status": "failed", "error_code": error.errcode}
            )
            # Other invite failures are partial; an owner failure aborts creation.
            if mxid == requester_mxid:
                raise
        else:
            results.append({"mxid": mxid, "status": "pending"})
    return results


def create_group(  # noqa: PLR0913  # pylint: disable=too-many-arguments
    *,
    user,
    account_id: str,
    access_token: str,
    idempotency_key: str,
    name: str,
    topic: str,
    invitees: list[str],
    announcements_only: bool,
    allow_external_guests: bool,
    emoji: str,
) -> Group:
    """Create one hardened v12 room and invite requester/targets separately."""
    actor = verify_matrix_actor(user, account_id, access_token)
    _validate_external_invitees(actor.mxid, invitees, allow_external_guests)
    with transaction.atomic():
        group, created = _create_registry_group(
            user=user,
            actor=actor,
            account_id=account_id,
            idempotency_key=idempotency_key,
            announcements_only=announcements_only,
            allow_external_guests=allow_external_guests,
            emoji=emoji,
        )
        if not created:
            return group

    client = MatrixClient(actor.homeserver)
    try:
        room_id = client.create_room(
            _creation_payload(
                group=group,
                name=name,
                topic=topic,
                requester_mxid=actor.mxid,
            )
        )
        room = GroupMatrixRoom.objects.create(
            group=group,
            room_id=room_id,
            control_homeserver=actor.homeserver.account_id,
            room_version="12",
            role=GroupRoomRole.ACTIVE,
            sequence=0,
            is_hardened=True,
            marker_mode=group_marker_mode(),
            metadata_schema_version=1,
            metadata_group_id=group.id,
            name=name,
            topic=topic,
            join_rule="invite",
            history_visibility="shared",
        )
        group.active_room = room
        group.save(update_fields=("active_room", "updated_at"))
        results = _invite_targets(
            client=client,
            room_id=room_id,
            requester_mxid=actor.mxid,
            invitees=invitees,
        )
        group.status = GroupStatus.AWAITING_REQUESTER_JOIN
        group.save(update_fields=("status", "updated_at"))
        GroupMembership.objects.update_or_create(
            room=room,
            mxid=actor.homeserver.bot_mxid,
            defaults={
                "membership": MembershipState.JOIN,
                "role": GroupMemberRole.BOT,
                "power_level": None,
                "joined_at": timezone.now(),
            },
        )
        for result in results:
            GroupMembership.objects.update_or_create(
                room=room,
                mxid=result["mxid"],
                defaults={
                    "membership": MembershipState.INVITE,
                    "role": (
                        GroupMemberRole.OWNER
                        if result["mxid"] == actor.mxid
                        else GroupMemberRole.MEMBER
                    ),
                    "power_level": 75 if result["mxid"] == actor.mxid else 0,
                    "invited_at": timezone.now(),
                },
            )
    except MatrixBridgeError:
        group.status = GroupStatus.FAILED
        group.save(update_fields=("status", "updated_at"))
        raise
    return group


def _state_by_type(state: list[dict], event_type: str) -> dict:
    """Return the content of one empty-key Matrix state event."""
    return next(
        (
            event.get("content", {})
            for event in state
            if event.get("type") == event_type and event.get("state_key", "") == ""
        ),
        {},
    )


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


def _freeze_predecessor_best_effort(
    *,
    client: MatrixClient,
    room_id: str,
    access_token: str,
    actor_mxid: str,
    power_levels: dict,
) -> tuple[bool, str]:
    """Raise old-room event thresholds above the Hub human ceiling when possible."""
    actor_level = power_levels.get("users", {}).get(
        actor_mxid, power_levels.get("users_default", 0)
    )
    if actor_level <= 75:
        return False, "INSUFFICIENT_POWER_TO_FREEZE"

    frozen = copy.deepcopy(power_levels)
    freeze_level = actor_level
    for field in ("events_default", "state_default", "invite"):
        frozen[field] = max(frozen.get(field, 0), freeze_level)

    events = frozen.setdefault("events", {})
    for event_type, required_level in list(events.items()):
        if required_level <= actor_level:
            events[event_type] = max(required_level, freeze_level)
    events["m.room.message"] = freeze_level

    # When Matrix permits an admin to lower their own level in the same event,
    # do so to make the room read-only for them as well. Some arbitrary source
    # rooms reject that transition; the fallback still blocks every PL<=75
    # human, which is the V0 invariant promised by the promotion workflow.
    users = frozen.setdefault("users", {})
    actor_previous_level = users.get(actor_mxid)
    if actor_previous_level is not None and actor_previous_level > 75:
        users[actor_mxid] = 75

    try:
        client.send_state(
            room_id,
            "m.room.power_levels",
            frozen,
            access_token=access_token,
        )
    except MatrixBridgeError:
        if actor_previous_level is None or actor_previous_level <= 75:
            return False, "MATRIX_REJECTED_FREEZE"
        users[actor_mxid] = actor_previous_level
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
    # pylint: disable=too-many-arguments,too-many-locals,too-many-statements
    *,
    user,
    account_id: str,
    access_token: str,
    idempotency_key: str,
    source_room_id: str,
    name: str,
    topic: str,
    announcements_only: bool,
    allow_external_guests: bool,
    emoji: str,
) -> Group:
    """Replace a multi-party conversation with a hardened group successor."""
    if GroupMatrixRoom.objects.filter(room_id=source_room_id).exists():
        raise MatrixBridgeError(
            "This room is already registered as a Hub group.",
            status_code=409,
            errcode="ALREADY_A_GROUP",
        )
    actor = verify_matrix_actor(user, account_id, access_token)
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
            announcements_only=announcements_only,
            allow_external_guests=allow_external_guests,
            emoji=emoji,
        )
        if not created:
            return group
        create_event = _state_event(state, "m.room.create")
        predecessor = GroupMatrixRoom.objects.create(
            group=group,
            room_id=source_room_id,
            control_homeserver=actor.homeserver.account_id,
            room_version=str(create_event.get("content", {}).get("room_version", "")),
            role=GroupRoomRole.PREDECESSOR,
            sequence=0,
            create_event_id=create_event.get("event_id"),
            is_hardened=False,
            marker_mode="state_only",
            name=_state_by_type(state, "m.room.name").get("name", name),
            topic=_state_by_type(state, "m.room.topic").get("topic", topic),
            avatar_mxc=_state_by_type(state, "m.room.avatar").get("url", ""),
            is_encrypted=bool(_state_by_type(state, "m.room.encryption")),
            join_rule=_state_by_type(state, "m.room.join_rules").get("join_rule", ""),
            history_visibility=_state_by_type(state, "m.room.history_visibility").get(
                "history_visibility", ""
            ),
        )

    try:
        successor_id = client.create_room(
            _creation_payload(
                group=group,
                name=name,
                topic=topic,
                requester_mxid=actor.mxid,
                predecessor_room_id=source_room_id,
                is_encrypted=predecessor.is_encrypted,
            )
        )
        successor = GroupMatrixRoom.objects.create(
            group=group,
            room_id=successor_id,
            control_homeserver=actor.homeserver.account_id,
            room_version="12",
            role=GroupRoomRole.ACTIVE,
            sequence=1,
            predecessor_room_id=source_room_id,
            is_hardened=True,
            marker_mode=group_marker_mode(),
            metadata_schema_version=1,
            metadata_group_id=group.id,
            name=name,
            topic=topic,
            join_rule="invite",
            history_visibility="shared",
            is_encrypted=predecessor.is_encrypted,
        )
        predecessor.successor_room_id = successor_id
        predecessor.save(update_fields=("successor_room_id", "updated_at"))
        group.active_room = successor
        group.save(update_fields=("active_room", "updated_at"))
        invitees = [mxid for mxid in human_members if mxid != actor.mxid]
        _invite_targets(
            client=client,
            room_id=successor_id,
            requester_mxid=actor.mxid,
            invitees=invitees,
        )
        tombstone_event_id = client.send_state(
            source_room_id,
            "m.room.tombstone",
            {
                "body": "This conversation has been replaced by a Hub group",
                "replacement_room": successor_id,
            },
            access_token=access_token,
        )
        predecessor.tombstone_event_id = tombstone_event_id
        predecessor.save(update_fields=("tombstone_event_id", "updated_at"))
        group.status = GroupStatus.AWAITING_REQUESTER_JOIN
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
