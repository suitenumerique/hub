"""
Declare and configure the models for the hub core application
"""

import uuid
from logging import getLogger

from django.conf import settings
from django.contrib.auth import models as auth_models
from django.contrib.auth.base_user import AbstractBaseUser
from django.db import models
from django.utils.translation import gettext_lazy as _

from timezone_field import TimeZoneField

from core.validators import sub_validator

logger = getLogger(__name__)


class DuplicateEmailError(Exception):
    """Raised when an email is already associated with a pre-existing user."""

    def __init__(self, message=None, email=None):
        """Set message and email to describe the exception."""
        self.message = message
        self.email = email
        super().__init__(self.message)


class BaseModel(models.Model):
    """
    Serves as an abstract base model for other models, ensuring that records are validated
    before saving as Django doesn't do it by default.

    Includes fields common to all models: a UUID primary key and creation/update timestamps.
    """

    id = models.UUIDField(
        verbose_name=_("id"),
        help_text=_("primary key for the record as UUID"),
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    created_at = models.DateTimeField(
        verbose_name=_("created on"),
        help_text=_("date and time at which a record was created"),
        auto_now_add=True,
        editable=False,
    )
    updated_at = models.DateTimeField(
        verbose_name=_("updated on"),
        help_text=_("date and time at which a record was last updated"),
        auto_now=True,
        editable=False,
    )

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        """Call `full_clean` before saving."""
        self.full_clean()
        super().save(*args, **kwargs)


class UserManager(auth_models.UserManager):
    """Custom manager for User model with additional methods."""

    def get_user_by_sub_or_email(self, sub, email):
        """Fetch existing user by sub or email."""
        try:
            return self.get(sub=sub)
        except self.model.DoesNotExist as err:
            if not email:
                return None

            if settings.OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION:
                try:
                    return self.get(email__iexact=email)
                except self.model.DoesNotExist:
                    pass
            elif (
                self.filter(email__iexact=email).exists()
                and not settings.OIDC_ALLOW_DUPLICATE_EMAILS
            ):
                raise DuplicateEmailError(
                    _(
                        "We couldn't find a user with this sub but the email is already "
                        "associated with a registered user."
                    )
                ) from err
        return None


class User(AbstractBaseUser, BaseModel, auth_models.PermissionsMixin):
    """User model to work with OIDC only authentication."""

    sub = models.CharField(
        _("sub"),
        help_text=_("Required. 255 characters or fewer. ASCII characters only."),
        max_length=255,
        validators=[sub_validator],
        unique=True,
        blank=True,
        null=True,
    )

    full_name = models.CharField(_("full name"), max_length=100, null=True, blank=True)
    short_name = models.CharField(
        _("short name"), max_length=100, null=True, blank=True
    )

    email = models.EmailField(_("identity email address"), blank=True, null=True)

    matrix_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    professional_role = models.CharField(max_length=40, blank=True, default="")

    # Unlike the "email" field which stores the email coming from the OIDC token, this field
    # stores the email used by staff users to login to the admin site
    admin_email = models.EmailField(
        _("admin email address"), unique=True, blank=True, null=True
    )

    language = models.CharField(
        max_length=10,
        choices=settings.LANGUAGES,
        default=None,
        verbose_name=_("language"),
        help_text=_("The language in which the user wants to see the interface."),
        null=True,
        blank=True,
    )
    timezone = TimeZoneField(
        choices_display="WITH_GMT_OFFSET",
        use_pytz=False,
        default=settings.TIME_ZONE,
        help_text=_("The timezone in which the user wants to see times."),
    )
    is_device = models.BooleanField(
        _("device"),
        default=False,
        help_text=_("Whether the user is a device or a real user."),
    )
    is_staff = models.BooleanField(
        _("staff status"),
        default=False,
        help_text=_("Whether the user can log into this admin site."),
    )
    is_active = models.BooleanField(
        _("active"),
        default=True,
        help_text=_(
            "Whether this user should be treated as active. "
            "Unselect this instead of deleting hub."
        ),
    )

    objects = UserManager()

    USERNAME_FIELD = "admin_email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "hub_user"
        verbose_name = _("user")
        verbose_name_plural = _("users")

    def __str__(self):
        return self.email or self.admin_email or str(self.id)


class Meeting(BaseModel):
    """
    A Meet room created by the Hub for one of its users.

    The Matrix room state is what members see (title, schedule, documents).
    The Hub keeps what the server needs on its own: which LiveKit room to
    follow, when the meeting should end, who may close it, and what goes in its
    archive (agenda, attached files, participants, transcript, call chat).
    """

    slug = models.CharField(_("slug"), max_length=64, unique=True)
    livekit_room = models.CharField(
        _("LiveKit room"),
        max_length=64,
        unique=True,
        help_text=_("Identifier of the Meet room, used as the LiveKit room name."),
    )
    organizer = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="meetings"
    )
    chat_id = models.CharField(
        _("conversation"),
        max_length=255,
        blank=True,
        help_text=_("Matrix room the meeting belongs to."),
    )
    title = models.CharField(_("title"), max_length=200, blank=True)
    starts_at = models.DateTimeField(_("starts on"), null=True, blank=True)
    planned_end_at = models.DateTimeField(
        _("planned end"),
        null=True,
        blank=True,
        help_text=_("Past this time, the meeting closes once nobody is in it."),
    )
    agenda = models.TextField(_("agenda"), blank=True)
    time_zone = models.CharField(
        _("time zone"),
        max_length=64,
        default="UTC",
        help_text=_("Of the organizer's browser: times in the archive use it."),
    )
    last_occupied_at = models.DateTimeField(
        _("last occupied on"), null=True, blank=True
    )
    closed_at = models.DateTimeField(_("closed on"), null=True, blank=True)
    auto_closed = models.BooleanField(_("closed automatically"), default=False)
    transcript_document_id = models.CharField(
        _("transcript document"), max_length=64, null=True, blank=True
    )

    class Meta:
        db_table = "hub_meeting"
        verbose_name = _("meeting")
        verbose_name_plural = _("meetings")
        ordering = ["-created_at"]

    def __str__(self):
        return self.slug


