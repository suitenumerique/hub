"""Tests of the meeting scribe, with fake LiveKit and Hub clients."""

import asyncio
from dataclasses import dataclass, field
from types import SimpleNamespace

import aiohttp
import jwt
import pytest
from livekit import api, rtc

import scribe

HUMAN = rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD
AGENT = rtc.ParticipantKind.PARTICIPANT_KIND_AGENT
# Long enough for HS256 (RFC 7518).
SECRET = "s" * 32


def participant(identity="alice-id", name="Alice", kind=HUMAN, publications=()):
    return SimpleNamespace(
        identity=identity,
        name=name,
        kind=kind,
        track_publications={p.sid: p for p in publications},
    )


ALICE = participant()
TRANSCRIBER = participant(identity="agent", name="", kind=AGENT)


def segment(text="Bonjour.", final=True, segment_id="SG_1"):
    return SimpleNamespace(id=segment_id, text=text, final=final)


@dataclass
class FakePublication:
    sid: str
    kind: int
    subscribed: bool = False

    def set_subscribed(self, subscribed):
        self.subscribed = subscribed


def settings(**overrides):
    values = {
        "livekit_url": "wss://livekit.test",
        "livekit_api_key": "key",
        "livekit_api_secret": SECRET,
        "hub_api_url": "http://hub.test/api/v1.0/",
        "token": "scribe-secret",
        "poll_seconds": 10,
        "flush_seconds": 2,
    }
    return scribe.Settings(**{**values, **overrides})


# Settings


def test_settings_missing_value():
    env = {
        "LIVEKIT_URL": "wss://livekit.test",
        "LIVEKIT_API_KEY": "key",
        "LIVEKIT_API_SECRET": "secret",
        "HUB_API_URL": "http://hub.test",
    }
    assert scribe.Settings.from_env(env) is None


def test_settings_urls():
    env = {
        "LIVEKIT_URL": "https://livekit.test",
        "LIVEKIT_API_KEY": "key",
        "LIVEKIT_API_SECRET": "secret",
        "HUB_API_URL": "http://hub.test",
        "MEETING_SCRIBE_TOKEN": "token",
        "SCRIBE_POLL_SECONDS": "5",
    }
    config = scribe.Settings.from_env(env)
    assert config.livekit_ws_url == "wss://livekit.test"
    assert config.livekit_http_url == "https://livekit.test"
    assert config.poll_seconds == 5
    assert settings().livekit_http_url == "https://livekit.test"


# What is relayed


def test_people_leaves_agents_and_the_scribe_out():
    assert scribe.people(
        [ALICE, TRANSCRIBER, participant(identity=scribe.SCRIBE_IDENTITY)]
    ) == [{"identity": "alice-id", "name": "Alice"}]


def test_to_sentence_final_human():
    assert scribe.to_sentence(segment("  Bonjour.  "), ALICE) == {
        "id": "alice-id:SG_1",
        "speaker_identity": "alice-id",
        "speaker_name": "Alice",
        "text": "Bonjour.",
    }


@pytest.mark.parametrize(
    ("seg", "speaker"),
    [
        (segment(final=False), ALICE),
        (segment(text="   "), ALICE),
        (segment(), None),
        (segment(), TRANSCRIBER),
        (segment(), participant(identity=scribe.SCRIBE_IDENTITY)),
    ],
)
def test_to_sentence_ignored(seg, speaker):
    assert scribe.to_sentence(seg, speaker) is None


def test_to_chat_message():
    assert scribe.to_chat_message("ST_1", " Le lien ? ", ALICE) == {
        "id": "ST_1",
        "sender_identity": "alice-id",
        "sender_name": "Alice",
        "text": "Le lien ?",
    }
    assert scribe.to_chat_message("ST_2", "  ", ALICE) is None
    assert scribe.to_chat_message("ST_3", "Réponse", TRANSCRIBER) is None
    assert scribe.to_chat_message("ST_4", "Qui ?", None) is None


def test_listen_to_audio_of_people_only():
    audio = FakePublication("TR_a", rtc.TrackKind.KIND_AUDIO)
    video = FakePublication("TR_v", rtc.TrackKind.KIND_VIDEO)
    agent_audio = FakePublication("TR_b", rtc.TrackKind.KIND_AUDIO)

    scribe.listen_to(audio, ALICE)
    scribe.listen_to(video, ALICE)
    scribe.listen_to(agent_audio, TRANSCRIBER)

    assert (audio.subscribed, video.subscribed, agent_audio.subscribed) == (
        True,
        False,
        False,
    )


