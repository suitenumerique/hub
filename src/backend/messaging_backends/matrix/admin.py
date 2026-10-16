"""Admin classes and registrations for the Matrix messaging backend app."""

from django.contrib import admin

from messaging_backends.matrix import models


@admin.register(models.MatrixUser)
class MatrixUserAdmin(admin.ModelAdmin):
    """Admin configuration for MatrixUser model."""

    list_display = ("id", "user", "homeserver_hrid", "mx_id", "created_at", "updated_at")
    search_fields = ("id", "mx_id", "homeserver_hrid", "user__email", "user__admin_email")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-updated_at",)
    raw_id_fields = ("user",)


@admin.register(models.MatrixRoom)
class MatrixRoomAdmin(admin.ModelAdmin):
    """Admin configuration for MatrixRoom model."""

    list_display = (
        "id",
        "room_id",
        "homeserver_hrid",
        "group",
        "state",
        "created_at",
        "updated_at",
    )
    list_filter = ("state", "homeserver_hrid")
    search_fields = ("id", "room_id", "homeserver_hrid", "group__name")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("state", "-updated_at")
    raw_id_fields = ("group",)


@admin.register(models.MatrixSyncState)
class MatrixSyncStateAdmin(admin.ModelAdmin):
    """Admin configuration for MatrixSyncState model."""

    list_display = ("id", "homeserver_hrid", "last_sync_token", "created_at", "updated_at")
    search_fields = ("id", "homeserver_hrid", "last_sync_token")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("homeserver_hrid",)


