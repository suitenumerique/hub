import copy
import datetime
import json
import logging
import re
from typing import Optional, Self, Tuple
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from lasuite.drf.models.choices import RoleChoices

from core.models import Group, GroupAccess
from hub.configuration import MatrixHomeserverConfig, MessagingBackendKind
from messaging_backends.matrix.models import (
    MatrixRoom,
    MatrixRoomState,
    MatrixSyncState,
    MatrixUser,
)

from .client import MatrixClient, MatrixClientError

logger = logging.getLogger(__name__)


class MatrixServiceError(Exception):
    """A failure during Matrix service operations."""


def _check_invitees_same_homeserver(
    actor_mxid: str, invitees: list[str]
) -> bool:
    """Enforce the selected external-guest policy against MXID domains."""
    actor_domain = actor_mxid.rsplit(":", 1)[-1]
    return not any(mxid.rsplit(":", 1)[-1] != actor_domain for mxid in invitees)


class MatrixService:
    """Service class for interacting with a Matrix homeserver."""

    @classmethod
    def from_homeserver_hrid(cls, backend_hrid: str, hrid: str) -> Self:
        """Create a MatrixService instance from a homeserver HRID."""
        for backend_config in settings.MESSAGING_BACKEND_CONFIG:
            if backend_config.hrid == backend_hrid and backend_config.kind == MessagingBackendKind.MATRIX:
                for homeserver_config in backend_config.mx_homeserver:
                    if homeserver_config.hrid == hrid:
                        return cls(homeserver_config)
        raise ValueError(f"No Matrix homeserver config found for HRID: {hrid}")

    def __init__(self, homeserver_config: MatrixHomeserverConfig):
        self.homeserver_hrid = homeserver_config.hrid
        self.homeserver_config = homeserver_config
        self.client = MatrixClient(homeserver_config)

    def _get_user_mx_id(self, user: settings.AUTH_USER_MODEL, user_access_token: str):
        """Update or create a MatrixUser entry for the given Hub user."""
        try:
            mx_user = MatrixUser.objects.get(user=user, homeserver_hrid=self.homeserver_hrid)
        except MatrixUser.DoesNotExist:
            mx_user = None
        
        if not mx_user or mx_user.updated_at < (timezone.now() - datetime.timedelta(days=7)):
            user_mx_id = self.client.whoami(user_access_token)
        
            mx_user, _updated = MatrixUser.objects.update_or_create(
                user=user,
                homeserver_hrid=self.homeserver_hrid,
                defaults={
                    "mx_id": user_mx_id,
                },
            )
        
            logger.info(
                "user=%s, homeserver=%s, mx_user=%s, mx_id=%s, action=matrix-updated-mx-id",
                user.pk,
                self.homeserver_hrid,
                user_mx_id,
                mx_user.pk,
            )

        return mx_user.mx_id
    
    def get_or_create_control_room(self) -> Tuple[str, bool]:
        """Ensure the control room exists and return its room ID."""
        control_room_alias_id = self.client.resolve_room_alias(
            self.homeserver_config.control_room_alias,
        )
        
        if control_room_alias_id is None:
            creation_data = self.client.create_room(
                room_alias_name=self.homeserver_config.control_room_alias_localpart,
                is_direct=False,
                creation_content={
                    "m.federate": False,
                    "type": "fr.gouv.lasuite.hub.control",
                },
                initial_state=[
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
                preset="private_chat",
            )
        
            return creation_data["room_id"], True
        
        return control_room_alias_id, False
        
    @transaction.atomic
    def create_room_for_group(
        self,
        user: settings.AUTH_USER_MODEL,
        user_access_token: str,
        name: str,
        invitees: Optional[list[str]]=None,
        allow_external_guests: bool=False,
        is_encrypted: bool=False,
        emoji: Optional[str]=None,
    ) -> Group:
        """
        Create a new Matrix room for a group and store it in the database.

        Steps:
        1. Validate the invitees against the external guest policy.
        2. Create the room on the Matrix homeserver with the specified parameters.
           The creator is the user.
           The room as a control room which only contains the bot, which makes
           the bot able to join without invitation.
        3. The bot joins the room.

        params:
            user: The Hub user creating the room.
            user_access_token: The access token of the Hub user for Matrix authentication.
            name: The name of the room to be created.
            invitees: A list of Matrix IDs to invite to the room.
            allow_external_guests: Whether to allow external guests in the room.
        """
        user_mx_id = self._get_user_mx_id(user, user_access_token)

        if (
                not allow_external_guests
                and invitees
                and not _check_invitees_same_homeserver(user_mx_id, invitees)
        ):
                raise MatrixServiceError("External guests are not allowed in this room.")  # XXX Use a custom exception class for better error handling
        
        # Create room
        initial_state = self._group_initial_state(
            allow_external_guests=allow_external_guests,
            emoji=emoji,
            is_encrypted=is_encrypted,
        )

        room_id = self.client.create_room(
            room_name=name,
            is_direct=False,
            creation_content={
                "m.federate": True,
                "type": "fr.gouv.lasuite.hub.group",
            },
            initial_state=initial_state,
            invite=invitees,
            power_level_content_override={
                "users": {
                    user_mx_id: 100,
                    self.homeserver_config.bot_mxid: 110,
                },
                "users_default": 0,
                "events_default": 0,
                "state_default": 100,
                "invite": 50,
                "kick": 50,
                "ban": 50,
                "redact": 50,
                "events": {
                    "m.room.name": 50,
                    "fr.gouv.lasuite.hub.group.metadata": 50,
                    # This is deliberately reachable by the level-75 owner so an
                    # upgrade made from any Matrix client reaches the AppService.
                    "m.room.tombstone": 75,
                },
            },
            preset="private_chat",
            topic=None,
            auth_user=user_mx_id,
            auth_access_token=user_access_token,
        )["room_id"]

        # Make the bot join the room
        self.client.join(
            room_id,
            user_mxid=self.homeserver_config.bot_mxid,
            user_access_token=self.homeserver_config.access_token,
            via=[self.homeserver_config.server_name],
        )

        # Store the group & room in the database
        group = Group.objects.create(  # XXX: manage privacy
            created_by=user,
            name=name,
            emoji=emoji,
        )
        MatrixRoom.objects.create(
            group=group,
            room_id=room_id,
            homeserver_hrid=self.homeserver_hrid,
            state=MatrixRoomState.ACTIVE,
        )
        
        GroupAccess.objects.create(
            group=group,
            user=user,
            role=RoleChoices.ADMIN,
        )

        # Other objects (invitees) will be added by /sync when they accept invitation on
        # Matrix side.
        return group

    def _group_initial_state(
        self,
        *,
        allow_external_guests: bool,
        emoji: Optional[str],
        is_encrypted: bool,
    ) -> list[dict]:
        """Build the initial room state for a Hub group room."""
        control_room_id = self.client.resolve_room_alias(self.homeserver_config.control_room_alias)
        if not control_room_id:
            # control room is missing, need to run the dedicated management command to create it
            raise MatrixServiceError(
                "Control room alias %s is not set for this homeserver: %s.",
                self.homeserver_config.control_room_alias,
                self.homeserver_hrid,
            )

        initial_state = [
            {
                "type": "fr.gouv.lasuite.hub.group.metadata",
                "state_key": "",
                "content": {
                    "allow_external_guests": allow_external_guests,
                    "emoji": emoji,
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
        return initial_state

    def _state_event(self, state: list, event_type: str) -> dict:
        """Return one complete empty-key state event from a room state list."""
        return next(
            (
                event
                for event in state
                if event.get("type") == event_type and event.get("state_key", "") == ""
            ),
            {},
        )

    def _state_by_type(self, state: list, event_type: str) -> dict:
        """Return the content of one empty-key state event from a room state list."""
        return self._state_event(state, event_type).get("content", {})

    @transaction.atomic
    def promote_conversation(
        self,
        *,
        user: settings.AUTH_USER_MODEL,
        account_id: str,
        access_token: str,
        source_room_id: str,
        name: str,
        allow_external_guests: bool,
        emoji: Optional[str] = None,
    ):
        """Replace a multi-party conversation with a minimal Hub group successor.

        The source room must already exist on Matrix and belong to the requesting
        user. The requester needs enough power to send a tombstone in it. A new
        successor room is created from the requester, the other human members are
        invited, the predecessor is registered and then frozen when possible.
        """
        user_mx_id = self._get_user_mx_id(user, access_token)

        if MatrixRoom.objects.filter(room_id=source_room_id).exists():
            raise MatrixServiceError("This room is already registered as a Hub group.")

        state = self.client.room_state(source_room_id, access_token)
        joined = self.client.joined_members(source_room_id, access_token)

        if user_mx_id not in joined:
            raise MatrixServiceError("Requester is not joined to the source room.")

        bot_mxid = self.homeserver_config.bot_mxid
        human_members = [mxid for mxid in joined if mxid != bot_mxid]
        if len(human_members) < 3:
            raise MatrixServiceError(
                "A direct conversation cannot be transformed into a group."
            )

        if (
            not allow_external_guests
            and not _check_invitees_same_homeserver(user_mx_id, human_members)
        ):
            raise MatrixServiceError("External guests are not allowed in this room.")

        power_levels = self._state_by_type(state, "m.room.power_levels")
        actor_level = power_levels.get("users", {}).get(
            user_mx_id, power_levels.get("users_default", 0)
        )
        tombstone_level = power_levels.get("events", {}).get(
            "m.room.tombstone", power_levels.get("state_default", 50)
        )
        if actor_level < tombstone_level:
            raise MatrixServiceError("Requester cannot replace this conversation.")

        group = Group.objects.create(  # XXX: manage privacy
            created_by=user,
            name=name,
            emoji=emoji,
        )
        MatrixRoom.objects.create(
            group=group,
            room_id=source_room_id,
            homeserver_hrid=self.homeserver_hrid,
            state=MatrixRoomState.PREDECESSOR,
        )
        GroupAccess.objects.create(
            group=group,
            user=user,
            role=RoleChoices.ADMIN,
        )

        initial_state = self._group_initial_state(
            allow_external_guests=allow_external_guests,
            emoji=emoji,
            is_encrypted=bool(
                self._state_by_type(state, "m.room.encryption")
            ),
        )

        other_members = [mxid for mxid in human_members if mxid != user_mx_id]

        successor_id = self.client.create_room(
            room_name=name,
            is_direct=False,
            creation_content={
                "m.federate": True,
                "type": "fr.gouv.lasuite.hub.group",
                "predecessor": {"room_id": source_room_id},
            },
            initial_state=initial_state,
            invite=other_members,
            power_level_content_override={
                "users": {
                    user_mx_id: 100,
                    self.homeserver_config.bot_mxid: 110,
                },
                "users_default": 0,
                "events_default": 0,
                "state_default": 100,
                "invite": 50,
                "kick": 50,
                "ban": 50,
                "redact": 50,
                "events": {
                    "m.room.name": 50,
                    "fr.gouv.lasuite.hub.group.metadata": 50,
                    "m.room.tombstone": 75,
                },
            },
            preset="private_chat",
            topic=None,
            auth_user=user_mx_id,
            auth_access_token=access_token,
        )["room_id"]

        self.client.join(
            successor_id,
            user_mxid=self.homeserver_config.bot_mxid,
            user_access_token=self.homeserver_config.access_token,
            via=[self.homeserver_config.server_name],
        )

        MatrixRoom.objects.create(
            group=group,
            room_id=successor_id,
            homeserver_hrid=self.homeserver_hrid,
            state=MatrixRoomState.ACTIVE,
        )

        self.client.send_state(
            source_room_id,
            "m.room.tombstone",
            {
                "body": "This conversation has been replaced by a Hub group",
                "replacement_room": successor_id,
            },
            user_access_token=access_token,
        )

        return group

    @transaction.atomic
    def sync(self, since: Optional[str]=None):
        """Fetch the next sync batch for one homeserver and return the ``next_batch`` token.

        This method is a wrapper around :class:`MatrixClient.sync_next_batch` and can be
        extended to include additional logic for processing the sync data.

        params:
            since: The token to start syncing from.
                If None, the last known token from the database will be used.
                If "", a full sync will be performed.
        """

        # Manage last sync token from the database
        try:
            # Lock the row for this homeserver to prevent race conditions in concurrent syncs
            # (which should not happen in a single worker, but just in case)
            sync_state = MatrixSyncState.objects.select_for_update().get(homeserver_hrid=self.homeserver_hrid)
        except MatrixSyncState.DoesNotExist:
            sync_state = None

        if since is None and sync_state:
            since = sync_state.last_sync_token

        sync_data = self.client.sync_next_batch(since=since)

        logger.info(
            "homeserver=%s, last_sync_token=%s, next_sync_token=%s, action=matrix-sync",
            self.homeserver_hrid,
            since,
            sync_data,
        )

        # Process data
        # TODO: Implement data processing logic
        # TODO: - Add user who accepted invitation to the Group object
        # TODO: - Update MatrixRoom (existing one if state changed, create new one) for Group

        # Update last sync token in the database
        if sync_state is None:
            sync_state = MatrixSyncState(homeserver_hrid=self.homeserver_hrid)
        sync_state.last_sync_token = sync_data["next_batch"]
        sync_state.save()


class ProvisioningService(MatrixService):
    """Service class for provisioning purposes."""

    def provision_hub_bot_user(self) -> Tuple[str, bool]:
        """Provision a Matrix account for the Hub bot user and return their Matrix ID."""
        return self.client.create_account(self.homeserver_config.bot_localpart)
