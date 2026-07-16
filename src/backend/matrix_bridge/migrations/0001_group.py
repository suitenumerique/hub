"""Create the stable Hub group identity."""

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name="Group",
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
                ("name", models.CharField(max_length=255)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("provisioning", "Provisioning"),
                            ("awaiting_join", "Awaiting join"),
                            ("active", "Active"),
                            ("migration_pending", "Migration pending"),
                            ("failed", "Failed"),
                        ],
                        default="provisioning",
                        max_length=32,
                    ),
                ),
                ("created_by_matrix_id", models.CharField(max_length=255)),
                ("matrix_account_id", models.CharField(max_length=128)),
                ("idempotency_key", models.CharField(max_length=255)),
                ("ministry", models.CharField(blank=True, max_length=255)),
                ("tags", models.JSONField(blank=True, default=list)),
                ("visibility", models.CharField(default="private", max_length=32)),
                ("emoji", models.CharField(default="🌲", max_length=16)),
                ("allow_external_guests", models.BooleanField(default=False)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_matrix_groups",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["status", "created_at"],
                        name="matrix_brid_status_13238d_idx",
                    )
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("created_by", "idempotency_key"),
                        name="matrix_group_creator_idempotency_unique",
                    )
                ],
            },
        )
    ]
