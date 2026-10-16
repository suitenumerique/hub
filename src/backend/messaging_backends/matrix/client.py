import json
import logging
from typing import Optional, Tuple
from urllib.parse import quote

import requests

from hub.configuration import MatrixHomeserverConfig

logger = logging.getLogger(__name__)

# Filter sent with every /sync request: we only care about the room state
# events that let the Hub follow the room lifecycle (creation, membership,
# power levels, naming and tombstones). Timeline, ephemeral and account data
# are deliberately emptied to keep the sync payload light.
SYNC_FILTER = {
    "room": {
        "state": {
            "types": [
                "m.room.create",
                "m.room.member",
                "m.room.power_levels",
                "m.room.name",
                "m.room.canonical_alias",
                "m.room.tombstone",
            ]
        },
        "timeline": {"limit": 0},
        "ephemeral": {"types": []},
        "account_data": {"types": []},
    },
    "presence": {"types": []},
    "account_data": {"types": []},
    "to_device": {"types": []},
}


class RoomVisibility:
    """Matrix room visibility options."""

    PUBLIC = "public"
    PRIVATE = "private"


class MatrixClientError(Exception):
    """A failure while talking to the Matrix homeserver."""


class MatrixRoomCreateError(MatrixClientError):
    """A failure while creating a room on the Matrix homeserver."""


class MatrixSyncError(MatrixClientError):
    """A failure while syncing with the Matrix homeserver."""


