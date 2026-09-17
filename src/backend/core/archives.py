"""
The archive of a closed meeting: one ZIP file with everything the Hub kept.

    meeting.md        title, dates, organizer, participants, agenda, documents
    agenda.md         the agenda, when one was written
    files/…           the text files attached when the meeting was planned
    transcript.md     what was said, from the live subtitles
    chat.md           what was written in the chat of the call

File names follow the language of the person downloading the archive.
"""

import io
import re
import zipfile

from django.utils import timezone
from django.utils.translation import gettext as _
from django.utils.translation import pgettext

from core.transcripts import transcript_markdown

MAX_NAME_LENGTH = 100


def safe_file_name(name, taken):
    """A file name that stays inside its folder and is not already used."""
    # Path parts such as `..` are dropped, the others joined with `_`.
    parts = [part for part in re.split(r"[\\/]+", name) if part.strip(" .")]
    base = re.sub(r"[:*?\"<>|\x00-\x1f]+", "_", "_".join(parts)).strip(" .")
    base = (base or "file")[:MAX_NAME_LENGTH]
    candidate, counter = base, 1
    stem, dot, extension = base.rpartition(".")
    while candidate.lower() in taken:
        counter += 1
        candidate = f"{stem} ({counter}).{extension}" if dot else f"{base} ({counter})"
    taken.add(candidate.lower())
    return candidate


def _time(value):
    return f"{timezone.localtime(value):%d/%m/%Y %H:%M}" if value else "-"


def _escape(text):
    """Keep user text from turning into markdown links or headings."""
    return re.sub(r"([\\`*_\[\]<>#])", r"\\\1", text)


def _participants(meeting):
    names = []
    for participant in meeting.participants.all():
        name = participant.name or participant.identity
        if name not in names:
            names.append(name)
    return names


def meeting_markdown(meeting, documents, attachment_names):
    """The summary page of the archive."""
    organizer = meeting.organizer
    started_at = meeting.starts_at or meeting.created_at
    if meeting.auto_closed:
        closing = _("Closed automatically at the end of the meeting.")
    else:
        closing = _("Closed by its organizer.")

    lines = [
        f"# {_escape(meeting.title or _('Meeting'))}",
        "",
        "- " + _("Start: %(time)s") % {"time": _time(started_at)},
        "- " + _("End: %(time)s") % {"time": _time(meeting.closed_at)},
        "- "
        + _("Organizer: %(name)s")
        % {"name": _escape(organizer.full_name or organizer.email or str(organizer))},
        f"- {closing}",
        "",
        f"## {_('Participants')}",
        "",
    ]
    participants = _participants(meeting)
    lines += [f"- {_escape(name)}" for name in participants] or [
        _("Nobody was seen in the call.")
    ]

    lines += ["", f"## {_('Agenda')}", ""]
    lines.append(meeting.agenda.strip() if meeting.agenda.strip() else _("No agenda."))

    lines += ["", f"## {_('Documents')}", ""]
    entries = [
        f"- [{_escape(document['title'])}](<{document['url']}>)"
        for document in documents
    ] + [f"- {_('files')}/{_escape(name)}" for name in attachment_names]
    lines += entries or [_("No document.")]
    return "\n".join(lines) + "\n"


def chat_markdown(meeting):
    """The call chat, one message per line."""
    lines = [f"# {_('Chat of the call')}", ""]
    for message in meeting.chat_messages.all():
        sent_at = timezone.localtime(message.sent_at)
        sender = message.sender_name or message.sender_identity
        lines.append(f"**{_escape(sender)}** ({sent_at:%H:%M})")
        if message.from_assistant:
            lines[-1] += " " + _("(automatic assistant)")
        lines.append(message.text)
        lines.append("")
    return "\n".join(lines)


def build_archive(meeting, documents):
    """
    The ZIP archive of a closed meeting, as bytes. `documents` are the links
    listed in the meeting state (`title`, `url`).
    """
    buffer = io.BytesIO()
    taken = set()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        attachment_names = []
        folder = _("files")
        for attachment in meeting.attachments.all():
            name = safe_file_name(attachment.name, taken)
            attachment_names.append(name)
            archive.writestr(f"{folder}/{name}", attachment.content)

        archive.writestr(
            _("meeting.md"),
            meeting_markdown(meeting, documents, attachment_names),
        )
        if meeting.agenda.strip():
            archive.writestr(_("agenda.md"), meeting.agenda.strip() + "\n")

        segments = list(meeting.transcript_segments.all())
        if segments:
            archive.writestr(_("transcript.md"), transcript_markdown(meeting, segments))
        if meeting.chat_messages.exists():
            archive.writestr(_("chat.md"), chat_markdown(meeting))
    return buffer.getvalue()


def archive_file_name(meeting):
    """`meeting-<date>-<title>.zip`, readable and safe."""
    started_at = timezone.localtime(meeting.starts_at or meeting.created_at)
    title = re.sub(r"[^\w-]+", "-", meeting.title or "", flags=re.UNICODE).strip("-")
    parts = [
        pgettext("archive file name", "meeting"),
        f"{started_at:%Y-%m-%d}",
        title[:40] or meeting.slug,
    ]
    return "-".join(parts) + ".zip"
