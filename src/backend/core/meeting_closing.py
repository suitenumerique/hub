"""
Closing meetings: by their organizer, or by the server once they are over.

A meeting closes on its own when its planned end has passed and nobody is in
the call any more, as the scribe reports it. The server then saves the
transcript in Docs and, since no member's client is there to do it, Ariane
writes the closing into the conversation's meeting state: every member's Hub
closes the call window and lists the meeting in the history.
"""

import logging
import threading
from datetime import timedelta

from django.db import close_old_connections, transaction
from django.utils import timezone
from django.utils.translation import gettext as _
from django.utils.translation import override

from bots import matrix
from core import docs, models, transcripts

logger = logging.getLogger(__name__)

MEETING_EVENT_TYPE = "io.lasuite.hub.meeting"


def close(meeting, *, auto=False):
    """Mark the meeting closed; answers whether it was still open."""
    with transaction.atomic():
        updated = models.Meeting.objects.filter(
            pk=meeting.pk, closed_at__isnull=True
        ).update(closed_at=timezone.now(), auto_closed=auto)
    meeting.refresh_from_db(fields=["closed_at", "auto_closed"])
    return bool(updated)


def is_due(meeting, now):
    """Whether the planned end of an open meeting has passed."""
    return (
        meeting.closed_at is None
        and meeting.planned_end_at is not None
        and now >= meeting.planned_end_at
    )


def record_presence(meeting, participants):
    """
    Keep who is in the call, and close the meeting when it is over and empty.
    Answers whether the meeting is (now) closed.
    """
    now = timezone.now()
    for participant in participants:
        record, created = models.MeetingParticipant.objects.get_or_create(
            meeting=meeting,
            identity=participant["identity"],
            defaults={
                "name": participant["name"],
                "first_seen_at": now,
                "last_seen_at": now,
            },
        )
        if not created:
            record.last_seen_at = now
            record.name = participant["name"] or record.name
            record.save(update_fields=["last_seen_at", "name", "updated_at"])

    if participants:
        models.Meeting.objects.filter(pk=meeting.pk).update(last_occupied_at=now)
        return meeting.closed_at is not None

    if is_due(meeting, now) and close(meeting, auto=True):
        logger.info("meeting %s: over and empty, closed", meeting.slug)
        run_in_background(finish_auto_close, meeting.pk)
    return meeting.closed_at is not None


def run_in_background(function, *args):
    """Docs and Matrix take seconds: the scribe is not kept waiting."""

    def run():
        try:
            function(*args)
        except Exception:  # pylint: disable=broad-exception-caught
            # A background failure is only logged.
            logger.exception("meeting closing: %s failed", function.__name__)
        finally:
            close_old_connections()

    threading.Thread(target=run, daemon=True).start()


def finish_auto_close(meeting_pk):
    """Save the transcript, then let Ariane close the meeting for the members."""
    meeting = models.Meeting.objects.select_related("organizer").get(pk=meeting_pk)
    document = None
    if docs.is_docs_configured():
        with override(meeting.organizer.language):
            title = meeting.title or _("Meeting")
        try:
            document = transcripts.transcript_document(meeting, title)
        except transcripts.NoTranscriptError:
            pass
        except docs.DocsError:
            logger.warning("meeting %s: transcript not saved", meeting.slug)
    publish_closed(meeting, document)


def publish_closed(meeting, document=None):
    """
    Write the closing (and the transcript) into the meeting state, as Ariane.
    Fields written by the members' clients are kept.
    """
    if not meeting.chat_id or not matrix.can_write_rooms():
        return
    try:
        matrix.ensure_in_room(meeting.chat_id)
        content = matrix.get_room_state(
            meeting.chat_id, MEETING_EVENT_TYPE, meeting.slug
        )
        changed = False
        if not content.get("endedAt"):
            content["endedAt"] = int(meeting.closed_at.timestamp() * 1000)
            content["endedBy"] = "auto"
            changed = True
        if document:
            existing = content.get("documents")
            others = [
                entry
                for entry in (existing if isinstance(existing, list) else [])
                if not (isinstance(entry, dict) and entry.get("id") == document["id"])
            ]
            content["documents"] = [*others, document]
            changed = True
        if changed:
            matrix.set_room_state(
                meeting.chat_id, MEETING_EVENT_TYPE, meeting.slug, content
            )
    except matrix.MatrixError as error:
        logger.warning(
            "meeting %s: closing not written in %s: %s",
            meeting.slug,
            meeting.chat_id,
            error,
        )


def extend(meeting, minutes):
    """
    Push the planned end back, as the members' clients do: from the planned
    end when there is one, from now otherwise.
    """
    base = meeting.planned_end_at or timezone.now()
    meeting.planned_end_at = base + timedelta(minutes=minutes)
    meeting.save(update_fields=["planned_end_at", "updated_at"])
