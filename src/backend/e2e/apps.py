"""App configuration for the e2e Django app."""

from django.apps import AppConfig


class E2eConfig(AppConfig):
    """Configuration for the e2e app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "e2e"
