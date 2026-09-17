"""
Test the archive of a closed meeting: who may download it, and what is in it.
"""

import io
import zipfile
from datetime import datetime
from datetime import timezone as dt_timezone

from django.test import override_settings
from django.utils import timezone

import pytest
from rest_framework.status import (
    HTTP_200_OK,
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_404_NOT_FOUND,
    HTTP_409_CONFLICT,
    HTTP_502_BAD_GATEWAY,
)
from rest_framework.test import APIClient

from bots import matrix
from core import archives, factories

pytestmark = pytest.mark.django_db

MATRIX_SETTINGS = {
    "MATRIX_AS_TOKEN": "as-token",
    "MATRIX_ADMIN_TOKEN": "admin-token",
    "MATRIX_BOT_USER_ID": "@ariane:localhost",
}
MEMBER = "@bob:localhost"


@pytest.fixture(name="homeserver")
def fixture_homeserver(monkeypatch):
    """A homeserver where the token `bob-token` is Bob's, a room member."""
    calls = []

    def openid_user_id(token):
        calls.append(("openid", token))
        return MEMBER if token == "bob-token" else None

    def joined_members(room_id):
        calls.append(("members", room_id))
        return {"@orga:localhost", MEMBER}

    monkeypatch.setattr(matrix, "openid_user_id", openid_user_id)
    monkeypatch.setattr(matrix, "joined_members", joined_members)
    return calls


def _closed_meeting(**overrides):
    values = {
        "chat_id": "!room:localhost",
        "title": "Point hebdo",
        "agenda": "1. Tour de table",
        "time_zone": "Europe/Paris",
        "starts_at": datetime(2026, 9, 17, 8, 0, tzinfo=dt_timezone.utc),
        "closed_at": datetime(2026, 9, 17, 9, 5, tzinfo=dt_timezone.utc),
        "organizer": factories.UserFactory(full_name="Olga Organisatrice"),
    }
    return factories.MeetingFactory(**{**values, **overrides})


def _client(user):
    client = APIClient()
    client.force_login(user)
    return client


def _archive(client, meeting, **body):
    return client.post(
        f"/api/v1.0/meetings/{meeting.slug}/archive/", body, format="json"
    )


def _files(response):
    content = b"".join(response.streaming_content)
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        return {name: archive.read(name).decode() for name in archive.namelist()}


def test_api_meeting_archive_anonymous():
    """Anonymous users get nothing."""
    meeting = _closed_meeting()

    response = _archive(APIClient(), meeting)

    assert response.status_code == HTTP_401_UNAUTHORIZED


def test_api_meeting_archive_unknown_meeting():
    """An unknown meeting is a 404."""
    response = _archive(
        _client(factories.UserFactory()), factories.MeetingFactory.build()
    )

    assert response.status_code == HTTP_404_NOT_FOUND


@override_settings(**MATRIX_SETTINGS)
def test_api_meeting_archive_organizer(homeserver):
    """The organizer downloads the full archive without any Matrix check."""
    user = factories.UserFactory(full_name="Olga Organisatrice")
    meeting = _closed_meeting(organizer=user)
    factories.MeetingParticipantFactory(meeting=meeting, name="Alice")
    factories.MeetingParticipantFactory(meeting=meeting, name="Bob")
    factories.MeetingAttachmentFactory(
        meeting=meeting, name="../notes.md", content="# Notes"
    )
    factories.MeetingAttachmentFactory(
        meeting=meeting, name="notes.md", content="doublon"
    )
    factories.MeetingTranscriptSegmentFactory(
        meeting=meeting, speaker_name="Alice", text="Bonjour à tous."
    )
    factories.MeetingChatMessageFactory(
        meeting=meeting, sender_name="Bob", text="Je partage l'écran"
    )

    response = _archive(
        _client(user),
        meeting,
        documents=[{"title": "Transcription", "url": "https://docs.test/docs/doc-1/"}],
    )

    assert response.status_code == HTTP_200_OK
    assert response["Content-Type"] == "application/zip"
    assert "attachment" in response["Content-Disposition"]
    assert "2026-09-17-Point-hebdo.zip" in response["Content-Disposition"]
    assert homeserver == []

    files = _files(response)
    assert set(files) == {
        "meeting.md",
        "agenda.md",
        "files/notes.md",
        "files/notes (2).md",
        "transcript.md",
        "chat.md",
    }
    summary = files["meeting.md"]
    assert summary.startswith("# Point hebdo\n")
    # Times follow the organizer's browser, not the UTC server.
    assert "17/09/2026 10:00" in summary
    assert "17/09/2026 11:05" in summary
    assert "Olga Organisatrice" in summary
    assert "- Alice\n- Bob\n" in summary
    assert "1. Tour de table" in summary
    assert "- [Transcription](<https://docs.test/docs/doc-1/>)" in summary
    assert "- files/notes.md\n- files/notes (2).md" in summary
    assert files["files/notes.md"] == "# Notes"
    assert files["files/notes (2).md"] == "doublon"
    assert files["agenda.md"] == "1. Tour de table\n"
    assert "**Alice**" in files["transcript.md"]
    assert "Bonjour à tous." in files["transcript.md"]
    assert "**Bob**" in files["chat.md"]
    assert "Je partage l'écran" in files["chat.md"]


