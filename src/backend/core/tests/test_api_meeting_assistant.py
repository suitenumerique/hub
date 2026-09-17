"""
Test Ariane in the chat of a call: when she answers, what she reads, and how
the scribe takes her answers.
"""

from datetime import timedelta

from django.test import override_settings
from django.utils import timezone

import pytest
from rest_framework.status import HTTP_200_OK, HTTP_204_NO_CONTENT, HTTP_410_GONE
from rest_framework.test import APIClient

from bots import albert
from core import factories, meeting_assistant, meeting_closing, models

pytestmark = pytest.mark.django_db

SCRIBE_TOKEN = "scribe-secret"
SETTINGS = {
    "MEETING_SCRIBE_TOKEN": SCRIBE_TOKEN,
    "ALBERT_API_KEY": "albert-key",
    "BOTS_PING_NAMES": ["ariane"],
}


@pytest.fixture(name="albert_calls")
def fixture_albert_calls(monkeypatch):
    """Albert answers every question, and the calls are kept."""
    calls = []

    def answer(messages, command):
        calls.append((messages, command))
        return "Voici le résumé."

    monkeypatch.setattr(albert, "answer", answer)
    monkeypatch.setattr(
        meeting_closing, "run_in_background", lambda function, *args: function(*args)
    )
    return calls


def _scribe_client():
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {SCRIBE_TOKEN}")
    return client


def _chat(meeting, *messages):
    return _scribe_client().post(
        f"/api/v1.0/scribe/rooms/{meeting.livekit_room}/chat/",
        {"messages": list(messages)},
        format="json",
    )


def _message(message_id, text, identity="bob", name="Bob"):
    return {
        "id": message_id,
        "sender_identity": identity,
        "sender_name": name,
        "text": text,
    }


def _replies(meeting):
    return _scribe_client().post(
        f"/api/v1.0/scribe/rooms/{meeting.livekit_room}/replies/"
    )


@override_settings(**SETTINGS)
def test_api_scribe_chat_ping_gets_an_answer(albert_calls):
    """A message addressed to Ariane gets an answer, posted once by the scribe."""
    meeting = factories.MeetingFactory(title="Point hebdo", agenda="1. Démo")

    assert (
        _chat(meeting, _message("m1", "@ariane résume la réunion")).status_code
        == HTTP_204_NO_CONTENT
    )

    [(messages, command)] = albert_calls
    assert command is None
    assert "Point hebdo" in messages[0]["content"]
    assert "1. Démo" in messages[0]["content"]
    assert messages[-1] == {
        "role": "user",
        "content": "Bob : @ariane résume la réunion",
    }

    response = _replies(meeting)
    assert response.status_code == HTTP_200_OK
    [reply] = response.json()["replies"]
    assert reply["text"] == "Voici le résumé."
    assert response.json()["assistant"] == "Ariane"
    stored = models.MeetingChatMessage.objects.get(pk=reply["id"])
    assert stored.from_assistant is True
    assert stored.reply_to.message_id == "m1"

    # Taken once.
    assert _replies(meeting).json()["replies"] == []


@override_settings(**SETTINGS)
def test_api_scribe_chat_without_ping_is_only_kept(albert_calls):
    """Ariane stays silent unless addressed with an @, and never twice."""
    meeting = factories.MeetingFactory()

    _chat(
        meeting,
        _message("m1", "Ariane nous a répondu hier"),
        _message("m2", "a@ariane.fr"),
    )
    _chat(meeting, _message("m3", "@ariane bonjour"))
    _chat(meeting, _message("m3", "@ariane bonjour"))

    assert len(albert_calls) == 1
    assert models.MeetingChatMessage.objects.filter(from_assistant=False).count() == 3


@override_settings(**{**SETTINGS, "ALBERT_API_KEY": None})
def test_api_scribe_chat_without_albert(albert_calls):
    """Without her model, Ariane does not answer at all."""
    meeting = factories.MeetingFactory()

    _chat(meeting, _message("m1", "@ariane bonjour"))

    assert albert_calls == []
    assert _replies(meeting).json()["replies"] == []


