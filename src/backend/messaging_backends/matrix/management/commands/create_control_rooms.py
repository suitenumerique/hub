"""Long-running Matrix /sync worker for one configured homeserver.

Each worker pod targets a single homeserver, selected by its ``hrid`` (the
stable identifier stored in ``settings.MESSAGING_BACKEND_CONFIG``). One worker
must be launched per Matrix homeserver entry and is meant to run
in a dedicated pod, much like a Celery worker.

Example:
    python manage.py create_control_rooms --hrid local-matrix
"""

from django.conf import settings
from django.core.management.base import BaseCommand

from hub.configuration import MessagingBackendKind
from messaging_backends.matrix.services import ProvisioningService


class Command(BaseCommand):
    """
    We need a control room which is used as base room to allow the Hub bot to automatically 
    join new rooms. This command checks if the control room is present for all configured 
    Matrix homeservers and creates it if it is missing.
    """

    help = "Check the presence of control rooms for all configured Matrix homeservers."

    def add_arguments(self, parser):
        """Select the homeserver this worker is responsible for."""
        parser.add_argument(
            "--hrid",
            required=False,
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

        for homeserver_config in self._iter_matrix_homeservers():
            if hrid is not None and homeserver_config.hrid != hrid:
                continue

            service = ProvisioningService(homeserver_config)

            self.stdout.write(f"Checking bot user for homeserver {homeserver_config.hrid}...")
            bot_user_mx_id, bot_user_created = service.provision_hub_bot_user()
            if bot_user_created:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Bot user {homeserver_config.bot_mxid} created for homeserver {homeserver_config.hrid}."
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Bot user {homeserver_config.bot_mxid} already exists for homeserver {homeserver_config.hrid}."
                    )
                )

            self.stdout.write(f"Checking control room for homeserver {homeserver_config.hrid}...")
            room_id, created = service.get_or_create_control_room()

            if not created:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Control room {room_id} ({homeserver_config.control_room_alias}) already exists for homeserver {homeserver_config.hrid}."
                    )
                )
                continue
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Control room {room_id} ({homeserver_config.control_room_alias}) created for homeserver {homeserver_config.hrid}."
                    )
                )

            
