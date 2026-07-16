"""Reconcile one or all eligible Matrix groups on demand."""

from django.core.management.base import BaseCommand, CommandError

from matrix_bridge.models import Group
from matrix_bridge.reconciliation import (
    reconcile_matrix_group,
    reconciliable_group_ids,
)


class Command(BaseCommand):
    """Run the network-backed reconciliation workflow explicitly."""

    help = "Reconcile one Matrix group, or every eligible group when omitted."

    def add_arguments(self, parser):
        """Allow reconciliation to target one group UUID."""
        parser.add_argument(
            "--group",
            dest="group_id",
            help="UUID of the single group to reconcile.",
        )

    def handle(self, *args, **options):
        """Reconcile eligible groups and report every failure at the end."""
        group_id = options["group_id"]
        if group_id:
            if not Group.objects.filter(id=group_id).exists():
                raise CommandError(f"Unknown Matrix group: {group_id}")
            group_ids = [group_id]
        else:
            group_ids = list(reconciliable_group_ids())

        failures = []
        reconciled = 0
        skipped = 0
        for current_group_id in group_ids:
            try:
                changed = reconcile_matrix_group(current_group_id)
            except Exception as error:  # noqa: BLE001  # pylint: disable=broad-exception-caught
                failures.append((current_group_id, error.__class__.__name__))
                self.stderr.write(
                    self.style.ERROR(
                        f"Failed {current_group_id}: {error.__class__.__name__}"
                    )
                )
            else:
                if changed:
                    reconciled += 1
                    self.stdout.write(
                        self.style.SUCCESS(f"Reconciled {current_group_id}")
                    )
                else:
                    skipped += 1
                    self.stdout.write(f"Skipped {current_group_id}")

        if failures:
            raise CommandError(
                f"{len(failures)} Matrix group reconciliation(s) failed."
            )
        self.stdout.write(
            self.style.SUCCESS(
                f"Matrix reconciliation complete: {reconciled} reconciled, "
                f"{skipped} skipped."
            )
        )
