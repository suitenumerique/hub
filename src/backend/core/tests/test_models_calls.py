"""
Unit tests for the Call model
"""

import threading
import time
from unittest import mock
from uuid import uuid4

from django.db import connection

import pytest

from core import factories, models
from core.services.meet import MeetClient


@pytest.mark.django_db(transaction=True)
def test_models_calls_start_concurrent_first_calls():
    """
    Two users starting the first call of a conversation at the same time should
    end up in the same call, held in a single Visio room.
    """
    users = factories.UserFactory.create_batch(2)
    results = []

    def create_room(_email):
        # Leave the other request enough time to reach Visio as well.
        time.sleep(0.3)
        return {"id": str(uuid4()), "url": "https://visio.test/abc-defg-hij"}

    def start(user):
        try:
            results.append(models.Call.objects.start("!abcdef:matrix.test", user))
        finally:
            connection.close()

    with mock.patch.object(
        MeetClient, "create_room", side_effect=create_room
    ) as mock_create_room:
        threads = [threading.Thread(target=start, args=(user,)) for user in users]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

    assert mock_create_room.call_count == 1
    assert models.MeetRoom.objects.count() == 1
    assert models.Call.objects.count() == 1
    assert len(results) == 2
    assert {call.id for call, _created in results} == {models.Call.objects.get().id}
    assert sorted(created for _call, created in results) == [False, True]
