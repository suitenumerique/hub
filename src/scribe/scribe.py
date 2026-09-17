"""
Meeting scribe: follows the calls of Hub meetings for the Hub.

The scribe asks the Hub which LiveKit rooms belong to its open meetings and
reports, for each of them, who is in the call: that is how the Hub knows when a
meeting is over and empty, and closes it. It joins the rooms where people are,
as an agent named after the assistant (Meet shows no tile for agents) that only
listens to the audio tracks (the subtitles refer to them), and relays to the
Hub:

- every final sentence that Meet's transcriber agent publishes (subtitles),
- every message written in the chat of the call.

The Hub turns them into the transcript and the archive of the meeting. When
someone writes `@ariane …` in the chat, the Hub prepares her answer and the
scribe posts it in the chat of the call.

It runs apart from the Hub backend because the LiveKit real-time SDK only ships
for glibc, and the backend image is Alpine.
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
from dataclasses import dataclass, field

import aiohttp
from livekit import api, rtc

logger = logging.getLogger("scribe")

SCRIBE_IDENTITY = "hub-scribe"
CHAT_TOPIC = "lk.chat"
# What is relayed, and under which key the Hub expects it.
SEGMENTS = "segments"
CHAT = "chat"
PAYLOAD_KEYS = {SEGMENTS: "segments", CHAT: "messages"}
# Items kept per room and kind while the Hub cannot be reached.
MAX_PENDING = 1000
# Items sent in one request, as the Hub accepts them.
BATCH_SIZE = 200
# The Hub answers these once a meeting is closed or unknown: leave the room.
GONE = (404, 410)


@dataclass(frozen=True)
class Settings:
    """The scribe configuration, from its environment."""

    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    hub_api_url: str
    token: str
    poll_seconds: float = 10.0
    flush_seconds: float = 2.0
    name: str = "Ariane"

    @classmethod
    def from_env(cls, env=os.environ) -> Settings | None:
        """The settings, or `None` when a required one is missing."""
        required = {
            "livekit_url": env.get("LIVEKIT_URL", ""),
            "livekit_api_key": env.get("LIVEKIT_API_KEY", ""),
            "livekit_api_secret": env.get("LIVEKIT_API_SECRET", ""),
            "hub_api_url": env.get("HUB_API_URL", ""),
            "token": env.get("MEETING_SCRIBE_TOKEN", ""),
        }
        if not all(required.values()):
            return None
        return cls(
            **required,
            poll_seconds=float(env.get("SCRIBE_POLL_SECONDS", "10")),
            flush_seconds=float(env.get("SCRIBE_FLUSH_SECONDS", "2")),
            name=env.get("SCRIBE_NAME", "Ariane"),
        )

    @property
    def livekit_http_url(self) -> str:
        """The LiveKit server API lives on the same host, over HTTP."""
        if self.livekit_url.startswith("ws"):
            return "http" + self.livekit_url[2:]
        return self.livekit_url

    @property
    def livekit_ws_url(self) -> str:
        """Rooms are joined over WebSocket."""
        if self.livekit_url.startswith("http"):
            return "ws" + self.livekit_url[4:]
        return self.livekit_url


def is_human(participant) -> bool:
    """Whether a participant is a person, not an agent or the scribe itself."""
    return (
        participant.kind != rtc.ParticipantKind.PARTICIPANT_KIND_AGENT
        and participant.identity != SCRIBE_IDENTITY
    )


def people(participants) -> list[dict]:
    """The people among participants, as the Hub expects them."""
    return [
        {"identity": p.identity[:255], "name": (p.name or "")[:255]}
        for p in participants
        if is_human(p)
    ]


def listen_to(publication, participant) -> None:
    """Subscribe to a person's audio only: never to video or screen shares."""
    if publication.kind == rtc.TrackKind.KIND_AUDIO and is_human(participant):
        publication.set_subscribed(True)


def to_sentence(segment, participant) -> dict | None:
    """The sentence to relay for a transcription segment, if it is final."""
    if not segment.final or participant is None or not is_human(participant):
        return None
    text = segment.text.strip()
    if not text:
        return None
    return {
        # Segment ids are only unique per speaker.
        "id": f"{participant.identity}:{segment.id}"[:128],
        "speaker_identity": participant.identity[:255],
        "speaker_name": (participant.name or "")[:255],
        "text": text[:5000],
    }


def to_chat_message(stream_id, text, participant) -> dict | None:
    """The chat message to relay, if a person wrote something."""
    if participant is None or not is_human(participant):
        return None
    text = text.strip()
    if not text:
        return None
    return {
        "id": stream_id[:128],
        "sender_identity": participant.identity[:255],
        "sender_name": (participant.name or "")[:255],
        "text": text[:10000],
    }


