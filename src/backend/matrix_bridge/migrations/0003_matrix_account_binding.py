"""Create verified Hub-to-Matrix account bindings."""

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("matrix_bridge", "0002_group_matrix_room"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MatrixAccountBinding",
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
                ("account_id", models.CharField(max_length=128)),
                ("mxid", models.CharField(max_length=255)),
                ("homeserver", models.CharField(max_length=255)),
                (
                    "status",
                    models.CharField(
                        choices=[("active", "Active"), ("revoked", "Revoked")],
                        default="active",
                        max_length=16,
                    ),
                ),
                (
                    "verification_source",
                    models.CharField(default="matrix_whoami", max_length=64),
                ),
                ("verified_at", models.DateTimeField()),
                ("last_seen_at", models.DateTimeField()),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="matrix_account_bindings",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("user", "account_id"),
                        name="matrix_binding_user_account_unique",
                    ),
                    models.UniqueConstraint(
                        fields=("account_id", "mxid"),
                        name="matrix_binding_account_mxid_unique",
                    ),
                ]
            },
        )
    ]
