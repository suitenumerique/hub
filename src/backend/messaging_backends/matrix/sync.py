"""Long-polling /sync loop against the configured Matrix homeservers.

Each Matrix homeserver gets a dedicated Django worker pod that continuously
calls the Client-Server ``/sync`` endpoint (see ``MESSAGING_BACKEND_CONFIG``)
so the Hub stays aware of every room it shares with the homeserver (room state
events such as ``m.room.create``, ``m.room.tombstone``, ``m.room.member``, ...).
The worker only tails events here; the actual business logic lives in callers.
"""

import json
import logging
import signal
import threading

import requests

from messaging_backends.matrix.services import MatrixService

logger = logging.getLogger(__name__)

class SyncError(Exception):
    """A classified failure while talking to the Matrix homeserver."""


def sync_next_batch(homeserver_config, since=None):
    """Fetch the next sync batch for one homeserver and return the ``next_batch`` token.
    """

    service = MatrixService(homeserver_config)
    return service.sync(since=since)


def _install_shutdown_signal(stop_event):
    """Hook SIGINT/SIGTERM so they set ``stop_event`` instead of killing the process."""

    def _handler(signum, _frame):
        logger.info("Received signal %s, stopping Matrix /sync worker.", signum)
        stop_event.set()

    signal.signal(signal.SIGINT, _handler)
    signal.signal(signal.SIGTERM, _handler)


def run_sync_loop(homeserver_config, stop_event=None):
    """Run the blocking long-poll /sync loop for one homeserver."""
    stopping = stop_event if stop_event is not None else threading.Event()
    if stop_event is None:
        _install_shutdown_signal(stopping)

    service = MatrixService(homeserver_config)

    while not stopping.is_set():
        try:
            service.sync()
        except SyncError as error:
            logger.warning("%s. Retrying in %ss.", error, homeserver_config.timeout)
            stopping.wait(homeserver_config.timeout)
            continue
        logger.info(
            "Successfully synced with homeserver %s", homeserver_config.hrid
        )