@dataclass
class FollowedRoom:
    """A LiveKit room the scribe is in, and what it has not relayed yet."""

    name: str
    room: rtc.Room
    pending: dict[str, dict[str, dict]] = field(
        default_factory=lambda: {SEGMENTS: {}, CHAT: {}}
    )
    tasks: set = field(default_factory=set)

    def add(self, kind: str, item: dict) -> None:
        """Queue an item; a newer version replaces the older one."""
        items = self.pending[kind]
        items.pop(item["id"], None)
        items[item["id"]] = item
        while len(items) > MAX_PENDING:
            del items[next(iter(items))]
            logger.warning(
                "room %s: %s dropped, the Hub is unreachable", self.name, kind
            )

    def people(self) -> list[dict]:
        """Who is still in the call."""
        return people(self.room.remote_participants.values())

    @property
    def is_connected(self) -> bool:
        return self.room.connection_state == rtc.ConnectionState.CONN_CONNECTED


class HubClient:
    """The scribe endpoints of the Hub."""

    def __init__(self, settings: Settings, session: aiohttp.ClientSession):
        self._base = settings.hub_api_url.rstrip("/")
        self._session = session
        self._headers = {"Authorization": f"Bearer {settings.token}"}

    async def rooms(self) -> set[str]:
        """The LiveKit rooms of the Hub's open meetings."""
        async with self._session.get(
            f"{self._base}/scribe/rooms/", headers=self._headers
        ) as response:
            response.raise_for_status()
            return set((await response.json())["rooms"])

    async def presence(self, room_name: str, participants: list[dict]) -> int:
        """Report who is in a call; answers the HTTP status."""
        async with self._session.post(
            f"{self._base}/scribe/rooms/{room_name}/presence/",
            json={"participants": participants},
            headers=self._headers,
        ) as response:
            return response.status

    async def replies(self, room_name: str) -> tuple[int, list[dict]]:
        """Take the assistant's answers to post; answers the status and them."""
        async with self._session.post(
            f"{self._base}/scribe/rooms/{room_name}/replies/",
            headers=self._headers,
        ) as response:
            if response.status != 200:
                return response.status, []
            return response.status, (await response.json())["replies"]

    async def send(self, room_name: str, kind: str, items: list[dict]) -> int:
        """Post sentences or chat messages; answers the HTTP status."""
        async with self._session.post(
            f"{self._base}/scribe/rooms/{room_name}/{kind}/",
            json={PAYLOAD_KEYS[kind]: items},
            headers=self._headers,
        ) as response:
            return response.status