class MatrixClient:
    """Client class for interacting with a Matrix homeserver."""

    def __init__(self, homeserver_config: MatrixHomeserverConfig):
        self.homeserver_config = homeserver_config

    def get_url(self, path: str) -> str:
        """Construct the full URL for a given API path."""
        return self.homeserver_config.url.rstrip("/") + path

    def resolve_room_alias(self, room_alias: str) -> Optional[str]:
        """Resolve a local room alias to its opaque Matrix room id."""
        encoded = quote(room_alias, safe="")
        url = self.get_url(f"/_matrix/client/v3/directory/room/{encoded}")
        try:
            response = requests.get(
                url,
                headers={
                    "Authorization": f"Bearer {self.homeserver_config.access_token}"
                },
                timeout=self.homeserver_config.timeout,
            )
        except requests.RequestException as error:
            raise MatrixClientError(
                f"Matrix homeserver unreachable ({self.homeserver_config.hrid}): {error}"
            ) from error

        if not response.ok:
            if response.status_code != 404:
                raise MatrixClientError(
                    f"Matrix /directory/room failed ({self.homeserver_config.hrid}): "
                    f"{response.status_code} {response.text[:200]}"
                )
            return None

        try:
            return response.json()["room_id"]
        except (json.decoder.JSONDecodeError, KeyError) as error:
            raise MatrixClientError(
                f"Matrix /directory/room returned invalid response ({self.homeserver_config.hrid}): {error}"
            ) from error

    def create_room(  # noqa: PLR0913
        self,
        room_alias_name: Optional[str] = None,
        room_name: Optional[str] = None,
        is_direct: bool = False,
        creation_content: Optional[dict] = None,
        initial_state: Optional[list] = None,
        invite: Optional[list] = None,
        power_level_content_override: Optional[dict] = None,
        preset: Optional[str] = None,
        room_version: Optional[str] = None,
        topic: Optional[str] = None,
        visibility: Optional[str] = None,
        auth_user: Optional[str] = None,
        auth_access_token: Optional[str] = None,
    ):
        """
        Create a new room on the Matrix homeserver, as Hub bot user.

        creation_content, CreationContent:
            Extra keys, such as m.federate, to be added to the content of the m.room.create event.
            The server will overwrite the following keys: creator, room_version.
            Future versions of the specification may allow the server to overwrite other keys.

            When using the trusted_private_chat preset, the server SHOULD combine
            additional_creators specified here and the invite array into the eventual
            m.room.create event’s additional_creators, deduplicating between the two parameters.

        initial_state, StateEvent:
            A list of state events to set in the new room.
            This allows the user to override the default state events set in the new room.
            The expected format of the state events are an object with type, state_key
            and content keys set.

            Takes precedence over events set by preset, but gets overridden by name and topic keys.

        invite, User ID:
            A list of user IDs to invite to the room.
            This will tell the server to invite everyone in the list to the newly created room.

        invite_3pid, Invite3pid:
            A list of objects representing third-party IDs to invite into the room.
            Not implemented yet.

        is_direct, boolean:
            This flag makes the server set the is_direct flag on the m.room.member
            events sent to the users in invite and invite_3pid.

        name, string:
            If this is included, an m.room.name event will be sent into the room to indicate
            the name for the room. This overwrites any m.room.name event in initial_state.

        power_level_content_override, Power Level Event Content:
            The power level content to override in the default power level event.
            This object is applied on top of the generated m.room.power_levels event
            content prior to it being sent to the room. Defaults to overriding nothing.

        preset, string:
            Convenience parameter for setting various default state events based on a preset.

            If unspecified, the server should use the visibility to determine which preset to use.
            A visibility of public equates to a preset of public_chat and private visibility
            equates to a preset of private_chat.

            One of: [private_chat, public_chat, trusted_private_chat].

        room_alias_name, string:
            The desired room alias local part. If this is included, a room alias will be created
            and mapped to the newly created room. The alias will belong on the same homeserver
            which created the room. For example, if this was set to “foo” and sent to the
            homeserver “example.com” the complete room alias would be #foo:example.com.

            The complete room alias will become the canonical alias for the room and an
            m.room.canonical_alias event will be sent into the room.

        room_version, string:
            The room version to set for the room. If not provided, the homeserver
            is to use its configured default. If provided, the homeserver will
            return a 400 error with the errcode M_UNSUPPORTED_ROOM_VERSION if it
            does not support the room version.

        topic, string:
            If this is included, an m.room.topic event with a text/plain mimetype
            will be sent into the room to indicate the topic for the room.
            This overwrites any m.room.topic event in initial_state.

        visibility, string:
            The room’s visibility in the server’s published room directory.
            Defaults to private.

            One of: [public, private].
        """
        url = self.get_url("/_matrix/client/v3/createRoom")
        params = {
            "user_id": auth_user or self.homeserver_config.bot_mxid,
        }

        payload = {
            "creation_content": creation_content or {},
            "initial_state": initial_state or [],
            "invite": invite or [],
            "preset": preset or "private_chat",
            "is_direct": is_direct,
            "visibility": visibility or RoomVisibility.PRIVATE,
        }
        if room_name:
            payload["name"] = room_name
        if room_alias_name:
            payload["room_alias_name"] = room_alias_name
        if room_version:
            payload["room_version"] = room_version
        if power_level_content_override:
            payload["power_level_content_override"] = power_level_content_override
        if topic:
            payload["topic"] = topic

        try:
            response = requests.post(
                url,
                json=payload,
                params=params,
                headers={
                    "Authorization": f"Bearer {auth_access_token or self.homeserver_config.access_token}"
                },
                timeout=self.homeserver_config.timeout,
            )
        except requests.RequestException as error:
            raise MatrixClientError(
                f"Matrix homeserver unreachable ({self.homeserver_config.hrid}): {error}"
            ) from error

        if not response.ok:
            raise MatrixRoomCreateError(
                f"Matrix /createRoom failed ({self.homeserver_config.hrid}): "
                f"{response.status_code} {response.text[:200]}"
            )

        try:
            return response.json()
        except json.decoder.JSONDecodeError as error:
            raise MatrixClientError(
                f"Matrix /createRoom returned invalid response ({self.homeserver_config.hrid}): {error}"
            ) from error

    def create_account(self, username: str) -> Tuple[str, bool]:
        """
        Register for an account on this homeserver.
        """
        try:
            response = requests.post(
                self.get_url("/_matrix/client/v3/register"),
                params={"user_id": self.homeserver_config.as_bot_mxid},
                json={"type": "m.login.application_service", "username": username},
                headers={
                    "Authorization": f"Bearer {self.homeserver_config.access_token}",
                    "Content-Type": "application/json",
                },
                timeout=self.homeserver_config.timeout,
            )
        except requests.RequestException as error:
            raise MatrixClientError(
                f"Matrix homeserver unreachable ({self.homeserver_config.hrid}): {error}"
            ) from error

        if not response.ok:
            if response.status_code == 400:
                error_data = response.json()
                if error_data.get("errcode") == "M_USER_IN_USE":
                    logger.warning(
                        "Matrix /register failed (%s): user %s already in use",
                        self.homeserver_config.hrid,
                        username,
                    )
                    return f"@{username}:{self.homeserver_config.server_name}", False
            raise MatrixClientError(
                f"Matrix /register failed ({self.homeserver_config.hrid}): "
                f"{response.status_code} {response.text[:200]}"
            )

        return response.json()["user_id"], True

    def join(
        self,
        room_id_or_alias: str,
        *,
        user_mxid: str,
        user_access_token: str,
        via: Optional[list[str]] = None,
    ) -> dict:
        """Join a room as a Matrix user (token-based) or as AS bot impersonation."""
        encoded = quote(room_id_or_alias, safe="")
        params = {
            "user_id": user_mxid,
        }
        if via:
            params["via"] = via

        try:
            response = requests.post(
                self.get_url(f"/_matrix/client/v3/join/{encoded}"),
                params=params,
                json={},
                headers={
                    "Authorization": f"Bearer {user_access_token}",
                    "Content-Type": "application/json",
                },
                timeout=self.homeserver_config.timeout,
            )
        except requests.RequestException as error:
            raise MatrixClientError(
                f"Matrix homeserver unreachable ({self.homeserver_config.hrid}): {error}"
            ) from error

        if not response.ok:
            raise MatrixClientError(
                f"Matrix /join failed ({self.homeserver_config.hrid}): "
                f"{response.status_code} {response.text[:200]}"
            )

        try:
            return response.json()
        except json.decoder.JSONDecodeError as error:
            raise MatrixClientError(
                f"Matrix /join returned invalid response ({self.homeserver_config.hrid}): {error}"
            ) from error

    def sync_next_batch(self, since: Optional[str] = None):
        """Fetch the next sync batch for one homeserver and return the ``next_batch`` token.

        ``self.homeserver_config`` is one entry of
        ``settings.MESSAGING_BACKEND_CONFIG[*].mx_homeserver``.
        The request blocks server-side (long-polling) up to
        ``self.homeserver_config.sync_timeout`` seconds and returns the new ``next_batch``
        token (``since`` for the next call as soon as the server answers). A transient
        HTTP failure raises :class:`MatrixSyncError`.

        ref: https://spec.matrix.org/v1.19/client-server-api/#syncing
        """
        url = self.get_url("/_matrix/client/v3/sync")
        params = {
            "user_id": self.homeserver_config.bot_mxid,
            "timeout": int(
                self.homeserver_config.sync_timeout * 1000
            ),  # in milliseconds
            "org.matrix.msc4222.use_state_after": "true",
            "filter": json.dumps(
                SYNC_FILTER  # TODO: use ID of a filter created using the filter API
            ),
        }
        if since:
            params["since"] = since
        try:
            response = requests.get(
                url,
                params=params,
                headers={
                    "Authorization": f"Bearer {self.homeserver_config.access_token}"
                },
                timeout=self.homeserver_config.sync_timeout
                + 1,  # XXX should be sync_timeout ?
            )
        except requests.RequestException as error:
            raise MatrixSyncError(
                f"Matrix homeserver unreachable ({self.homeserver_config.hrid}): {error}"
            ) from error

        if not response.ok:
            raise MatrixSyncError(
                f"Matrix /sync failed ({self.homeserver_config.hrid}): "
                f"{response.status_code} {response.text[:200]}"
            )

        try:
            return response.json()
        except json.decoder.JSONDecodeError as error:
            raise MatrixSyncError(
                f"Matrix /sync returned invalid response ({self.homeserver_config.hrid}): {error}"
            ) from error

    def whoami(self, user_access_token: str) -> str:
        """
        Resolve a user token without persisting or logging it.

        user_access_token: The access token to validate and resolve.
        Returns the user_id associated with the access token.
        """
        url = self.get_url("/_matrix/client/v3/account/whoami")

        try:
            response = requests.get(
                url,
                headers={"Authorization": f"Bearer {user_access_token}"},
                timeout=self.homeserver_config.timeout,
            )
        except requests.RequestException as error:
            raise MatrixClientError(
                f"Matrix homeserver unreachable ({self.homeserver_config.hrid}): {error}"
            ) from error

        if not response.ok:
            raise MatrixClientError(
                f"Matrix /whoami failed ({self.homeserver_config.hrid}): "
                f"{response.status_code} {response.text[:200]}"
            )

        try:
            return response.json()["user_id"]
        except (json.decoder.JSONDecodeError, KeyError) as error:
            raise MatrixClientError(
                f"Matrix /whoami returned invalid response ({self.homeserver_config.hrid}): {error}"
            ) from error

    def room_state(self, room_id: str, user_access_token: Optional[str] = None) -> list:
        """Read the current room state as the bot or an authenticated user."""
        encoded = quote(room_id, safe="")
        params = {}
        if not user_access_token:
            params["user_id"] = self.homeserver_config.bot_mxid
        try:
            response = requests.get(
                self.get_url(f"/_matrix/client/v3/rooms/{encoded}/state"),
                params=params,
                headers={
                    "Authorization": f"Bearer {user_access_token or self.homeserver_config.access_token}",
                    "Content-Type": "application/json",
                },
                timeout=self.homeserver_config.timeout,
            )
        except requests.RequestException as error:
            raise MatrixClientError(
                f"Matrix homeserver unreachable ({self.homeserver_config.hrid}): {error}"
            ) from error

        if not response.ok:
            raise MatrixClientError(
                f"Matrix /state failed ({self.homeserver_config.hrid}): "
                f"{response.status_code} {response.text[:200]}"
            )

        try:
            return response.json()
        except json.decoder.JSONDecodeError as error:
            raise MatrixClientError(
                f"Matrix /state returned invalid response ({self.homeserver_config.hrid}): {error}"
            ) from error

    def joined_members(
        self, room_id: str, user_access_token: Optional[str] = None
    ) -> dict:
        """Return the currently joined members of a room."""
        encoded = quote(room_id, safe="")
        params = {}
        if not user_access_token:
            params["user_id"] = self.homeserver_config.bot_mxid
        try:
            response = requests.get(
                self.get_url(f"/_matrix/client/v3/rooms/{encoded}/joined_members"),
                params=params,
                headers={
                    "Authorization": f"Bearer {user_access_token or self.homeserver_config.access_token}",
                    "Content-Type": "application/json",
                },
                timeout=self.homeserver_config.timeout,
            )
        except requests.RequestException as error:
            raise MatrixClientError(
                f"Matrix homeserver unreachable ({self.homeserver_config.hrid}): {error}"
            ) from error

        if not response.ok:
            raise MatrixClientError(
                f"Matrix /joined_members failed ({self.homeserver_config.hrid}): "
                f"{response.status_code} {response.text[:200]}"
            )

        try:
            return response.json().get("joined", {})
        except json.decoder.JSONDecodeError as error:
            raise MatrixClientError(
                f"Matrix /joined_members returned invalid response ({self.homeserver_config.hrid}): {error}"
            ) from error

    def send_state(
        self,
        room_id: str,
        event_type: str,
        content: dict,
        user_access_token: Optional[str] = None,
    ) -> str:
        """Send one empty-key state event and return its event id."""
        encoded_room = quote(room_id, safe="")
        encoded_type = quote(event_type, safe="")
        params = {}
        if not user_access_token:
            params["user_id"] = self.homeserver_config.bot_mxid
        try:
            response = requests.put(
                self.get_url(
                    f"/_matrix/client/v3/rooms/{encoded_room}/state/{encoded_type}/"
                ),
                params=params,
                json=content,
                headers={
                    "Authorization": f"Bearer {user_access_token or self.homeserver_config.access_token}",
                    "Content-Type": "application/json",
                },
                timeout=self.homeserver_config.timeout,
            )
        except requests.RequestException as error:
            raise MatrixClientError(
                f"Matrix homeserver unreachable ({self.homeserver_config.hrid}): {error}"
            ) from error

        if not response.ok:
            raise MatrixClientError(
                f"Matrix /state failed ({self.homeserver_config.hrid}): "
                f"{response.status_code} {response.text[:200]}"
            )

        try:
            return response.json().get("event_id", "")
        except json.decoder.JSONDecodeError as error:
            raise MatrixClientError(
                f"Matrix /state returned invalid response ({self.homeserver_config.hrid}): {error}"
            ) from error
