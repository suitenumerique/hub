"""Small, typed Matrix Client-Server API adapter used by the control bot."""

import secrets
from dataclasses import dataclass
from urllib.parse import quote

from django.conf import settings

import requests


class MatrixBridgeError(Exception):
    """A classified Matrix response safe to expose through the group API."""

    def __init__(  # pylint: disable=too-many-arguments
        self,
        message: str,
        *,
        status_code: int = 503,
        errcode: str = "MATRIX_UNAVAILABLE",
        retry_after_ms: int | None = None,
        upstream_status_code: int | None = None,
    ):
        """Store the public HTTP classification of one Matrix failure."""
        super().__init__(message)
        self.status_code = status_code
        self.errcode = errcode
        self.retry_after_ms = retry_after_ms
        self.upstream_status_code = upstream_status_code

    @property
    def is_temporary(self) -> bool:
        """Return whether retrying the same Matrix operation can succeed later."""
        return self.status_code in {429, 503}


@dataclass(frozen=True)
class MatrixHomeserver:  # pylint: disable=too-many-instance-attributes
    """Settings-backed control homeserver registration."""

    account_id: str
    registration_id: str
    base_url: str
    public_base_url: str
    server_name: str
    bot_mxid: str
    as_token: str
    hs_token: str

    @classmethod
    def for_account(cls, account_id: str) -> "MatrixHomeserver":
        """Resolve one configured homeserver from its stable account key."""
        raw = settings.MATRIX_HOMESERVERS.get(account_id)
        if not raw:
            raise MatrixBridgeError(
                "Unknown Matrix account.", status_code=400, errcode="UNKNOWN_ACCOUNT"
            )
        return cls(account_id=account_id, **raw)

    @classmethod
    def for_hs_token(cls, token: str) -> "MatrixHomeserver | None":
        """Authenticate an inbound Application Service transaction token."""
        for account_id, raw in settings.MATRIX_HOMESERVERS.items():
            expected = str(raw.get("hs_token", ""))
            if expected and secrets.compare_digest(token, expected):
                return cls(account_id=account_id, **raw)
        return None


class MatrixClient:
    """Matrix HTTP client with consistent error classification and timeouts."""

    def __init__(self, homeserver: MatrixHomeserver):
        """Use one configured homeserver for every following request."""
        self.homeserver = homeserver

    def request(  # pylint: disable=too-many-arguments
        self,
        method: str,
        path: str,
        *,
        access_token: str | None = None,
        json: dict | None = None,
        params: dict | None = None,
    ) -> dict:
        """Send one authenticated Client-Server API request."""
        token = access_token or self.homeserver.as_token
        try:
            response = requests.request(
                method,
                f"{self.homeserver.base_url.rstrip('/')}{path}",
                headers={"Authorization": f"Bearer {token}"},
                json=json,
                params=params,
                timeout=(3.05, 15),
            )
        except requests.RequestException as error:
            raise MatrixBridgeError("Matrix homeserver is unavailable.") from error

        if response.ok:
            return response.json() if response.content else {}

        try:
            payload = response.json()
        except requests.exceptions.JSONDecodeError:
            payload = {}
        matrix_code = payload.get("errcode", "MATRIX_ERROR")
        retry_after_ms = payload.get("retry_after_ms")
        if response.status_code == 429:
            status_code = 429
        elif response.status_code in (401, 403):
            status_code = 403
        elif response.status_code == 409:
            status_code = 409
        elif response.status_code >= 500:
            status_code = 503
        else:
            status_code = 400
        raise MatrixBridgeError(
            payload.get("error", "Matrix rejected the operation."),
            status_code=status_code,
            errcode=matrix_code,
            retry_after_ms=retry_after_ms,
            upstream_status_code=response.status_code,
        )

    def whoami(self, access_token: str) -> str:
        """Resolve a user token without persisting or logging it."""
        return self.request(
            "GET", "/_matrix/client/v3/account/whoami", access_token=access_token
        )["user_id"]

    def create_room(self, payload: dict) -> str:
        """Create a room as the Application Service sender (the control bot)."""
        result = self.request(
            "POST",
            "/_matrix/client/v3/createRoom",
            json=payload,
            params={"user_id": self.homeserver.bot_mxid},
        )
        return result["room_id"]

    def resolve_room_alias(self, room_alias: str) -> str:
        """Resolve a local room alias to its opaque Matrix room id."""
        encoded = quote(room_alias, safe="")
        return self.request("GET", f"/_matrix/client/v3/directory/room/{encoded}")[
            "room_id"
        ]

    def join(self, room_id_or_alias: str, *, via: list[str] | None = None) -> str:
        """Join the control bot to a room using its Application Service token."""
        encoded = quote(room_id_or_alias, safe="")
        result = self.request(
            "POST",
            f"/_matrix/client/v3/join/{encoded}",
            json={},
            params={
                "user_id": self.homeserver.bot_mxid,
                **({"via": via} if via else {}),
            },
        )
        return result.get("room_id", room_id_or_alias)

    def invite(self, room_id: str, mxid: str) -> None:
        """Invite a single target separately from room creation."""
        encoded = quote(room_id, safe="")
        self.request(
            "POST",
            f"/_matrix/client/v3/rooms/{encoded}/invite",
            json={"user_id": mxid},
            params={"user_id": self.homeserver.bot_mxid},
        )

    def room_state(self, room_id: str, access_token: str | None = None) -> list[dict]:
        """Read current room state with either bot or verified human credentials."""
        encoded = quote(room_id, safe="")
        return self.request(
            "GET",
            f"/_matrix/client/v3/rooms/{encoded}/state",
            access_token=access_token,
            params=(None if access_token else {"user_id": self.homeserver.bot_mxid}),
        )

    def joined_members(
        self, room_id: str, access_token: str | None = None
    ) -> dict[str, dict]:
        """Return currently joined members, never invitees."""
        encoded = quote(room_id, safe="")
        return self.request(
            "GET",
            f"/_matrix/client/v3/rooms/{encoded}/joined_members",
            access_token=access_token,
            params=(None if access_token else {"user_id": self.homeserver.bot_mxid}),
        ).get("joined", {})

    def send_state(
        self,
        room_id: str,
        event_type: str,
        content: dict,
        *,
        access_token: str | None = None,
    ) -> str:
        """Send one empty-state-key event and return its event id."""
        encoded_room = quote(room_id, safe="")
        encoded_type = quote(event_type, safe="")
        result = self.request(
            "PUT",
            f"/_matrix/client/v3/rooms/{encoded_room}/state/{encoded_type}/",
            access_token=access_token,
            json=content,
            params=(None if access_token else {"user_id": self.homeserver.bot_mxid}),
        )
        return result.get("event_id", "")
