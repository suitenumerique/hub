"""
Test meetings API endpoints in the Hub core app.
"""

import json

from django.test import override_settings

import pytest
import responses
from rest_framework.status import (
    HTTP_201_CREATED,
    HTTP_401_UNAUTHORIZED,
    HTTP_502_BAD_GATEWAY,
    HTTP_503_SERVICE_UNAVAILABLE,
)
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db

MEET_API_URL = "https://meet.test/external-api/v1.0"
TOKEN_URL = f"{MEET_API_URL}/application/token/"
ROOMS_URL = f"{MEET_API_URL}/rooms/"

MEET_SETTINGS = {
    "MEET_API_URL": MEET_API_URL,
    "MEET_APPLICATION_CLIENT_ID": "hub-client-id",
    "MEET_APPLICATION_CLIENT_SECRET": "hub-client-secret",
}


def _logged_in_client(email="jane@example.com"):
    client = APIClient()
    client.force_login(factories.UserFactory(email=email))
    return client


@override_settings(**MEET_SETTINGS)
def test_api_meetings_create_anonymous():
    """Anonymous users should not be allowed to create a meeting."""
    response = APIClient().post("/api/v1.0/meetings/")

    assert response.status_code == HTTP_401_UNAUTHORIZED


@override_settings(
    MEET_API_URL=None,
    MEET_APPLICATION_CLIENT_ID=None,
    MEET_APPLICATION_CLIENT_SECRET=None,
)
@responses.activate
def test_api_meetings_create_not_configured():
    """Without Meet credentials, the endpoint should say the service is unavailable."""
    response = _logged_in_client().post("/api/v1.0/meetings/")

    assert response.status_code == HTTP_503_SERVICE_UNAVAILABLE
    assert len(responses.calls) == 0


@override_settings(**MEET_SETTINGS)
@responses.activate
def test_api_meetings_create_success():
    """A room should be created in Meet on behalf of the authenticated user."""
    responses.post(TOKEN_URL, json={"access_token": "meet-token", "expires_in": 3600})
    responses.post(
        ROOMS_URL,
        status=201,
        json={
            "id": "5d8f2c1e-7b1a-4b4e-9a53-1f0e8c7d6b5a",
            "slug": "abc-defg-hij",
            "url": "https://meet.test/abc-defg-hij",
            "access_level": "trusted",
        },
    )

    response = _logged_in_client("jane@example.com").post("/api/v1.0/meetings/")

    assert response.status_code == HTTP_201_CREATED
    assert response.json() == {
        "url": "https://meet.test/abc-defg-hij",
        "slug": "abc-defg-hij",
    }

    assert len(responses.calls) == 2
    assert json.loads(responses.calls[0].request.body) == {
        "client_id": "hub-client-id",
        "client_secret": "hub-client-secret",
        "grant_type": "client_credentials",
        "scope": "jane@example.com",
    }
    assert responses.calls[1].request.headers["Authorization"] == "Bearer meet-token"
    assert json.loads(responses.calls[1].request.body) == {"access_level": "public"}


@override_settings(**MEET_SETTINGS)
@responses.activate
def test_api_meetings_create_token_refused():
    """A refused application token should not leak Meet's answer to the client."""
    responses.post(TOKEN_URL, status=403, json={"detail": "Email domain not allowed"})

    response = _logged_in_client().post("/api/v1.0/meetings/")

    assert response.status_code == HTTP_502_BAD_GATEWAY
    assert response.json() == {"detail": "Meet could not create the room."}
    assert len(responses.calls) == 1


@override_settings(**MEET_SETTINGS)
@responses.activate
def test_api_meetings_create_room_failed():
    """A failing room creation should be reported as a gateway error."""
    responses.post(TOKEN_URL, json={"access_token": "meet-token"})
    responses.post(ROOMS_URL, status=500)

    response = _logged_in_client().post("/api/v1.0/meetings/")

    assert response.status_code == HTTP_502_BAD_GATEWAY


@override_settings(**MEET_SETTINGS)
@responses.activate
def test_api_meetings_create_unexpected_answer():
    """An answer without the room url should be reported as a gateway error."""
    responses.post(TOKEN_URL, json={"access_token": "meet-token"})
    responses.post(ROOMS_URL, status=201, json={"id": "only-an-id"})

    response = _logged_in_client().post("/api/v1.0/meetings/")

    assert response.status_code == HTTP_502_BAD_GATEWAY
