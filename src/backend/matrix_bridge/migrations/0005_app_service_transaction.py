"""Create successful Matrix Application Service transaction markers."""

import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("matrix_bridge", "0004_group_member")]

    operations = [
        migrations.CreateModel(
            name="AppServiceTransaction",
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
                ("source_registration", models.CharField(max_length=128)),
                ("txn_id", models.TextField()),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("source_registration", "txn_id"),
                        name="matrix_appservice_transaction_unique",
                    )
                ]
            },
        )
    ]
