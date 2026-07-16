"""Minimal Hub group registry backed by Matrix rooms."""

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from core.models import BaseModel


class GroupStatus(models.TextChoices):
    """Lifecycle states controlled by Hub."""

    PROVISIONING = "provisioning", _("Provisioning")
    AWAITING_JOIN = "awaiting_join", _("Awaiting join")
    ACTIVE = "active", _("Active")
    MIGRATION_PENDING = "migration_pending", _("Migration pending")
    FAILED = "failed", _("Failed")


class GroupRoomRole(models.TextChoices):
    """A room's role in the ordered Matrix history of a group."""

    PREDECESSOR = "predecessor", _("Predecessor")
    ACTIVE = "active", _("Active")
    SUCCESSOR_PENDING = "successor_pending", _("Successor pending")


class GroupMemberRole(models.TextChoices):
    """Convenience role derived from current Matrix power levels."""

    BOT = "bot", _("Bot")
    OWNER = "owner", _("Owner")
    MODERATOR = "moderator", _("Moderator")
    MEMBER = "member", _("Member")


class Group(BaseModel):
    """Stable business identity for a group, independent of room upgrades."""

    name = models.CharField(max_length=255)
    status = models.CharField(
        max_length=32, choices=GroupStatus.choices, default=GroupStatus.PROVISIONING
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_matrix_groups",
    )
    created_by_matrix_id = models.CharField(max_length=255)
    matrix_account_id = models.CharField(max_length=128)
    # Internal retry key: it is deliberately never exposed by the API.
    idempotency_key = models.CharField(max_length=255)
    ministry = models.CharField(max_length=255, blank=True)
    tags = models.JSONField(default=list, blank=True)
    visibility = models.CharField(max_length=32, default="private")
    emoji = models.CharField(max_length=16, default="🌲")
    allow_external_guests = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("created_by", "idempotency_key"),
                name="matrix_group_creator_idempotency_unique",
            )
        ]
        indexes = [models.Index(fields=("status", "created_at"))]

    @property
    def active_room(self):
        """Return the room currently carrying this group, if any.

        The relation is derived from ``GroupRoom.role`` so the database has a
        single source of truth. When rooms were prefetched, this does not issue
        another query.
        """
        return next(
            (room for room in self.rooms.all() if room.role == GroupRoomRole.ACTIVE),
            None,
        )


class GroupRoom(BaseModel):
    """One Matrix room identifier in a group's ordered history."""

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="rooms")
    room_id = models.CharField(max_length=255, unique=True)
    role = models.CharField(max_length=32, choices=GroupRoomRole.choices)
    sequence = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("sequence", "created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("group",),
                condition=Q(role=GroupRoomRole.ACTIVE),
                name="matrix_group_one_active_room",
            ),
            models.UniqueConstraint(
                fields=("group",),
                condition=Q(role=GroupRoomRole.SUCCESSOR_PENDING),
                name="matrix_group_one_pending_room",
            ),
            models.UniqueConstraint(
                fields=("group", "sequence"), name="matrix_group_room_sequence_unique"
            ),
        ]
        indexes = [models.Index(fields=("group", "role"))]


class GroupMember(BaseModel):
    """Projection of one currently joined member of a group's active room."""

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="members")
    mxid = models.CharField(max_length=255)
    # Matrix members do not necessarily have a verified Hub account binding.
    hub_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="matrix_group_members",
    )
    display_name = models.CharField(max_length=255, blank=True)
    power_level = models.IntegerField(default=0)
    role = models.CharField(
        max_length=16, choices=GroupMemberRole.choices, default=GroupMemberRole.MEMBER
    )

    class Meta:
        ordering = ("display_name", "mxid")
        constraints = [
            models.UniqueConstraint(
                fields=("group", "mxid"), name="matrix_group_member_unique"
            )
        ]
        indexes = [
            models.Index(fields=("mxid",)),
            models.Index(fields=("group", "role")),
            models.Index(fields=("hub_user",)),
        ]


class MatrixAccountBindingStatus(models.TextChoices):
    """Whether a verified Hub-to-Matrix identity binding can be used."""

    ACTIVE = "active", _("Active")
    REVOKED = "revoked", _("Revoked")


class MatrixAccountBinding(BaseModel):
    """Verified relation between a Hub user, account scope and MXID."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="matrix_account_bindings",
    )
    account_id = models.CharField(max_length=128)
    mxid = models.CharField(max_length=255)
    homeserver = models.CharField(max_length=255)
    status = models.CharField(
        max_length=16,
        choices=MatrixAccountBindingStatus.choices,
        default=MatrixAccountBindingStatus.ACTIVE,
    )
    verification_source = models.CharField(max_length=64, default="matrix_whoami")
    verified_at = models.DateTimeField()
    last_seen_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user", "account_id"), name="matrix_binding_user_account_unique"
            ),
            models.UniqueConstraint(
                fields=("account_id", "mxid"), name="matrix_binding_account_mxid_unique"
            ),
        ]


class AppServiceTransaction(BaseModel):
    """Marker proving that one Matrix Application Service transaction succeeded."""

    source_registration = models.CharField(max_length=128)
    txn_id = models.TextField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("source_registration", "txn_id"),
                name="matrix_appservice_transaction_unique",
            )
        ]