@override_settings(**MATRIX_SETTINGS)
def test_api_meeting_archive_member(homeserver):
    """A member of the conversation proves it with an OpenID token."""
    meeting = _closed_meeting(agenda="")

    response = _archive(
        _client(factories.UserFactory()), meeting, openid_token="bob-token"
    )

    assert response.status_code == HTTP_200_OK
    assert homeserver == [("openid", "bob-token"), ("members", "!room:localhost")]
    assert set(_files(response)) == {"meeting.md"}


@override_settings(**MATRIX_SETTINGS)
@pytest.mark.parametrize("token", ["", "someone-else"])
@pytest.mark.usefixtures("homeserver")
def test_api_meeting_archive_not_a_member(token):
    """Without a valid token of a member, the meeting does not exist."""
    meeting = _closed_meeting()

    response = _archive(_client(factories.UserFactory()), meeting, openid_token=token)

    assert response.status_code == HTTP_404_NOT_FOUND


@override_settings(**MATRIX_SETTINGS)
@pytest.mark.usefixtures("homeserver")
def test_api_meeting_archive_member_of_another_room(monkeypatch):
    """A valid Matrix account outside the conversation gets a 404."""
    monkeypatch.setattr(matrix, "joined_members", lambda room_id: {"@orga:x"})
    meeting = _closed_meeting()

    response = _archive(
        _client(factories.UserFactory()), meeting, openid_token="bob-token"
    )

    assert response.status_code == HTTP_404_NOT_FOUND


@override_settings(MATRIX_AS_TOKEN=None)
def test_api_meeting_archive_member_without_bot(homeserver):
    """Without the Matrix admin access, only the organizer may download."""
    meeting = _closed_meeting()

    response = _archive(
        _client(factories.UserFactory()), meeting, openid_token="bob-token"
    )

    assert response.status_code == HTTP_404_NOT_FOUND
    assert homeserver == []


@override_settings(**MATRIX_SETTINGS)
def test_api_meeting_archive_matrix_failure(monkeypatch):
    """A homeserver failure is a gateway error, not a refusal."""

    def fail(_token):
        raise matrix.MatrixError("down")

    monkeypatch.setattr(matrix, "openid_user_id", fail)
    meeting = _closed_meeting()

    response = _archive(
        _client(factories.UserFactory()), meeting, openid_token="bob-token"
    )

    assert response.status_code == HTTP_502_BAD_GATEWAY


def test_api_meeting_archive_open_meeting():
    """An open meeting has no archive yet."""
    meeting = _closed_meeting(closed_at=None)

    response = _archive(_client(meeting.organizer), meeting)

    assert response.status_code == HTTP_409_CONFLICT


def test_api_meeting_archive_rejects_unsafe_links():
    """Only web links are listed."""
    meeting = _closed_meeting()

    response = _archive(
        _client(meeting.organizer),
        meeting,
        documents=[{"title": "x", "url": "javascript:alert(1)"}],
    )

    assert response.status_code == HTTP_400_BAD_REQUEST


def test_safe_file_name():
    """Attached names cannot leave their folder nor collide."""
    taken = set()
    assert archives.safe_file_name("../../etc/passwd", taken) == "etc_passwd"
    assert archives.safe_file_name("..\\a:b.md", taken) == "a_b.md"
    assert archives.safe_file_name("a.md", taken) == "a.md"
    assert archives.safe_file_name("A.md", taken) == "A (2).md"
    assert archives.safe_file_name("   ", taken) == "file"
    assert archives.safe_file_name("x" * 300, taken) == "x" * 100


def test_archive_auto_closed_summary():
    """The summary says when the meeting closed on its own."""
    meeting = _closed_meeting(auto_closed=True)

    with timezone.override("Europe/Paris"):
        summary = archives.meeting_markdown(meeting, [], [])

    assert "Closed automatically at the end of the meeting." in summary
    assert "Nobody was seen in the call." in summary


def test_api_meeting_archive_in_french():
    """File names and headings follow the language of the person downloading."""
    meeting = _closed_meeting()
    factories.MeetingTranscriptSegmentFactory(meeting=meeting, text="Bonjour.")
    client = _client(meeting.organizer)
    client.cookies["hub_language"] = "fr-fr"

    response = _archive(client, meeting)

    files = _files(response)
    assert set(files) == {"reunion.md", "ordre-du-jour.md", "transcription.md"}
    assert "## Ordre du jour" in files["reunion.md"]
    assert "Début : 17/09/2026 10:00" in files["reunion.md"]
    assert "reunion-2026-09-17-Point-hebdo.zip" in response["Content-Disposition"]