@override_settings(**SETTINGS)
def test_api_scribe_chat_help_is_answered_without_albert(albert_calls):
    """The help is a canned answer."""
    meeting = factories.MeetingFactory()

    _chat(meeting, _message("m1", "@ariane /aide"))

    assert albert_calls == []
    [reply] = _replies(meeting).json()["replies"]
    assert "@Ariane" in reply["text"]


@override_settings(**SETTINGS)
@pytest.mark.usefixtures("albert_calls")
def test_api_scribe_chat_albert_failure(monkeypatch):
    """When Albert fails, Ariane still says so in the call."""

    def fail(_messages, _command):
        raise albert.AlbertError("down")

    monkeypatch.setattr(albert, "answer", fail)
    meeting = factories.MeetingFactory()

    _chat(meeting, _message("m1", "@ariane bonjour"))

    [reply] = _replies(meeting).json()["replies"]
    assert "Réessayez" in reply["text"]


@override_settings(**SETTINGS)
def test_meeting_assistant_reads_only_since_the_asker_arrived(albert_calls):
    """A late arrival gets nothing of what was said before them."""
    meeting = factories.MeetingFactory()
    now = timezone.now()
    factories.MeetingParticipantFactory(
        meeting=meeting, identity="bob", first_seen_at=now - timedelta(minutes=5)
    )
    factories.MeetingTranscriptSegmentFactory(
        meeting=meeting,
        speaker_name="Alice",
        text="Le budget secret est de 10 k€.",
        spoken_at=now - timedelta(minutes=30),
    )
    factories.MeetingTranscriptSegmentFactory(
        meeting=meeting,
        speaker_name="Alice",
        text="Passons à la démo.",
        spoken_at=now - timedelta(minutes=2),
    )
    factories.MeetingChatMessageFactory(
        meeting=meeting,
        sender_name="Alice",
        text="Le lien de la démo",
        sent_at=now - timedelta(minutes=1),
    )
    factories.MeetingChatMessageFactory(
        meeting=meeting,
        text="Réponse précédente",
        from_assistant=True,
        sent_at=now - timedelta(seconds=30),
    )

    _chat(meeting, _message("m1", "@ariane de quoi a-t-on parlé ?"))

    [(messages, _)] = albert_calls
    contents = [message["content"] for message in messages]
    assert not any("budget secret" in content for content in contents)
    assert "Alice (à l'oral) : Passons à la démo." in contents
    assert "Alice (dans la discussion) : Le lien de la démo" in contents
    assert {"role": "assistant", "content": "Réponse précédente"} in messages


@override_settings(**SETTINGS)
def test_meeting_assistant_unknown_asker_reads_nothing_before(albert_calls):
    """Someone the scribe has not seen yet only gets the meeting itself."""
    meeting = factories.MeetingFactory(title="Point")
    factories.MeetingTranscriptSegmentFactory(
        meeting=meeting,
        text="Dit avant.",
        spoken_at=timezone.now() - timedelta(minutes=1),
    )

    _chat(meeting, _message("m1", "@ariane résume", identity="inconnu"))

    [(messages, _)] = albert_calls
    assert len(messages) == 2
    assert not any("Dit avant." in message["content"] for message in messages)


@override_settings(**SETTINGS)
def test_api_scribe_replies_closed_meeting():
    """A closed meeting has nothing more to post."""
    meeting = factories.MeetingFactory(closed_at=timezone.now())

    assert _replies(meeting).status_code == HTTP_410_GONE


def test_meeting_assistant_is_for_assistant():
    """Ariane's own messages never address her."""
    with override_settings(BOTS_PING_NAMES=["ariane"]):
        own = models.MeetingChatMessage(text="@ariane", from_assistant=True)
        asked = models.MeetingChatMessage(text="Merci @Ariane !")
        assert meeting_assistant.is_for_assistant(own) is False
        assert meeting_assistant.is_for_assistant(asked) is True
