"""Meeting transcripts: from the relayed subtitles to a Docs document."""

from django.utils import timezone
from django.utils.translation import gettext as _
from django.utils.translation import override

from core import docs


class NoTranscriptError(Exception):
    """Nothing was said, or nothing was relayed, during the meeting."""


def _speaker(segment):
    return segment.speaker_name or segment.speaker_identity


def transcript_markdown(meeting, segments):
    """
    The transcript as markdown: the sentences of one speaker in a row are kept
    together under their name and the time they started speaking.
    """
    lines = []
    current = None
    for segment in segments:
        text = segment.text.strip()
        if not text:
            continue
        speaker = _speaker(segment)
        if speaker != current:
            if current is not None:
                lines.append("")
            spoken_at = timezone.localtime(segment.spoken_at)
            lines.append(f"**{speaker}** ({spoken_at:%H:%M})")
            current = speaker
        lines.append(text)

    started_at = timezone.localtime(meeting.starts_at or meeting.created_at)
    header = [
        _("Meeting of %(date)s") % {"date": f"{started_at:%d/%m/%Y %H:%M}"},
        "",
        _(
            "Transcribed automatically from the live subtitles: it may contain mistakes."
        ),
        "",
    ]
    return "\n".join(header + lines) + "\n"


def document_title(meeting, title):
    """The name of the transcript document, in the organizer's language."""
    with override(meeting.organizer.language):
        return _("Transcript: %(title)s") % {"title": title}


def save_transcript(meeting, title):
    """
    Save the meeting's transcript in Docs, for its organizer, once.

    Returns the id of the document. Raises `NoTranscriptError` when there is
    nothing to save, and `docs.DocsError` when Docs refuses it.
    """
    if meeting.transcript_document_id:
        return meeting.transcript_document_id

    segments = list(meeting.transcript_segments.all())
    if not any(segment.text.strip() for segment in segments):
        raise NoTranscriptError

    with override(meeting.organizer.language), timezone.override(meeting.time_zone):
        content = transcript_markdown(meeting, segments)

    meeting.transcript_document_id = docs.create_document_for_owner(
        title=document_title(meeting, title),
        content=content,
        user=meeting.organizer,
    )
    meeting.save(update_fields=["transcript_document_id", "updated_at"])
    return meeting.transcript_document_id


def transcript_document(meeting, title):
    """Save the transcript (once) and answer it as a meeting document."""
    document_id = save_transcript(meeting, title)
    return {
        "id": document_id,
        "title": document_title(meeting, title),
        "url": docs.document_url(document_id),
    }