def test_followed_room_keeps_latest_version():
    room = scribe.FollowedRoom(name="room", room=None)
    room.add(scribe.SEGMENTS, {"id": "a", "text": "Bon"})
    room.add(scribe.SEGMENTS, {"id": "b", "text": "Salut"})
    room.add(scribe.SEGMENTS, {"id": "a", "text": "Bonjour"})

    assert list(room.pending[scribe.SEGMENTS].values()) == [
        {"id": "b", "text": "Salut"},
        {"id": "a", "text": "Bonjour"},
    ]
    assert room.pending[scribe.CHAT] == {}


def test_followed_room_is_bounded(monkeypatch):
    monkeypatch.setattr(scribe, "MAX_PENDING", 2)
    room = scribe.FollowedRoom(name="room", room=None)
    for item_id in "abc":
        room.add(scribe.CHAT, {"id": item_id})

    assert list(room.pending[scribe.CHAT]) == ["b", "c"]


# Scribe


@dataclass
class FakeHub:
    wanted: set = field(default_factory=set)
    presence_status: dict = field(default_factory=dict)
    statuses: list = field(default_factory=list)
    reports: list = field(default_factory=list)
    sent: list = field(default_factory=list)
    pending_replies: dict = field(default_factory=dict)
    replies_status: int = 200

    async def rooms(self):
        return set(self.wanted)

    async def presence(self, room_name, participants):
        self.reports.append((room_name, [p["identity"] for p in participants]))
        return self.presence_status.get(room_name, 204)

    async def replies(self, room_name):
        if self.replies_status != 200:
            return self.replies_status, []
        return 200, self.pending_replies.pop(room_name, [])

    async def send(self, room_name, kind, items):
        self.sent.append((room_name, kind, [item["id"] for item in items]))
        status = self.statuses.pop(0) if self.statuses else 204
        if isinstance(status, Exception):
            raise status
        return status


@dataclass
class FakeLocalParticipant:
    posted: list = field(default_factory=list)
    fail_on: str | None = None

    async def send_text(self, text, *, topic="", compress=True):
        if text == self.fail_on:
            raise RuntimeError("not sent")
        self.posted.append((topic, text, compress))


@dataclass
class FakeRoom:
    remote_participants: dict = field(default_factory=dict)
    connection_state: int = rtc.ConnectionState.CONN_CONNECTED
    disconnected: bool = False
    local_participant: FakeLocalParticipant = field(
        default_factory=FakeLocalParticipant
    )

    async def disconnect(self):
        self.disconnected = True


class FakeLiveKitRooms:
    def __init__(self, participants):
        self.participants = participants

    async def list_participants(self, request):
        if request.room not in self.participants:
            raise api.TwirpError(
                api.TwirpErrorCode.NOT_FOUND, "room does not exist", status=404
            )
        return SimpleNamespace(participants=self.participants[request.room])


class TestScribe(scribe.Scribe):
    """A scribe whose joins are recorded instead of connecting."""

    __test__ = False

    def __init__(self, hub, participants=None):
        livekit = SimpleNamespace(room=FakeLiveKitRooms(participants or {}))
        super().__init__(settings(), hub, livekit)
        self.joined = []

    async def join(self, room_name):
        self.joined.append(room_name)
        follow(self, room_name)


def follow(bot, room_name, room=None, segments=(), chat=()):
    followed = scribe.FollowedRoom(
        name=room_name, room=room or FakeRoom({"alice-id": ALICE})
    )
    for item_id in segments:
        followed.add(scribe.SEGMENTS, {"id": item_id})
    for item_id in chat:
        followed.add(scribe.CHAT, {"id": item_id})
    bot.followed[room_name] = followed
    return followed


async def test_poll_reports_presence_and_joins_rooms_with_people():
    hub = FakeHub(wanted={"with-people", "only-agent", "never-opened"})
    bot = TestScribe(
        hub,
        participants={"with-people": [ALICE], "only-agent": [TRANSCRIBER]},
    )

    await bot.poll()

    assert bot.joined == ["with-people"]
    assert hub.reports == [
        ("never-opened", []),
        ("only-agent", []),
        ("with-people", ["alice-id"]),
    ]


async def test_poll_does_not_join_a_closed_meeting():
    hub = FakeHub(wanted={"closing"}, presence_status={"closing": 410})
    bot = TestScribe(hub, participants={"closing": [ALICE]})

    await bot.poll()

    assert bot.joined == []


async def test_poll_leaves_rooms_that_are_closed_empty_or_dropped():
    hub = FakeHub(wanted={"kept", "empty", "closed-by-hub", "dropped"})
    hub.presence_status["closed-by-hub"] = 410
    bot = TestScribe(hub)
    kept = follow(bot, "kept")
    no_longer_wanted = follow(bot, "no-longer-wanted", segments=["a"])
    empty = follow(bot, "empty", room=FakeRoom({"agent": TRANSCRIBER}))
    closed = follow(bot, "closed-by-hub")
    dropped = follow(
        bot,
        "dropped",
        room=FakeRoom(
            {"alice-id": ALICE},
            connection_state=rtc.ConnectionState.CONN_DISCONNECTED,
        ),
    )

    await bot.poll()

    assert set(bot.followed) == {"kept"}
    assert not kept.room.disconnected
    for room in (no_longer_wanted, empty, closed, dropped):
        assert room.room.disconnected
    # What was said before leaving is still relayed.
    assert ("no-longer-wanted", scribe.SEGMENTS, ["a"]) in hub.sent
    # The room dropped by LiveKit is reported empty, not with stale people.
    assert ("dropped", []) in hub.reports


