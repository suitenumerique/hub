"""Client for the Visio (Meet) external API and verification of its webhooks."""

import base64
import hashlib
import hmac
import time
from logging import getLogger

from django.conf import settings

import requests

logger = getLogger(__name__)


class MeetError(Exception):
    """Raised when Visio cannot be reached or rejects a request."""


class MeetWebhookSignatureError(Exception):
    """Raised when a webhook cannot be trusted to come from Visio."""


class MeetClient:
    """Create Visio rooms on behalf of a Hub user."""

    def _post(self, path, **kwargs):
        """POST to the external API and return the decoded JSON body."""
        url = f"{settings.MEET_API_URL.rstrip('/')}/{path}"
        try:
            response = requests.post(url, timeout=settings.MEET_API_TIMEOUT, **kwargs)
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as err:
            logger.error("Visio request to %s failed: %s", url, err)
            raise MeetError(f"Visio request to {path} failed") from err

    def _get_token(self, email):
        """Exchange the application credentials for a token delegated to `email`."""
        data = self._post(
            "application/token/",
            json={
                "client_id": settings.MEET_APPLICATION_CLIENT_ID,
                "client_secret": settings.MEET_APPLICATION_CLIENT_SECRET,
                "grant_type": "client_credentials",
                "scope": email,
            },
        )
        try:
            return data["access_token"]
        except (KeyError, TypeError) as err:
            raise MeetError("Visio returned no access token") from err

    def create_room(self, email):
        """Create a room owned by the user identified by `email`."""
        token = self._get_token(email)
        data = self._post(
            "rooms/",
            json={"access_level": settings.MEET_ROOM_ACCESS_LEVEL},
            headers={"Authorization": f"Bearer {token}"},
        )
        try:
            return {"id": data["id"], "url": data["url"]}
        except (KeyError, TypeError) as err:
            raise MeetError("Visio returned an incomplete room") from err


def sign_webhook(secret, webhook_id, timestamp, body):
    """Compute the signature expected in the `webhook-signature` header."""
    signed_content = f"{webhook_id}.{timestamp}.".encode() + body
    digest = hmac.new(secret.encode(), signed_content, hashlib.sha256).digest()
    return f"v1,{base64.b64encode(digest).decode()}"


def verify_webhook(headers, body):
    """
    Check that a webhook was signed by Visio with the shared secret.

    The scheme follows the Standard Webhooks specification: an HMAC-SHA256 of
    "{id}.{timestamp}.{body}", sent with the id and timestamp it covers.
    """
    secret = settings.MEET_WEBHOOK_SECRET
    if not secret:
        raise MeetWebhookSignatureError("No webhook secret is configured")

    webhook_id = headers.get("webhook-id")
    timestamp = headers.get("webhook-timestamp")
    signatures = headers.get("webhook-signature")
    if not (webhook_id and timestamp and signatures):
        raise MeetWebhookSignatureError("Missing signature headers")

    try:
        age = abs(time.time() - int(timestamp))
    except ValueError as err:
        raise MeetWebhookSignatureError("Invalid timestamp") from err
    if age > settings.MEET_WEBHOOK_TOLERANCE:
        raise MeetWebhookSignatureError("Timestamp outside of the tolerance")

    expected = sign_webhook(secret, webhook_id, timestamp, body)
    # Several space-separated signatures may be sent while a secret is rotated.
    if not any(
        hmac.compare_digest(expected, signature) for signature in signatures.split()
    ):
        raise MeetWebhookSignatureError("Signature mismatch")
