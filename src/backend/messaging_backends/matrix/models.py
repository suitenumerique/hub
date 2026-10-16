"""Matrix models used for data syncing."""

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from core.models import BaseModel, Group


class MatrixRoomState(models.TextChoices):
    """A room's state in the ordered Matrix history of a group."""

    PREDECESSOR = "predecessor", _("Predecessor")
    ACTIVE = "active", _("Active")
    SUCCESSOR_PENDING = "successor_pending", _("Successor pending")


class MatrixUser(BaseModel):
    """Model to store the mapping between a Hub user and their Matrix account."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="matrix_user",
    )
    homeserver_hrid = models.CharField(max_length=255)
    mx_id = models.CharField(max_length=255, unique=True)


class MatrixRoom(BaseModel):
    """Model to store the mapping between a Hub group and its Matrix room."""
    group = models.ForeignKey(Group, on_delete=models.PROTECT, related_name="rooms")
    room_id = models.CharField(max_length=255, unique=True)
    homeserver_hrid = models.CharField(max_length=255)
    state = models.CharField(max_length=32, choices=MatrixRoomState.choices)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("group",),
                condition=Q(state=MatrixRoomState.ACTIVE),
                name="matrix_group_one_active_room",
            ),
            models.UniqueConstraint(
                fields=("group",),
                condition=Q(state=MatrixRoomState.SUCCESSOR_PENDING),
                name="matrix_group_one_pending_room",
            ),
        ]
        indexes = [models.Index(fields=("group", "state"))]


class MatrixSyncState(BaseModel):
    """Model to store the last sync state for a Matrix homeserver."""

    homeserver_hrid = models.CharField(max_length=255, unique=True)
    last_sync_token = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name=_("Last sync token (aka `next_batch`)"),
    )
