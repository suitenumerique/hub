"""Tests for explicit synchronous Matrix reconciliation."""

from io import StringIO
from unittest.mock import patch

from django.core.management import call_command

import pytest

from matrix_bridge.tests.test_appservice import create_group_room, event

pytestmark = pytest.mark.django_db


@patch("matrix_bridge.reconciliation.MatrixClient.room_state")
def test_reconcile_command_applies_state_without_celery(room_state):
    group, room = create_group_room()
    room_state.return_value = [
        event(
            "m.room.name",
            room_id=None,
            content={"name": "Reconciled name"},
        )
    ]
    del room_state.return_value[0]["room_id"]
    stdout = StringIO()

    call_command("reconcile_matrix_groups", group_id=str(group.id), stdout=stdout)

    room.refresh_from_db()
    group.refresh_from_db()
    assert room.name == "Reconciled name"
    assert group.last_reconciled_at is not None
    assert f"Reconciled {group.id}" in stdout.getvalue()
