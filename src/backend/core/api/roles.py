"""Global professional labels, editable only by their owner."""

import unicodedata

from django.conf import settings
from django.core.exceptions import ValidationError as ModelValidationError
from django.db import IntegrityError, transaction
from django.views.decorators.debug import sensitive_variables

import requests
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import APIView

from core import models
from core.api.permissions import IsAuthenticated

# Nothing here is ever saved through a serializer; these only validate input
# and shape output.
# pylint: disable=abstract-method


class RoleSerializer(serializers.Serializer):
    """An empty role explicitly opts out of displaying a label."""

    role = serializers.CharField(max_length=40, allow_blank=True, trim_whitespace=False)
    matrix_access_token = serializers.CharField(
        max_length=16384, required=False, write_only=True, trim_whitespace=False
    )

    def validate_role(self, value):
        """Reject control characters and normalize known abbreviations."""
        if any(unicodedata.category(char).startswith("C") for char in value):
            raise serializers.ValidationError(
                "Use a single-line role without control characters."
            )
        value = " ".join(value.split())
        return value.upper() if value.casefold() in {"po", "pm", "dev", "qa"} else value


def profile_data(user):
    """Return only display metadata, never the proof used to link an identity."""
    return {
        "role": user.professional_role,
        "matrix_id": user.matrix_id,
    }


class RoleProfileSerializer(serializers.Serializer):
    """Public shape of the current user's role."""

    role = serializers.CharField(allow_blank=True)
    matrix_id = serializers.CharField(allow_null=True)


class ChatUnavailable(APIException):
    """The identity verifier could not be reached."""

    status_code = 503
    default_detail = "Chat is temporarily unavailable."


@sensitive_variables("token")
def verify_chat_identity(token):
    """Check a current token on the configured homeserver without storing it.

    The proof is a live credential, so it must not survive the request: it is
    never stored, never returned, and the decorator keeps it out of the
    technical 500 page, which prints every frame local verbatim under DEBUG.
    """
    if not token:
        raise serializers.ValidationError("Connect to chat before updating your role.")
    try:
        response = requests.get(
            f"{settings.MATRIX_HOMESERVER_URL.rstrip('/')}/_matrix/client/v3/account/whoami",
            headers={"Authorization": f"Bearer {token}"},
            timeout=4,
            allow_redirects=False,
        )
        if response.status_code != 200:
            raise serializers.ValidationError("Could not verify the chat account.")
        identity = response.json()
    except (requests.RequestException, ValueError) as error:
        raise ChatUnavailable from error
    matrix_id = identity.get("user_id") if isinstance(identity, dict) else None
    if (
        not isinstance(matrix_id, str)
        or not matrix_id.startswith("@")
        or ":" not in matrix_id
        or len(matrix_id) > 255
    ):
        raise serializers.ValidationError("Invalid chat identity.")
    return matrix_id


class RoleProfileView(APIView):
    """Read and edit the current person's optional role."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=RoleProfileSerializer)
    def get(self, request):
        """Retrieve own role without fetching or changing any external profile."""
        return Response(profile_data(request.user))

    @extend_schema(request=RoleSerializer, responses=RoleProfileSerializer)
    def patch(self, request):
        """Persist a choice for the authenticated user, never a client-supplied id."""
        serializer = RoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.validated_data["role"]
        matrix_id = verify_chat_identity(
            serializer.validated_data.get("matrix_access_token")
        )
        try:
            with transaction.atomic():
                user = models.User.objects.select_for_update().get(pk=request.user.pk)
                if user.matrix_id and user.matrix_id != matrix_id:
                    return Response(
                        {
                            "detail": "This profile is linked to a different chat account."
                        },
                        status=409,
                    )
                user.matrix_id = matrix_id
                user.professional_role = role
                user.save(update_fields=["matrix_id", "professional_role"])
        except (IntegrityError, ModelValidationError):
            return Response(
                {"detail": "This chat account already has a profile."}, status=409
            )
        return Response(profile_data(user))


class UserRolesView(APIView):
    """Resolve known Matrix ids to short labels, without exposing user profiles."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[OpenApiParameter("id", str, many=True)],
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request):
        """Return at most 50 requested labels; an unfiltered directory is disallowed."""
        ids = request.query_params.getlist("id")
        if len(ids) > 50 or any(len(value) > 255 for value in ids):
            return Response(
                {"detail": "Too many or invalid ids."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        roles = (
            models.User.objects.filter(is_active=True, matrix_id__in=ids)
            .exclude(professional_role="")
            .values_list("matrix_id", "professional_role")
        )
        return Response(dict(roles))
