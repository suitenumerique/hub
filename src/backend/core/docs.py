"""Client for the Docs server-to-server API: creates documents for Hub users."""

import logging

from django.conf import settings

import requests

logger = logging.getLogger(__name__)


class DocsError(Exception):
    """Docs could not create the document."""


def is_docs_configured():
    """Whether the Hub holds the Docs server-to-server credentials."""
    return bool(settings.DOCS_BASE_URL and settings.DOCS_SERVER_TO_SERVER_API_TOKEN)


def document_url(document_id):
    """The address of a Docs document, as its owner opens it."""
    return f"{settings.DOCS_BASE_URL.rstrip('/')}/docs/{document_id}/"


def create_document_for_owner(*, title, content, user):
    """
    Create a Docs document owned by this Hub user, from markdown.

    Docs and the Hub share their identity provider: Docs finds the owner by
    `sub`, or invites the email when the user never logged in to Docs. Returns
    the id of the new document.
    """
    payload = {
        "title": title,
        "content": content,
        "sub": user.sub,
        "email": user.email,
        # The Hub already shows the document in the meeting history.
        "send_notification_email": False,
    }
    # Docs refuses an empty language: it then falls back to its own default.
    if user.language:
        payload["language"] = user.language

    try:
        response = requests.post(
            f"{settings.DOCS_BASE_URL.rstrip('/')}/api/v1.0/documents/create-for-owner/",
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.DOCS_SERVER_TO_SERVER_API_TOKEN}"
            },
            timeout=settings.DOCS_API_TIMEOUT,
        )
        response.raise_for_status()
        return str(response.json()["id"])
    except (requests.RequestException, KeyError, ValueError) as error:
        logger.warning("Docs document creation failed: %s", error)
        raise DocsError from error
