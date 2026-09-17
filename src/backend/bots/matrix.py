"""The two ways Ariane touches Matrix, and why there are two.

`AS_TOKEN` lets her act as any account in the Application Service namespace,
through `?user_id=`. It cannot get her into a room nobody invited her to: the
client API answers `M_FORBIDDEN` there, by design.

`ADMIN_TOKEN` is the door. `POST /_synapse/admin/v1/join/{room}` forces a local
account into a room with no invitation. It is the price of being everywhere, and
it is why the settings page has to say out loud what Ariane can read.

Never hand either token to the frontend.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any
from urllib.parse import quote

from django.conf import settings

import requests

logger = logging.getLogger(__name__)

# `_call` mirrors an HTTP call: method, path, token and the three optional
# request parts. Splitting it would only move the arguments elsewhere.
# pylint: disable=too-many-arguments

CLIENT_API = "/_matrix/client/v3"
CLIENT_API_V1 = "/_matrix/client/v1"


class MatrixError(Exception):
    """A Matrix call failed. Carries `errcode` so callers can branch on it."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        errcode: str | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.errcode = errcode


def _call(  # noqa: PLR0913
    method: str,
    path: str,
    token: str,
    *,
    as_user: str | None = None,
    json: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """One entry point, so masquerading is applied in exactly one place."""
    query = dict(params or {})
    if as_user:
        query["user_id"] = as_user

    url = f"{settings.MATRIX_HOMESERVER_URL.rstrip('/'):s}{path:s}"
    try:
        response = requests.request(
            method,
            url,
            headers={"Authorization": f"Bearer {token:s}"},
            json=json,
            params=query,
            timeout=settings.MATRIX_REQUEST_TIMEOUT,
        )
    except requests.RequestException as exc:
        raise MatrixError(f"Matrix {method:s} {path:s} failed: {exc!s}") from exc

    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if response.status_code >= 400:
        raise MatrixError(
            payload.get("error") or f"Matrix returned {response.status_code:d}",
            status_code=response.status_code,
            errcode=payload.get("errcode"),
        )
    return payload


def _as(method: str, path: str, **kwargs: Any) -> dict[str, Any]:
    return _call(
        method,
        path,
        settings.MATRIX_AS_TOKEN,
        as_user=settings.MATRIX_BOT_USER_ID,
        **kwargs,
    )


def is_member(room_id: str) -> bool:
    """Is Ariane already in this room?"""
    try:
        joined = _as("GET", f"{CLIENT_API:s}/joined_rooms")
    except MatrixError:
        return False
    return room_id in joined.get("joined_rooms", [])


def ensure_in_room(room_id: str) -> None:
    """Get Ariane into the room, inviting herself if that is what it takes.

    Tries the ordinary join first: it works for public rooms and costs nothing.
    Only a private room needs the admin token, and that call is the intrusive
    one - so it stays the fallback, never the default.
    """
    if is_member(room_id):
        return

    try:
        _as("POST", f"{CLIENT_API:s}/join/{quote(room_id, safe=''):s}", json={})
        return
    except MatrixError as exc:
        if exc.errcode != "M_FORBIDDEN":
            raise
        logger.info("Ariane not invited to %s, using the admin door", room_id)

    _call(
        "POST",
        f"/_synapse/admin/v1/join/{quote(room_id, safe=''):s}",
        settings.MATRIX_ADMIN_TOKEN,
        json={"user_id": settings.MATRIX_BOT_USER_ID},
    )


def history_visibility(room_id: str) -> str:
    """How far back a member of this room may read.

    Matrix defines four values, and only two of them let a newcomer read what
    was said before they arrived:

      `world_readable`  anyone, member or not;
      `shared`          any member, including history predating their join;
      `invited`         from their invitation onwards;
      `joined`          from their join onwards.

    Synapse defaults to `shared` when the state event is absent, so that is the
    fallback - but the fallback is only used when the room genuinely has no such
    event, never to paper over a failed lookup.
    """
    try:
        state = _as(
            "GET",
            f"{CLIENT_API:s}/rooms/{quote(room_id, safe=''):s}/state/m.room.history_visibility",
        )
    except MatrixError as exc:
        if exc.errcode == "M_NOT_FOUND":
            return "shared"
        raise
    return state.get("history_visibility", "shared")


def membership_since(room_id: str, user_id: str) -> int | None:
    """When this person's current membership began, in milliseconds.

    Read from the room's state rather than from the timeline: the state event is
    authoritative and always present, whereas a join that happened before the
    window we fetched would simply be missing from `/messages`, and a missing
    horizon reads as "no restriction" - the wrong way to fail.

    Returns None when the membership event cannot be found, which callers must
    treat as "cut everything", not as "allow everything".
    """
    try:
        events = _as("GET", f"{CLIENT_API:s}/rooms/{quote(room_id, safe=''):s}/state")
    except MatrixError as exc:
        logger.warning("could not read the state of %s: %s", room_id, exc)
        return None

    for event in events:
        if event.get("type") == "m.room.member" and event.get("state_key") == user_id:
            return event.get("origin_server_ts")
    return None


def is_encrypted(room_id: str) -> bool:
    """A room Ariane cannot read. Better to say so than to post into the void."""
    try:
        _as(
            "GET",
            f"{CLIENT_API:s}/rooms/{quote(room_id, safe=''):s}/state/m.room.encryption",
        )
    except MatrixError as exc:
        if exc.errcode in ("M_NOT_FOUND", "M_FORBIDDEN"):
            return False
        raise
    return True


def set_typing(room_id: str, typing: bool, timeout: int = 30000) -> None:
    """Typing is the only feedback during the seconds Albert takes to answer."""
    body: dict[str, Any] = {"typing": typing}
    if typing:
        body["timeout"] = timeout
    try:
        _as(
            "PUT",
            f"{CLIENT_API:s}/rooms/{quote(room_id, safe=''):s}"
            f"/typing/{quote(settings.MATRIX_BOT_USER_ID, safe=''):s}",
            json=body,
        )
    except MatrixError as exc:
        logger.debug("typing indicator refused: %s", exc)


def get_event(room_id: str, event_id: str) -> dict[str, Any]:
    """Fetch one event. Needed because `/relations` never returns the root."""
    return _as(
        "GET",
        f"{CLIENT_API:s}/rooms/{quote(room_id, safe=''):s}/event/{quote(event_id, safe=''):s}",
    )


def thread_replies(room_id: str, root_id: str) -> list[dict[str, Any]]:
    """Every reply in a thread, oldest first.

    `limit` is not optional. Synapse silently defaults to 5 events and returns
    them newest-first, so an omitted limit quietly truncates the context to the
    tail of the conversation.
    """
    events: list[dict[str, Any]] = []
    token: str | None = None

    while True:
        params: dict[str, Any] = {"dir": "f", "limit": 100}
        if token:
            params["from"] = token
        page = _as(
            "GET",
            f"{CLIENT_API_V1:s}/rooms/{quote(room_id, safe=''):s}"
            f"/relations/{quote(root_id, safe=''):s}/m.thread",
            params=params,
        )
        events.extend(page.get("chunk", []))
        token = page.get("next_batch")
        if not token or len(events) >= settings.BOTS_MAX_THREAD_EVENTS:
            break

    return events


def recent_messages(room_id: str, limit: int = 20) -> list[dict[str, Any]]:
    """The tail of the main timeline, oldest first.

    Used when the ping is not inside a thread: without it Ariane would answer a
    one-line question with no idea what the room was talking about.
    """
    page = _as(
        "GET",
        f"{CLIENT_API:s}/rooms/{quote(room_id, safe=''):s}/messages",
        params={"dir": "b", "limit": limit},
    )
    return list(reversed(page.get("chunk", [])))


# Marks a message as plumbing rather than conversation: help, refusals,
# failures. Read back as context they are poison - three refusals in a row and
# the model concludes that refusing is what it does here.
ASIDE_KEY = "fr.hack42.bot.aside"


def send_message(
    room_id: str, body: str, *, thread_root: str | None = None, aside: bool = False
) -> str:
    """Post as Ariane, in a thread when there is one."""
    content: dict[str, Any] = {"msgtype": "m.text", "body": body}
    if aside:
        content[ASIDE_KEY] = True
    if thread_root:
        content["m.relates_to"] = {
            "rel_type": "m.thread",
            "event_id": thread_root,
            # Clients that know nothing about threads still render the reply.
            "is_falling_back": True,
            "m.in_reply_to": {"event_id": thread_root},
        }

    sent = _as(
        "PUT",
        f"{CLIENT_API:s}/rooms/{quote(room_id, safe=''):s}"
        f"/send/m.room.message/{uuid.uuid4().hex:s}",
        json=content,
    )
    return sent["event_id"]


# --- Hub meetings -----------------------------------------------------------
# The meeting of a conversation is room state. Ariane writes it when the
# server closes a meeting on its own; the archive asks the homeserver who is
# in the room and who is asking.


def can_write_rooms() -> bool:
    """Whether Ariane has what she needs to get into a room and write in it."""
    return bool(
        settings.MATRIX_AS_TOKEN
        and settings.MATRIX_ADMIN_TOKEN
        and settings.MATRIX_BOT_USER_ID
    )


def _state_path(room_id: str, event_type: str, state_key: str) -> str:
    return (
        f"{CLIENT_API:s}/rooms/{quote(room_id, safe=''):s}"
        f"/state/{quote(event_type, safe=''):s}/{quote(state_key, safe=''):s}"
    )


def get_room_state(room_id: str, event_type: str, state_key: str) -> dict[str, Any]:
    """One state event's content, read as Ariane (she must be in the room)."""
    return _as("GET", _state_path(room_id, event_type, state_key))


def set_room_state(
    room_id: str, event_type: str, state_key: str, content: dict[str, Any]
) -> None:
    """Write one state event as Ariane (she must be in the room)."""
    _as("PUT", _state_path(room_id, event_type, state_key), json=content)


def joined_members(room_id: str) -> set[str]:
    """Who is in a room now, through the admin API: Ariane need not be there."""
    members = _call(
        "GET",
        f"/_synapse/admin/v1/rooms/{quote(room_id, safe=''):s}/members",
        settings.MATRIX_ADMIN_TOKEN,
    )
    return set(members.get("members", []))


def openid_user_id(openid_token: str) -> str | None:
    """
    The Matrix account behind an OpenID token its client requested, or `None`.

    This is how a browser proves which Matrix user it is without handing over
    its access token: the homeserver vouches for the short-lived OpenID token.
    """
    try:
        response = requests.get(
            f"{settings.MATRIX_HOMESERVER_URL.rstrip('/'):s}"
            "/_matrix/federation/v1/openid/userinfo",
            params={"access_token": openid_token},
            timeout=settings.MATRIX_REQUEST_TIMEOUT,
        )
    except requests.RequestException as exc:
        raise MatrixError(f"OpenID userinfo failed: {exc!s}") from exc
    if response.status_code in (401, 403, 404):
        return None
    if response.status_code >= 400:
        raise MatrixError(
            f"OpenID userinfo returned {response.status_code:d}",
            status_code=response.status_code,
        )
    try:
        user_id = response.json().get("sub")
    except ValueError:
        return None
    return user_id if isinstance(user_id, str) and user_id else None
