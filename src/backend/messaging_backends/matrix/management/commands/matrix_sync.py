"""Long-running Matrix /sync worker for one configured homeserver.

Each worker pod targets a single homeserver, selected by its ``hrid`` (the
stable identifier stored in ``settings.MESSAGING_BACKEND_CONFIG``). One worker
must be launched per Matrix homeserver entry and is meant to run
in a dedicated pod, much like a Celery worker.

Example:
    python manage.py matrix_sync --hrid local-matrix
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from hub.configuration import MessagingBackendKind
from messaging_backends.matrix.sync import run_sync_loop


class Command(BaseCommand):
    """Continuously call the Matrix /sync endpoint for one homeserver."""

    help = "Run the long-polling Matrix /sync worker for one homeserver (by hrid)."

    def add_arguments(self, parser):
        """Select the homeserver this worker is responsible for."""
        parser.add_argument(
            "--hrid",
            required=True,
            help="Human-readable identifier (hrid) of the homeserver to sync, "
            "as present in settings.MESSAGING_BACKEND_CONFIG[*].mx_homeserver.",
        )

    @staticmethod
    def _iter_matrix_homeservers():
        """Yield every configured Matrix homeserver from MESSAGING_BACKEND_CONFIG."""
        for backend in settings.MESSAGING_BACKEND_CONFIG:
            if backend.kind != MessagingBackendKind.MATRIX:
                continue
            yield from backend.mx_homeserver

    def handle(self, *args, **options):
        """Resolve the homeserver configuration and block on the sync loop."""
        hrid = options["hrid"]
        homeserver_config = next(
            (
                config
                for config in self._iter_matrix_homeservers()
                if config.hrid == hrid
            ),
            None,
        )
        if homeserver_config is None:
            raise CommandError(
                f"No Matrix homeserver configured with hrid {hrid!r} in "
                "settings.MESSAGING_BACKEND_CONFIG[*].mx_homeserver."
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Starting Matrix /sync worker for homeserver {hrid!r} "
                f"({homeserver_config.url})."
            )
        )
        run_sync_loop(homeserver_config)