class Scribe:
    """Follows the Hub meetings' calls and relays what happens in them."""

    def __init__(self, settings: Settings, hub: HubClient, livekit: api.LiveKitAPI):
        self.settings = settings
        self.hub = hub
        self.livekit = livekit
        self.followed: dict[str, FollowedRoom] = {}

    def _token(self, room_name: str) -> str:
        return (
            api.AccessToken(
                self.settings.livekit_api_key, self.settings.livekit_api_secret
            )
            .with_identity(SCRIBE_IDENTITY)
            .with_name(self.settings.name)
            .with_kind("agent")
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=room_name,
                    # Visible, so the chat shows who answers; as an agent, Meet
                    # gives it no tile.
                    hidden=False,
                    can_publish=False,
                    # The assistant's answers go to the chat.
                    can_publish_data=True,
                    can_subscribe=True,
                )
            )
            .to_jwt()
        )

    async def _people_in(self, room_name: str) -> list[dict]:
        """Who is in a room the scribe is not in; nobody if it does not exist."""
        try:
            response = await self.livekit.room.list_participants(
                api.ListParticipantsRequest(room=room_name)
            )
        except api.TwirpError as error:
            if error.code == api.TwirpErrorCode.NOT_FOUND:
                return []
            raise
        return people(response.participants)

    async def join(self, room_name: str) -> None:
        """Enter a room and start collecting its sentences and chat."""
        room = rtc.Room()
        followed = FollowedRoom(name=room_name, room=room)

        @room.on("transcription_received")
        def on_transcription(segments, participant, _publication):
            for segment in segments:
                sentence = to_sentence(segment, participant)
                if sentence:
                    followed.add(SEGMENTS, sentence)

        @room.on("track_published")
        def on_track_published(publication, participant):
            listen_to(publication, participant)

        @room.on("disconnected")
        def on_disconnected(reason):
            logger.info("room %s: disconnected (%s)", room_name, reason)

        async def read_chat(reader, participant_identity):
            text = await reader.read_all()
            participant = room.remote_participants.get(participant_identity)
            message = to_chat_message(reader.info.stream_id, text, participant)
            if message:
                followed.add(CHAT, message)

        def on_chat(reader, participant_identity):
            task = asyncio.create_task(read_chat(reader, participant_identity))
            followed.tasks.add(task)
            task.add_done_callback(followed.tasks.discard)

        room.register_text_stream_handler(CHAT_TOPIC, on_chat)

        await room.connect(
            self.settings.livekit_ws_url,
            self._token(room_name),
            rtc.RoomOptions(auto_subscribe=False),
        )
        for participant in room.remote_participants.values():
            for publication in participant.track_publications.values():
                listen_to(publication, participant)
        self.followed[room_name] = followed
        logger.info("room %s: joined", room_name)

    async def leave(self, room_name: str) -> None:
        """Relay what is left, then leave the room."""
        followed = self.followed.pop(room_name, None)
        if followed is None:
            return
        if followed.tasks:
            await asyncio.wait(followed.tasks, timeout=5)
        await self.flush(followed)
        await followed.room.disconnect()
        logger.info("room %s: left", room_name)

    async def flush(self, followed: FollowedRoom) -> bool:
        """Relay the pending items; `False` once the Hub closed the meeting."""
        for kind, items in followed.pending.items():
            while items:
                batch = list(items.values())[:BATCH_SIZE]
                try:
                    status = await self.hub.send(followed.name, kind, batch)
                except aiohttp.ClientError as error:
                    logger.warning(
                        "room %s: Hub unreachable (%s)", followed.name, error
                    )
                    return True
                if status in GONE:
                    for pending in followed.pending.values():
                        pending.clear()
                    return False
                if status >= 300:
                    logger.warning("room %s: Hub answered %s", followed.name, status)
                    break
                for item in batch:
                    # Keep an item updated while the request was running.
                    if items.get(item["id"]) is item:
                        del items[item["id"]]
        return True

    async def _follow(self, room_name: str) -> None:
        """Report who is in one call, then join or leave it accordingly."""
        followed = self.followed.get(room_name)
        if followed and not followed.is_connected:
            await self.leave(room_name)
            followed = None

        present = followed.people() if followed else await self._people_in(room_name)
        status = await self.hub.presence(room_name, present)
        if status in GONE:
            await self.leave(room_name)
        elif present and not followed:
            await self.join(room_name)
        elif not present and followed:
            await self.leave(room_name)

    async def poll(self) -> None:
        """Follow the open meetings' calls, leave the others."""
        wanted = await self.hub.rooms()
        for room_name in list(self.followed):
            if room_name not in wanted:
                await self.leave(room_name)
        for room_name in sorted(wanted):
            try:
                await self._follow(room_name)
            except Exception:  # noqa: BLE001 - one room must not stop the others
                logger.exception("room %s: could not follow", room_name)

    async def post_replies(self, followed: FollowedRoom) -> bool:
        """Post the assistant's answers; `False` once the meeting is closed."""
        if not followed.is_connected:
            return True
        try:
            status, replies = await self.hub.replies(followed.name)
        except aiohttp.ClientError as error:
            logger.warning("room %s: Hub unreachable (%s)", followed.name, error)
            return True
        if status in GONE:
            return False
        for reply in replies:
            try:
                # Uncompressed: the browsers of the call read it as is.
                await followed.room.local_participant.send_text(
                    reply["text"], topic=CHAT_TOPIC, compress=False
                )
            except Exception:  # noqa: BLE001 - the next answers still go out
                logger.exception("room %s: answer not posted", followed.name)
        return True

    async def flush_all(self) -> None:
        """Relay every room's pending items, and post the assistant's answers."""
        for room_name, followed in list(self.followed.items()):
            if not await self.flush(followed) or not await self.post_replies(followed):
                await self.leave(room_name)

    async def run(self, stop: asyncio.Event) -> None:
        """Poll and relay until asked to stop."""
        loop = asyncio.get_running_loop()
        next_poll = 0.0
        while not stop.is_set():
            if loop.time() >= next_poll:
                try:
                    await self.poll()
                except Exception:  # noqa: BLE001 - keep following on a bad poll
                    logger.exception("poll failed")
                next_poll = loop.time() + self.settings.poll_seconds
            await self.flush_all()
            try:
                await asyncio.wait_for(stop.wait(), self.settings.flush_seconds)
            except TimeoutError:
                pass
        for room_name in list(self.followed):
            await self.leave(room_name)


async def main() -> None:
    """Run the scribe, or idle when it is not configured."""
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    settings = Settings.from_env()
    if settings is None:
        # Idle rather than exit: a restart policy would otherwise loop.
        logger.warning(
            "LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, HUB_API_URL or "
            "MEETING_SCRIBE_TOKEN not set: meetings are not followed."
        )
        await stop.wait()
        return

    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        livekit = api.LiveKitAPI(
            settings.livekit_http_url,
            settings.livekit_api_key,
            settings.livekit_api_secret,
        )
        try:
            await Scribe(settings, HubClient(settings, session), livekit).run(stop)
        finally:
            await livekit.aclose()


if __name__ == "__main__":
    asyncio.run(main())
