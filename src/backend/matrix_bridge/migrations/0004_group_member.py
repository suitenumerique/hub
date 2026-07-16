"""Create the current joined-member projection for Hub groups."""

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
            name="GroupMember",
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
                ("display_name", models.CharField(blank=True, max_length=255)),
                ("power_level", models.IntegerField(default=0)),
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
                (
                    "group",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="members",
                        to="matrix_bridge.group",
                    ),
                ),
                (
                    "hub_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="matrix_group_members",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ("display_name", "mxid"),
                "indexes": [
                    models.Index(fields=["mxid"], name="matrix_brid_mxid_5d6a96_idx"),
                    models.Index(
                        fields=["group", "role"],
                        name="matrix_brid_group_i_bdd05c_idx",
                    ),
                    models.Index(
                        fields=["hub_user"], name="matrix_brid_hub_use_b1cbd1_idx"
                    ),
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("group", "mxid"), name="matrix_group_member_unique"
                    )
                ],
            },
        )
    ]
