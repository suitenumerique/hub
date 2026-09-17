"""Professional roles are optional display labels, owned by the signed-in user."""

from django.conf import settings

import pytest
import requests
import responses
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db

# A test taking a fixture shadows the fixture function by design: that is how
# pytest passes it in.
# pylint: disable=redefined-outer-name
PROFILE = "/api/v1.0/profile-role/"
LOOKUP = "/api/v1.0/user-roles/"


@pytest.fixture
def client_user():
    """A Hub session without a role or a linked Matrix identity."""
    user = factories.UserFactory()
    client = APIClient()
    client.force_login(user)
    return client, user


def whoami(user_id="@alice:localhost", status=200):
    """Matrix verifies possession of the active chat account."""
    responses.get(
        f"{settings.MATRIX_HOMESERVER_URL}/_matrix/client/v3/account/whoami",
        json={"user_id": user_id},
        status=status,
        match=[responses.matchers.header_matcher({"Authorization": "Bearer proof"})],
    )


def save(client, role, **extra):
    """Send the role and the current chat identity proof."""
    return client.patch(
        PROFILE, {"role": role, "matrix_access_token": "proof", **extra}, format="json"
    )


def test_roles_require_authentication():
    """Neither profiles nor labels are visible or editable anonymously."""
    assert APIClient().get(PROFILE).status_code == 401
    assert APIClient().get(LOOKUP).status_code == 401
    assert APIClient().patch(PROFILE, {"role": "DEV"}).status_code == 401


def test_empty_profile_does_not_trigger_discovery(client_user):
    """Reading a new profile performs no external requests and changes no data."""
    client, user = client_user
    assert client.get(PROFILE).json() == {"role": "", "matrix_id": None}
    user.refresh_from_db()
    assert user.professional_role == ""


@responses.activate
def test_save_change_remove_and_read_global_role(client_user):
    """One role survives reloads, is visible to others and can be removed."""
    client, user = client_user
    whoami()
    response = save(client, "  dev  ")
    assert response.status_code == 200
    assert response.json() == {"role": "DEV", "matrix_id": "@alice:localhost"}
    assert client.get(PROFILE).json()["role"] == "DEV"
    other = APIClient()
    other.force_login(factories.UserFactory())
    assert other.get(LOOKUP, {"id": "@alice:localhost"}).json() == {
        "@alice:localhost": "DEV"
    }
    assert save(client, "Responsable support").status_code == 200
    assert client.get(PROFILE).json()["role"] == "Responsable support"
    assert save(client, "").status_code == 200
    assert other.get(LOOKUP, {"id": "@alice:localhost"}).json() == {}
    user.refresh_from_db()
    assert user.matrix_id == "@alice:localhost"


@responses.activate
def test_role_is_not_a_permission_or_an_editable_user_id(client_user):
    """A professional label never modifies privileges or another Hub profile."""
    client, user = client_user
    other = factories.UserFactory(professional_role="PO")
    whoami()
    assert save(client, "admin", id=str(other.id), is_staff=True).status_code == 200
    user.refresh_from_db()
    other.refresh_from_db()
    assert not user.is_staff
    assert other.professional_role == "PO"


@pytest.mark.parametrize(
    "role", ["x" * 41, "DEV\nPM", "DEV\x00", "DEV\u202e", None, ["DEV"]]
)
def test_reject_invalid_labels(client_user, role):
    """Reject oversized or misleading labels before contacting Matrix."""
    client, user = client_user
    assert save(client, role).status_code == 400
    user.refresh_from_db()
    assert user.professional_role == ""


def test_identity_proof_is_required(client_user):
    """A browser-supplied Matrix id alone proves nothing."""
    client, _ = client_user
    response = client.patch(
        PROFILE, {"role": "DEV", "matrix_id": "@victim:localhost"}, format="json"
    )
    assert response.status_code == 400


@responses.activate
def test_invalid_proof_does_not_save(client_user):
    """A rejected token cannot claim a chat identity or change a role."""
    client, user = client_user
    whoami(status=401)
    assert save(client, "DEV").status_code == 400
    user.refresh_from_db()
    assert user.matrix_id is None
    assert user.professional_role == ""


@responses.activate
def test_cannot_claim_another_hub_profiles_matrix_identity(client_user):
    """A linked chat account cannot silently transfer to another Hub user."""
    client, _ = client_user
    other = factories.UserFactory(matrix_id="@alice:localhost", professional_role="PO")
    whoami()
    assert save(client, "DEV").status_code == 409
    other.refresh_from_db()
    assert other.professional_role == "PO"


@responses.activate
def test_cannot_silently_switch_linked_chat_account(client_user):
    """Keep the existing identity and label if the active account changes."""
    client, user = client_user
    user.matrix_id = "@bob:localhost"
    user.professional_role = "PM"
    user.save()
    whoami()
    assert save(client, "DEV").status_code == 409
    user.refresh_from_db()
    assert user.professional_role == "PM"


@responses.activate
def test_network_failure_preserves_role(client_user):
    """Report an unavailable chat service instead of pretending to save."""
    client, user = client_user
    responses.get(
        f"{settings.MATRIX_HOMESERVER_URL}/_matrix/client/v3/account/whoami",
        body=requests.Timeout(),
    )
    assert save(client, "DEV").status_code == 503
    user.refresh_from_db()
    assert user.professional_role == ""


def test_lookup_exposes_only_requested_active_labels(client_user):
    """Lookup is bounded and never returns emails or full profiles."""
    client, _ = client_user
    factories.UserFactory(matrix_id="@alice:localhost", professional_role="DEV")
    factories.UserFactory(
        matrix_id="@inactive:localhost", professional_role="PM", is_active=False
    )
    assert client.get(LOOKUP).json() == {}
    assert client.get(
        LOOKUP,
        {"id": ["@alice:localhost", "@inactive:localhost", "@missing:localhost"]},
    ).json() == {"@alice:localhost": "DEV"}
    assert (
        client.get(LOOKUP, {"id": [f"@u{i}:localhost" for i in range(51)]}).status_code
        == 400
    )


def test_regular_user_api_cannot_replace_the_identity_or_role(client_user):
    """The existing user endpoint cannot bypass the verified role endpoint."""
    client, user = client_user
    response = client.patch(
        f"/api/v1.0/users/{user.id}/",
        {"professional_role": "PO", "matrix_id": "@victim:localhost"},
        format="json",
    )
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.matrix_id is None
    assert user.professional_role == ""
