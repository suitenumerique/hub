"""Durable Hub group registry and reconstructable Matrix projections."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from core.models import BaseModel


class GroupStatus(models.TextChoices):
    """Lifecycle states controlled by Hub."""

    PROVISIONING = "provisioning", _("Provisioning")
    AWAITING_REQUESTER_JOIN = "awaiting_requester_join", _("Awaiting requester join")
    ACTIVE = "active", _("Active")
    ARCHIVED = "archived", _("Archived")
    MIGRATION_PENDING = "migration_pending", _("Migration pending")
    DELETION_PENDING = "deletion_pending", _("Deletion pending")
    DELETED = "deleted", _("Deleted")
    FAILED = "failed", _("Failed")


class GroupRoomRole(models.TextChoices):
    """A room's role in the stable group history chain."""

    ACTIVE = "active", _("Active")
    PREDECESSOR = "predecessor", _("Predecessor")
    SUCCESSOR_PENDING = "successor_pending", _("Successor pending")
    ABANDONED = "abandoned", _("Abandoned")


class Group(BaseModel):
    """Stable business identity for a Hub group."""

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
    created_via_account_id = models.CharField(max_length=128)
    control_homeserver = models.CharField(max_length=128)
    active_room = models.ForeignKey(
        "GroupMatrixRoom",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="active_for_groups",
    )
    # Reuse the same group when a client retries one creation request.
    idempotency_key = models.CharField(max_length=255)
    # Match Matrix metadata with the exact provisioning performed by Hub.
    provisioning_nonce = models.CharField(max_length=255, unique=True)
    ministry = models.CharField(max_length=255, blank=True)
    tags = models.JSONField(default=list, blank=True)
    visibility = models.CharField(max_length=32, default="private")
    emoji = models.CharField(max_length=16, default="🌲")
    announcements_only = models.BooleanField(default=False)
    allow_external_guests = models.BooleanField(default=False)
    last_reconciled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("created_by", "idempotency_key"),
                name="matrix_group_creator_idempotency_unique",
            )
        ]
        indexes = [models.Index(fields=("status", "created_at"))]

    def clean(self):
        """Keep the active room pointer inside this group."""
        super().clean()
        if self.active_room_id and self.active_room.group_id != self.id:
            raise ValidationError({"active_room": _("Room belongs to another group.")})


class GroupMatrixRoom(BaseModel):
    """One Matrix room in a stable group's ordered history chain."""

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="rooms")
    room_id = models.CharField(max_length=255, unique=True)
    control_homeserver = models.CharField(max_length=128)
    room_version = models.CharField(max_length=32, blank=True)
    role = models.CharField(max_length=32, choices=GroupRoomRole.choices)
    sequence = models.PositiveIntegerField(default=0)
    predecessor_room_id = models.CharField(max_length=255, null=True, blank=True)
    successor_room_id = models.CharField(max_length=255, null=True, blank=True)
    tombstone_event_id = models.CharField(max_length=255, null=True, blank=True)
    create_event_id = models.CharField(max_length=255, null=True, blank=True)
    is_hardened = models.BooleanField(default=False)
    marker_mode = models.CharField(max_length=32, default="type_and_state")
    metadata_schema_version = models.PositiveIntegerField(null=True, blank=True)
    metadata_group_id = models.UUIDField(null=True, blank=True)
    name = models.CharField(max_length=255, blank=True)
    topic = models.TextField(blank=True)
    avatar_mxc = models.CharField(max_length=255, blank=True)
    is_encrypted = models.BooleanField(default=False)
    join_rule = models.CharField(max_length=32, blank=True)
    history_visibility = models.CharField(max_length=32, blank=True)
    activated_at = models.DateTimeField(null=True, blank=True)
    retired_at = models.DateTimeField(null=True, blank=True)
    last_state_event_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("sequence", "created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("group", "role"),
                condition=Q(role=GroupRoomRole.ACTIVE),
                name="matrix_group_one_active_room",
            ),
            models.UniqueConstraint(
                fields=("group", "sequence"), name="matrix_group_room_sequence_unique"
            ),
        ]
        indexes = [models.Index(fields=("group", "role"))]


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


class MembershipState(models.TextChoices):
    """Matrix membership states retained in the projection."""

    INVITE = "invite", _("Invite")
    JOIN = "join", _("Join")
    LEAVE = "leave", _("Leave")
    BAN = "ban", _("Ban")
    KNOCK = "knock", _("Knock")


class GroupMemberRole(models.TextChoices):
    """Convenience role derived from current Matrix power levels."""

    BOT = "bot", _("Bot")
    OWNER = "owner", _("Owner")
    MODERATOR = "moderator", _("Moderator")
    MEMBER = "member", _("Member")


class GroupMembership(BaseModel):
    """Current projected membership and power level for one room/MXID."""

    room = models.ForeignKey(
        GroupMatrixRoom, on_delete=models.CASCADE, related_name="memberships"
    )
    mxid = models.CharField(max_length=255)
    # Matrix members do not necessarily have a verified Hub account binding.
    hub_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="matrix_group_memberships",
    )
    membership = models.CharField(max_length=16, choices=MembershipState.choices)
    display_name = models.CharField(max_length=255, blank=True)
    power_level = models.IntegerField(null=True, blank=True)
    role = models.CharField(
        max_length=16, choices=GroupMemberRole.choices, default=GroupMemberRole.MEMBER
    )
    invited_at = models.DateTimeField(null=True, blank=True)
    joined_at = models.DateTimeField(null=True, blank=True)
    left_at = models.DateTimeField(null=True, blank=True)
    last_event_id = models.CharField(max_length=255, blank=True)
    last_event_ts = models.BigIntegerField(null=True, blank=True)
    projection_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("room", "mxid"), name="matrix_group_membership_unique"
            )
        ]
        indexes = [
            models.Index(fields=("room", "membership")),
            models.Index(fields=("mxid", "membership")),
            models.Index(fields=("hub_user", "membership")),
            models.Index(fields=("room", "role", "membership")),
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
