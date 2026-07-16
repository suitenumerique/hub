"""Django application configuration for the Matrix bridge."""

from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class MatrixBridgeConfig(AppConfig):
    """Register the Matrix bridge application."""

    default_auto_field = "django.db.models.AutoField"
    name = "matrix_bridge"
    verbose_name = _("Matrix bridge")