class MeetingAttachment(BaseModel):
    """A text file (agenda or document) attached when the meeting was planned."""

    meeting = models.ForeignKey(
        Meeting, on_delete=models.CASCADE, related_name="attachments"
    )
    name = models.CharField(_("name"), max_length=255)
    content = models.TextField(_("content"))

    class Meta:
        db_table = "hub_meeting_attachment"
        verbose_name = _("meeting attachment")
        verbose_name_plural = _("meeting attachments")
        ordering = ["created_at"]

    def __str__(self):
        return self.name


class MeetingParticipant(BaseModel):
    """Someone who was in the call, as the scribe saw them."""

    meeting = models.ForeignKey(
        Meeting, on_delete=models.CASCADE, related_name="participants"
    )
    identity = models.CharField(_("identity"), max_length=255)
    name = models.CharField(_("name"), max_length=255, blank=True)
    first_seen_at = models.DateTimeField(_("first seen on"))
    last_seen_at = models.DateTimeField(_("last seen on"))

    class Meta:
        db_table = "hub_meeting_participant"
        verbose_name = _("meeting participant")
        verbose_name_plural = _("meeting participants")
        ordering = ["first_seen_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["meeting", "identity"],
                name="unique_participant_per_meeting",
            )
        ]

    def __str__(self):
        return self.name or self.identity


class MeetingTranscriptSegment(BaseModel):
    """
    One final sentence of the live transcript, as the Meet transcriber agent
    publishes it in the LiveKit room and the Hub scribe relays it.
    """

    meeting = models.ForeignKey(
        Meeting, on_delete=models.CASCADE, related_name="transcript_segments"
    )
    segment_id = models.CharField(_("segment id"), max_length=128)
    speaker_identity = models.CharField(_("speaker identity"), max_length=255)
    speaker_name = models.CharField(_("speaker name"), max_length=255, blank=True)
    text = models.TextField(_("text"))
    spoken_at = models.DateTimeField(
        _("spoken on"), help_text=_("When the scribe received the sentence.")
    )

    class Meta:
        db_table = "hub_meeting_transcript_segment"
        verbose_name = _("meeting transcript segment")
        verbose_name_plural = _("meeting transcript segments")
        ordering = ["spoken_at", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["meeting", "segment_id"],
                name="unique_segment_per_meeting",
            )
        ]

    def __str__(self):
        return f"{self.speaker_name or self.speaker_identity}: {self.text[:40]}"


class MeetingChatMessage(BaseModel):
    """A message written in the chat of the call, relayed by the scribe."""

    meeting = models.ForeignKey(
        Meeting, on_delete=models.CASCADE, related_name="chat_messages"
    )
    message_id = models.CharField(_("message id"), max_length=128)
    sender_identity = models.CharField(_("sender identity"), max_length=255)
    sender_name = models.CharField(_("sender name"), max_length=255, blank=True)
    text = models.TextField(_("text"))
    sent_at = models.DateTimeField(
        _("sent on"), help_text=_("When the scribe received the message.")
    )
    from_assistant = models.BooleanField(
        _("from the assistant"),
        default=False,
        help_text=_("Written by Ariane, for the scribe to post in the call."),
    )
    reply_to = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replies",
    )
    delivered_at = models.DateTimeField(
        _("delivered on"),
        null=True,
        blank=True,
        help_text=_("When the scribe took an assistant message to post it."),
    )

    class Meta:
        db_table = "hub_meeting_chat_message"
        verbose_name = _("meeting chat message")
        verbose_name_plural = _("meeting chat messages")
        ordering = ["sent_at", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["meeting", "message_id"],
                name="unique_chat_message_per_meeting",
            )
        ]

    def __str__(self):
        return f"{self.sender_name or self.sender_identity}: {self.text[:40]}"
