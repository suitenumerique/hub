"""Create the current Matrix membership projection for group rooms."""

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("matrix_bridge", "0003_matrix_account_binding"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="GroupMembership",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        help_text="primary key for the record as UUID",
                        primary_key=True,
                        serialize=False,
                        verbose_name="id",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True,
                        help_text="date and time at which a record was created",
                        verbose_name="created on",
                    ),
                ),
                (
                    "updated_at",
                    models.DateTimeField(
                        auto_now=True,
                        help_text="date and time at which a record was last updated",
                        verbose_name="updated on",
                    ),
                ),
                ("mxid", models.CharField(max_length=255)),
                (
                    "membership",
                    models.CharField(
                        choices=[
                            ("invite", "Invite"),
                            ("join", "Join"),
                            ("leave", "Leave"),
                            ("ban", "Ban"),
                            ("knock", "Knock"),
                        ],
                        max_length=16,
                    ),
                ),
                ("display_name", models.CharField(blank=True, max_length=255)),
                ("power_level", models.IntegerField(blank=True, null=True)),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("bot", "Bot"),
                            ("owner", "Owner"),
                            ("moderator", "Moderator"),
                            ("member", "Member"),
                        ],
                        default="member",
                        max_length=16,
                    ),
                ),
                ("invited_at", models.DateTimeField(blank=True, null=True)),
                ("joined_at", models.DateTimeField(blank=True, null=True)),
                ("left_at", models.DateTimeField(blank=True, null=True)),
                ("last_event_id", models.CharField(blank=True, max_length=255)),
                ("last_event_ts", models.BigIntegerField(blank=True, null=True)),
                ("projection_updated_at", models.DateTimeField(auto_now=True)),
                (
                    "hub_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="matrix_group_memberships",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "room",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="memberships",
                        to="matrix_bridge.groupmatrixroom",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["room", "membership"],
                        name="matrix_brid_room_id_552903_idx",
                    ),
                    models.Index(
                        fields=["mxid", "membership"],
                        name="matrix_brid_mxid_656c0a_idx",
                    ),
                    models.Index(
                        fields=["hub_user", "membership"],
                        name="matrix_brid_hub_use_15a599_idx",
                    ),
                    models.Index(
                        fields=["room", "role", "membership"],
                        name="matrix_brid_room_id_572202_idx",
                    ),
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("room", "mxid"),
                        name="matrix_group_membership_unique",
                    )
                ],
            },
        )
    ]
