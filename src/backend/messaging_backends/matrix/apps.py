"""Matrix Messaging Backend application"""

from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class MatrixMessagingBackendConfig(AppConfig):
    """Configuration class for the matrix messaging backend app."""

    name = "messaging_backends.matrix"
    verbose_name = _("Matrix Messaging Backend application")
