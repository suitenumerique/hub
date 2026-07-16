"""Authenticated Hub group API."""

from django.db.models import Count, Q

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from matrix_bridge.client import MatrixBridgeError
from matrix_bridge.models import Group, GroupStatus, MembershipState
from matrix_bridge.services import (
    create_group,
    promote_conversation,
    verify_matrix_actor,
)

from .serializers import (
    GroupCreateSerializer,
    GroupPromotionSerializer,
    GroupResolveSerializer,
    GroupSerializer,
    MatrixBindingSerializer,
)


class GroupViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Create, promote, list and inspect groups visible to the Hub user."""

    permission_classes = [IsAuthenticated]
    serializer_class = GroupSerializer

    def get_queryset(self):
        """Return visible groups with the requested filters and ordering."""
        bindings = self.request.user.matrix_account_bindings.filter(status="active")
        mxids = bindings.values_list("mxid", flat=True)
        queryset = (
            Group.objects.select_related("active_room", "created_by")
            .prefetch_related("rooms", "active_room__memberships")
            .filter(
                Q(created_by=self.request.user)
                | Q(
                    active_room__memberships__mxid__in=mxids,
                    active_room__memberships__membership=MembershipState.JOIN,
                )
            )
            .distinct()
        )
        if value := self.request.query_params.get("status"):
            queryset = queryset.filter(status=value)
        else:
            queryset = queryset.exclude(
                status__in=(GroupStatus.DELETED, GroupStatus.FAILED)
            )
        if value := self.request.query_params.get("room_ids"):
            room_ids = [room_id for room_id in value.split(",") if room_id]
            queryset = queryset.filter(rooms__room_id__in=room_ids)
        if value := self.request.query_params.get("ministry"):
            queryset = queryset.filter(ministry=value)
        if value := self.request.query_params.get("tag"):
            queryset = queryset.filter(tags__contains=[value])
        if value := self.request.query_params.get("role"):
            queryset = queryset.filter(
                active_room__memberships__mxid__in=mxids,
                active_room__memberships__membership=MembershipState.JOIN,
                active_room__memberships__role=value,
            )
        ordering = self.request.query_params.get("ordering", "-created_at")
        if ordering.lstrip("-") == "member_count":
            queryset = queryset.annotate(
                member_count=Count(
                    "active_room__memberships",
                    filter=Q(active_room__memberships__membership=MembershipState.JOIN)
                    & ~Q(active_room__memberships__role="bot"),
                )
            ).order_by(ordering)
        elif ordering.lstrip("-") == "name":
            queryset = queryset.order_by(
                f"{ordering[0] if ordering.startswith('-') else ''}active_room__name"
            )
        else:
            queryset = queryset.order_by(
                ordering if ordering in {"created_at", "-created_at"} else "-created_at"
            )
        return queryset

    def _matrix_error(self, error: MatrixBridgeError) -> Response:
        """Convert a classified Matrix failure into the public API shape."""
        payload = {"code": error.errcode, "detail": str(error)}
        if error.retry_after_ms is not None:
            payload["retry_after_ms"] = error.retry_after_ms
        return Response(payload, status=error.status_code)

    def create(self, request):
        """Provision a hardened group with replay-safe business idempotence."""
        serializer = GroupCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        idempotency_key = request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return Response(
                {"code": "IDEMPOTENCY_KEY_REQUIRED"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            group = create_group(
                user=request.user,
                account_id=serializer.validated_data["matrix_account_id"],
                access_token=serializer.validated_data["matrix_access_token"],
                idempotency_key=idempotency_key,
                name=serializer.validated_data["name"],
                topic=serializer.validated_data["topic"],
                invitees=serializer.validated_data["invitees"],
                announcements_only=serializer.validated_data["announcements_only"],
                allow_external_guests=serializer.validated_data[
                    "allow_external_guests"
                ],
                emoji=serializer.validated_data["emoji"],
            )
        except MatrixBridgeError as error:
            return self._matrix_error(error)
        return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="bind")
    def bind(self, request):
        """Verify and persist the current user's selected Matrix identity."""
        serializer = MatrixBindingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            actor = verify_matrix_actor(
                request.user,
                serializer.validated_data["matrix_account_id"],
                serializer.validated_data["matrix_access_token"],
            )
        except MatrixBridgeError as error:
            return self._matrix_error(error)
        return Response({"mxid": actor.mxid})

    @action(detail=False, methods=["post"], url_path="resolve")
    def resolve(self, request):
        """Confirm untrusted Matrix room candidates against the Hub registry."""
        serializer = GroupResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            actor = verify_matrix_actor(
                request.user,
                serializer.validated_data["matrix_account_id"],
                serializer.validated_data["matrix_access_token"],
            )
        except MatrixBridgeError as error:
            return self._matrix_error(error)

        groups = (
            Group.objects.select_related("active_room", "created_by")
            .prefetch_related("rooms", "active_room__memberships")
            .filter(rooms__room_id__in=serializer.validated_data["room_ids"])
            .filter(
                Q(created_by=request.user)
                | Q(
                    active_room__memberships__mxid=actor.mxid,
                    active_room__memberships__membership__in=(
                        MembershipState.INVITE,
                        MembershipState.JOIN,
                    ),
                )
            )
            .exclude(status__in=(GroupStatus.DELETED, GroupStatus.FAILED))
            .distinct()
            .order_by("-created_at")
        )
        return Response({"groups": GroupSerializer(groups, many=True).data})

    @action(detail=False, methods=["post"], url_path="promote")
    def promote(self, request):
        """Create a hardened successor for a multi-party conversation."""
        serializer = GroupPromotionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        idempotency_key = request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return Response(
                {"code": "IDEMPOTENCY_KEY_REQUIRED"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            group = promote_conversation(
                user=request.user,
                account_id=serializer.validated_data["matrix_account_id"],
                access_token=serializer.validated_data["matrix_access_token"],
                idempotency_key=idempotency_key,
                source_room_id=serializer.validated_data["source_room_id"],
                name=serializer.validated_data["name"],
                topic=serializer.validated_data["topic"],
                announcements_only=serializer.validated_data["announcements_only"],
                allow_external_guests=serializer.validated_data[
                    "allow_external_guests"
                ],
                emoji=serializer.validated_data["emoji"],
            )
        except MatrixBridgeError as error:
            return self._matrix_error(error)
        return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)
