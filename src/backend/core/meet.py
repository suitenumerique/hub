"""Client for the Meet external API: creates rooms on behalf of Hub users."""

import logging

from django.conf import settings

import requests

logger = logging.getLogger(__name__)


class MeetError(Exception):
    """Meet could not create the room."""


def is_meet_configured():
    """Whether the Hub holds the Meet application credentials."""
    return bool(
        settings.MEET_API_URL
        and settings.MEET_APPLICATION_CLIENT_ID
        and settings.MEET_APPLICATION_CLIENT_SECRET
    )


def create_room(email):
    """
    Create a Meet room owned by the user with this email.

    Meet issues an application token scoped to that user, then the room is
    created with it. Returns the room's `url` and `slug`.
    """
    base_url = settings.MEET_API_URL.rstrip("/")
    timeout = settings.MEET_API_TIMEOUT

    try:
        token_response = requests.post(
            f"{base_url}/application/token/",
            json={
                "client_id": settings.MEET_APPLICATION_CLIENT_ID,
                "client_secret": settings.MEET_APPLICATION_CLIENT_SECRET,
                "grant_type": "client_credentials",
                "scope": email,
            },
            timeout=timeout,
        )
        token_response.raise_for_status()
        access_token = token_response.json()["access_token"]

        room_response = requests.post(
            f"{base_url}/rooms/",
            json={"access_level": settings.MEET_ROOM_ACCESS_LEVEL},
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=timeout,
        )
        room_response.raise_for_status()
        room = room_response.json()
        return {"url": room["url"], "slug": room["slug"]}
    except (requests.RequestException, KeyError, ValueError) as error:
        logger.warning("Meet room creation failed: %s", error)
        raise MeetError from error
