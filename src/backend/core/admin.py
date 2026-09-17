"""Admin classes and registrations for core app."""

from django.contrib import admin
from django.contrib.auth import admin as auth_admin
from django.utils.translation import gettext_lazy as _

from core import models


@admin.register(models.User)
class UserAdmin(auth_admin.UserAdmin):
    """Admin class for the User model"""

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "admin_email",
                    "password",
                )
            },
        ),
        (
            _("Personal info"),
            {
                "fields": (
                    "sub",
                    "email",
                    "full_name",
                    "short_name",
                    "language",
                    "timezone",
                )
            },
        ),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_device",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (_("Important dates"), {"fields": ("created_at", "updated_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2"),
            },
        ),
    )
    list_display = (
        "id",
        "sub",
        "full_name",
        "admin_email",
        "email",
        "is_active",
        "is_staff",
        "is_superuser",
        "is_device",
        "created_at",
        "updated_at",
    )
    list_filter = ("is_staff", "is_superuser", "is_device", "is_active")
    ordering = (
        "is_active",
        "-is_superuser",
        "-is_staff",
        "-is_device",
        "-updated_at",
        "full_name",
    )
    readonly_fields = (
        "id",
        "sub",
        "email",
        "full_name",
        "short_name",
        "created_at",
        "updated_at",
    )
    search_fields = ("id", "sub", "admin_email", "email", "full_name")


class MeetingParticipantInline(admin.TabularInline):
    """Who was seen in the call, read-only."""

    model = models.MeetingParticipant
    extra = 0
    fields = ("name", "identity", "first_seen_at", "last_seen_at")
    readonly_fields = fields
    can_delete = False


class MeetingTranscriptSegmentInline(admin.TabularInline):
    """The sentences relayed for a meeting, read-only."""

    model = models.MeetingTranscriptSegment
    extra = 0
    fields = ("spoken_at", "speaker_name", "text")
    readonly_fields = fields
    can_delete = False


@admin.register(models.Meeting)
class MeetingAdmin(admin.ModelAdmin):
    """Admin class for the meetings created from the Hub."""

    list_display = ("slug", "title", "organizer", "created_at", "closed_at")
    list_filter = ("auto_closed",)
    search_fields = ("slug", "livekit_room", "organizer__email")
    readonly_fields = ("id", "slug", "livekit_room", "created_at", "updated_at")
    inlines = [MeetingParticipantInline, MeetingTranscriptSegmentInline]
