"""
Declare and configure the models for the hub core application
"""

import uuid
from datetime import timedelta
from logging import getLogger

from django.conf import settings
from django.contrib.auth import models as auth_models
from django.contrib.auth.base_user import AbstractBaseUser
from django.db import connection, models, transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from timezone_field import TimeZoneField

from core.services.meet import MeetClient
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


class MeetRoomManager(models.Manager):
    """Custom manager for the MeetRoom model."""

    def get_or_create_for_chat(self, chat_service_id, user):
        """Return the Visio room of a conversation, creating it on its first call."""
        room = self.filter(chat_service_id=chat_service_id).first()
        if room is not None:
            return room

        with transaction.atomic():
            # No row can be locked yet: lock the conversation itself, so that
            # concurrent first calls do not each create a room on Visio.
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
                    [chat_service_id],
                )
            room = self.filter(chat_service_id=chat_service_id).first()
            if room is not None:
                return room

            meet_room = MeetClient().create_room(user.email)
            return self.create(
                chat_service_id=chat_service_id,
                meet_room_id=meet_room["id"],
                url=meet_room["url"],
                created_by=user,
            )


class MeetRoom(BaseModel):
    """
    The Visio room attached to a conversation.

    A conversation gets a single room, created on its first call and reused for
    every following one.
    """

    chat_service_id = models.CharField(
        _("chat service id"),
        help_text=_("Identifier of the conversation on its chat service."),
        max_length=255,
        unique=True,
    )
    meet_room_id = models.UUIDField(
        _("Visio room id"),
        help_text=_("Identifier of the room on Visio."),
        unique=True,
    )
    url = models.URLField(_("url"), max_length=500)
    created_by = models.ForeignKey(
        User,
        verbose_name=_("created by"),
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
    )

    objects = MeetRoomManager()

    class Meta:
        db_table = "hub_meet_room"
        verbose_name = _("Visio room")
        verbose_name_plural = _("Visio rooms")

    def __str__(self):
        return self.chat_service_id


class CallStatus(models.TextChoices):
    """Status of a call, as shown in its conversation."""

    ONGOING = "ongoing", _("Ongoing")
    ENDED = "ended", _("Ended")


class CallManager(models.Manager):
    """Custom manager for the Call model, handling the lifecycle of calls."""

    def close_stale(self):
        """
        End the calls that nobody joined.

        A call is opened as soon as a user asks for it, before anyone reaches
        Visio. Without a confirmation from Visio within the grace period, it is
        considered as never having taken place.
        """
        limit = timezone.now() - timedelta(seconds=settings.MEET_CALL_JOIN_GRACE_PERIOD)
        return self.filter(
            ended_at__isnull=True, confirmed_at__isnull=True, started_at__lt=limit
        ).update(ended_at=models.F("started_at"), updated_at=timezone.now())

    def start(self, chat_service_id, user):
        """
        Return the ongoing call of a conversation, opening one when there is none.

        Returns a tuple of the call and whether it was opened by this request.
        """
        self.close_stale()

        room = MeetRoom.objects.get_or_create_for_chat(chat_service_id, user)

        with transaction.atomic():
            # Serialize concurrent starts so a conversation never gets two calls.
            MeetRoom.objects.select_for_update().get(pk=room.pk)
            call = self.filter(room=room, ended_at__isnull=True).first()
            if call is not None:
                return call, False
            return self.create(room=room, started_by=user), True

    def handle_started(self, meet_room_id, meet_call_id, started_at):
        """Record that Visio saw a first participant enter a room."""
        try:
            room = MeetRoom.objects.get(meet_room_id=meet_room_id)
        except MeetRoom.DoesNotExist:
            return None

        with transaction.atomic():
            MeetRoom.objects.select_for_update().get(pk=room.pk)
            if call := self.filter(room=room, meet_call_id=meet_call_id).first():
                return call

            call = self.filter(
                room=room, ended_at__isnull=True, confirmed_at__isnull=True
            ).first()
            if call is None:
                # A confirmed call still open means its end was never received.
                self.filter(room=room, ended_at__isnull=True).update(
                    ended_at=started_at, updated_at=timezone.now()
                )
                # The call was started from Visio itself, e.g. with the room link.
                return self.create(
                    room=room,
                    started_at=started_at,
                    confirmed_at=started_at,
                    meet_call_id=meet_call_id,
                )

            call.confirmed_at = started_at
            call.meet_call_id = meet_call_id
            call.save()
            return call

    def handle_ended(self, meet_room_id, meet_call_id, ended_at):
        """Record that Visio saw the last participant leave a room."""
        try:
            room = MeetRoom.objects.get(meet_room_id=meet_room_id)
        except MeetRoom.DoesNotExist:
            return None

        with transaction.atomic():
            MeetRoom.objects.select_for_update().get(pk=room.pk)
            call = self.filter(room=room, meet_call_id=meet_call_id).first()
            if call is None:
                # The start of this call was missed: it can only be the one that
                # is still waiting for its confirmation.
                call = self.filter(
                    room=room, ended_at__isnull=True, confirmed_at__isnull=True
                ).first()
            if call is None or call.ended_at is not None:
                return call

            call.meet_call_id = meet_call_id
            call.ended_at = max(ended_at, call.started_at)
            call.save()
            return call


class Call(BaseModel):
    """A call held in the Visio room of a conversation."""

    room = models.ForeignKey(
        MeetRoom,
        verbose_name=_("room"),
        on_delete=models.CASCADE,
        related_name="calls",
    )
    started_by = models.ForeignKey(
        User,
        verbose_name=_("started by"),
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
    )
    started_at = models.DateTimeField(_("started at"), default=timezone.now)
    confirmed_at = models.DateTimeField(
        _("confirmed at"),
        help_text=_("Date and time at which Visio reported the call as started."),
        null=True,
        blank=True,
    )
    ended_at = models.DateTimeField(_("ended at"), null=True, blank=True)
    meet_call_id = models.CharField(
        _("Visio call id"),
        help_text=_("Identifier of the call on Visio."),
        max_length=255,
        null=True,
        blank=True,
    )

    objects = CallManager()

    class Meta:
        db_table = "hub_call"
        ordering = ("-started_at",)
        verbose_name = _("call")
        verbose_name_plural = _("calls")
        constraints = [
            models.UniqueConstraint(
                fields=["room"],
                condition=models.Q(ended_at__isnull=True),
                name="unique_ongoing_call_per_room",
            ),
            models.UniqueConstraint(
                fields=["room", "meet_call_id"],
                name="unique_meet_call_id_per_room",
            ),
        ]

    def __str__(self):
        return f"{self.room} ({self.started_at:%Y-%m-%d %H:%M})"

    @property
    def status(self):
        """Status of the call."""
        return CallStatus.ENDED if self.ended_at else CallStatus.ONGOING