async def test_flush_sends_both_kinds_in_batches(monkeypatch):
    monkeypatch.setattr(scribe, "BATCH_SIZE", 2)
    hub = FakeHub()
    bot = TestScribe(hub)
    followed = follow(bot, "room", segments=["a", "b", "c"], chat=["m"])

    assert await bot.flush(followed) is True

    assert hub.sent == [
        ("room", scribe.SEGMENTS, ["a", "b"]),
        ("room", scribe.SEGMENTS, ["c"]),
        ("room", scribe.CHAT, ["m"]),
    ]
    assert followed.pending == {scribe.SEGMENTS: {}, scribe.CHAT: {}}


@pytest.mark.parametrize(
    "failure", [500, aiohttp.ClientConnectionError("down")], ids=["500", "down"]
)
async def test_flush_keeps_items_when_the_hub_fails(failure):
    hub = FakeHub(statuses=[failure])
    bot = TestScribe(hub)
    followed = follow(bot, "room", segments=["a"])

    assert await bot.flush(followed) is True

    assert list(followed.pending[scribe.SEGMENTS]) == ["a"]


async def test_flush_all_leaves_a_closed_meeting():
    hub = FakeHub(statuses=[410])
    bot = TestScribe(hub)
    followed = follow(bot, "room", segments=["a"], chat=["m"])

    await bot.flush_all()

    assert bot.followed == {}
    assert followed.pending == {scribe.SEGMENTS: {}, scribe.CHAT: {}}
    assert followed.room.disconnected


async def test_leave_waits_for_chat_being_read():
    hub = FakeHub()
    bot = TestScribe(hub)
    followed = follow(bot, "room")

    async def slow_read():
        await asyncio.sleep(0.01)
        followed.add(scribe.CHAT, {"id": "late"})

    followed.tasks.add(asyncio.create_task(slow_read()))

    await bot.leave("room")

    assert ("room", scribe.CHAT, ["late"]) in hub.sent


async def test_flush_all_posts_the_assistant_answers():
    hub = FakeHub(pending_replies={"room": [{"id": "1", "text": "Voici."}]})
    bot = TestScribe(hub)
    followed = follow(bot, "room")

    await bot.flush_all()
    await bot.flush_all()

    assert followed.room.local_participant.posted == [
        (scribe.CHAT_TOPIC, "Voici.", False)
    ]


async def test_post_replies_goes_on_after_a_failure():
    hub = FakeHub(
        pending_replies={
            "room": [{"id": "1", "text": "raté"}, {"id": "2", "text": "Voici."}]
        }
    )
    bot = TestScribe(hub)
    followed = follow(bot, "room")
    followed.room.local_participant.fail_on = "raté"

    assert await bot.post_replies(followed) is True

    assert followed.room.local_participant.posted == [
        (scribe.CHAT_TOPIC, "Voici.", False)
    ]


async def test_post_replies_leaves_a_closed_meeting():
    hub = FakeHub(replies_status=410)
    bot = TestScribe(hub)
    followed = follow(bot, "room")

    await bot.flush_all()

    assert bot.followed == {}
    assert followed.room.disconnected


async def test_post_replies_waits_for_the_connection():
    hub = FakeHub(pending_replies={"room": [{"id": "1", "text": "Voici."}]})
    bot = TestScribe(hub)
    followed = follow(
        bot,
        "room",
        room=FakeRoom(connection_state=rtc.ConnectionState.CONN_RECONNECTING),
    )

    assert await bot.post_replies(followed) is True

    assert followed.room.local_participant.posted == []
    assert hub.pending_replies == {"room": [{"id": "1", "text": "Voici."}]}


def test_token_names_the_assistant_and_only_listens():
    bot = TestScribe(FakeHub())
    token = bot._token("room-1")

    claims = api.TokenVerifier("key", SECRET).verify(token)

    assert claims.identity == scribe.SCRIBE_IDENTITY
    assert claims.name == "Ariane"
    # The verifier does not read `kind` back: check the token itself.
    assert jwt.decode(token, options={"verify_signature": False})["kind"] == "agent"
    assert claims.video.room == "room-1"
    assert not claims.video.hidden
    assert claims.video.can_publish is False
    assert claims.video.can_publish_data is True
