"""Create the ordered Matrix room history for Hub groups."""

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("matrix_bridge", "0001_group")]

    operations = [
        migrations.CreateModel(
            name="GroupRoom",
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
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("predecessor", "Predecessor"),
                            ("active", "Active"),
                            ("successor_pending", "Successor pending"),
                        ],
                        max_length=32,
                    ),
                ),
                ("sequence", models.PositiveIntegerField(default=0)),
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
                        name="matrix_brid_group_i_04ce01_idx",
                    )
                ],
                "constraints": [
                    models.UniqueConstraint(
                        condition=models.Q(("role", "active")),
                        fields=("group",),
                        name="matrix_group_one_active_room",
                    ),
                    models.UniqueConstraint(
                        condition=models.Q(("role", "successor_pending")),
                        fields=("group",),
                        name="matrix_group_one_pending_room",
                    ),
                    models.UniqueConstraint(
                        fields=("group", "sequence"),
                        name="matrix_group_room_sequence_unique",
                    ),
                ],
            },
        )
    ]
