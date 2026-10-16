
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Group

from ..services import MatrixService
from .serializers import (
    GroupCreateSerializer,
    GroupSerializer,
    GroupPromotionSerializer,
)


class GroupViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Create, promote, list and inspect groups visible to the Hub user."""

    permission_classes = [IsAuthenticated]
    serializer_class = GroupSerializer

    def get_queryset(self):
        """Return user visible groups"""
        queryset = Group.objects.select_related("created_by").prefetch_related(
            "rooms",
        )
        queryset = queryset.filter(group_accesses__user=self.request.user).distinct()
        
        return queryset

    def create(self, request, backend_hrid=None, *args, **kwargs):
        """Create a new group using the Matrix backend."""
        serializer = GroupCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        service = MatrixService.from_homeserver_hrid(
            backend_hrid=backend_hrid,
            hrid=serializer.validated_data["matrix_account_id"],
            #hrid=serializer.validated_data["matrix_homeserver_hrid"],
        )

        group = service.create_room_for_group(
            user=request.user,
            user_access_token=serializer.validated_data["matrix_access_token"],
            name=serializer.validated_data["name"],
            invitees=serializer.validated_data["invitees"],
            allow_external_guests=serializer.validated_data[
                "allow_external_guests"
            ],
            is_encrypted=serializer.validated_data["is_encrypted"],
            emoji=serializer.validated_data.get("emoji"),
        )

        return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="promote")
    def promote(self, request, backend_hrid=None):
        """Create a group from an already existing Matrix room."""
        serializer = GroupPromotionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        service = MatrixService.from_homeserver_hrid(
            backend_hrid=backend_hrid,
            hrid=serializer.validated_data["matrix_account_id"],
            # hrid=serializer.validated_data["matrix_homeserver_hrid"],
        )
        
        group = service.promote_conversation(
            user=request.user,
            account_id=serializer.validated_data["matrix_account_id"],
            access_token=serializer.validated_data["matrix_access_token"],
            source_room_id=serializer.validated_data["source_room_id"],
            name=serializer.validated_data["name"],
            allow_external_guests=serializer.validated_data[
                "allow_external_guests"
            ],
            emoji=serializer.validated_data["emoji"],
        )

        return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)
