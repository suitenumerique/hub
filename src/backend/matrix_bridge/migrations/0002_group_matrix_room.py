"""Create Matrix rooms and link the active room back to its group."""

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("matrix_bridge", "0001_group")]

    operations = [
        migrations.CreateModel(
            name="GroupMatrixRoom",
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
                ("room_id", models.CharField(max_length=255, unique=True)),
                ("control_homeserver", models.CharField(max_length=128)),
                ("room_version", models.CharField(blank=True, max_length=32)),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("active", "Active"),
                            ("predecessor", "Predecessor"),
                            ("successor_pending", "Successor pending"),
                            ("abandoned", "Abandoned"),
                        ],
                        max_length=32,
                    ),
                ),
                ("sequence", models.PositiveIntegerField(default=0)),
                (
                    "predecessor_room_id",
                    models.CharField(blank=True, max_length=255, null=True),
                ),
                (
                    "successor_room_id",
                    models.CharField(blank=True, max_length=255, null=True),
                ),
                (
                    "tombstone_event_id",
                    models.CharField(blank=True, max_length=255, null=True),
                ),
                (
                    "create_event_id",
                    models.CharField(blank=True, max_length=255, null=True),
                ),
                ("is_hardened", models.BooleanField(default=False)),
                (
                    "marker_mode",
                    models.CharField(default="type_and_state", max_length=32),
                ),
                (
                    "metadata_schema_version",
                    models.PositiveIntegerField(blank=True, null=True),
                ),
                ("metadata_group_id", models.UUIDField(blank=True, null=True)),
                ("name", models.CharField(blank=True, max_length=255)),
                ("topic", models.TextField(blank=True)),
                ("avatar_mxc", models.CharField(blank=True, max_length=255)),
                ("is_encrypted", models.BooleanField(default=False)),
                ("join_rule", models.CharField(blank=True, max_length=32)),
                ("history_visibility", models.CharField(blank=True, max_length=32)),
                ("activated_at", models.DateTimeField(blank=True, null=True)),
                ("retired_at", models.DateTimeField(blank=True, null=True)),
                ("last_state_event_at", models.DateTimeField(blank=True, null=True)),
                (
                    "group",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="rooms",
                        to="matrix_bridge.group",
                    ),
                ),
            ],
            options={
                "ordering": ("sequence", "created_at"),
                "indexes": [
                    models.Index(
                        fields=["group", "role"],
                        name="matrix_brid_group_i_6e7938_idx",
                    )
                ],
                "constraints": [
                    models.UniqueConstraint(
                        condition=models.Q(("role", "active")),
                        fields=("group", "role"),
                        name="matrix_group_one_active_room",
                    ),
                    models.UniqueConstraint(
                        fields=("group", "sequence"),
                        name="matrix_group_room_sequence_unique",
                    ),
                ],
            },
        ),
        # This relation is added after GroupMatrixRoom to resolve the circular
        # Group -> active room -> Group dependency.
        migrations.AddField(
            model_name="group",
            name="active_room",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="active_for_groups",
                to="matrix_bridge.groupmatrixroom",
            ),
        ),
    ]
