"""Authenticated Hub group API."""

from django.db.models import Count, Q

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from matrix_bridge.client import MatrixBridgeError
from matrix_bridge.models import Group, GroupMemberRole, GroupStatus
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
        ordering = self.request.query_params.get("ordering", "-created_at")
        queryset = Group.objects.select_related("created_by").prefetch_related(
            "rooms", "members"
        )
        if ordering.lstrip("-") == "member_count":
            # Annotate before the membership visibility/role filters. Otherwise
            # Django reuses their constrained JOIN and every non-creator can be
            # sorted as though the group only contained themselves.
            queryset = queryset.annotate(
                human_member_count=Count(
                    "members",
                    filter=~Q(members__role=GroupMemberRole.BOT),
                    distinct=True,
                )
            )
        queryset = queryset.filter(
            Q(created_by=self.request.user) | Q(members__mxid__in=mxids)
        ).distinct()
        if value := self.request.query_params.get("status"):
            queryset = queryset.filter(status=value)
        else:
            queryset = queryset.exclude(status=GroupStatus.FAILED)
        if value := self.request.query_params.get("room_ids"):
            room_ids = [room_id for room_id in value.split(",") if room_id]
            queryset = queryset.filter(rooms__room_id__in=room_ids)
        if value := self.request.query_params.get("ministry"):
            queryset = queryset.filter(ministry=value)
        if value := self.request.query_params.get("tag"):
            queryset = queryset.filter(tags__contains=[value])
        if value := self.request.query_params.get("role"):
            queryset = queryset.filter(
                members__mxid__in=mxids,
                members__role=value,
            )
        if ordering.lstrip("-") == "member_count":
            direction = "-" if ordering.startswith("-") else ""
            queryset = queryset.order_by(f"{direction}human_member_count")
        elif ordering.lstrip("-") == "name":
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by(
                ordering if ordering in {"created_at", "-created_at"} else "-created_at"
            )
        return queryset

    @staticmethod
    def _get_idempotency_key(request):
        """Validate the private retry key before it reaches the model field."""
        value = (request.headers.get("Idempotency-Key") or "").strip()
        if not value:
            return None, Response(
                {"code": "IDEMPOTENCY_KEY_REQUIRED"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(value) > 255:
            return None, Response(
                {"code": "IDEMPOTENCY_KEY_INVALID"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return value, None

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
        idempotency_key, error_response = self._get_idempotency_key(request)
        if error_response is not None:
            return error_response
        try:
            group = create_group(
                user=request.user,
                account_id=serializer.validated_data["matrix_account_id"],
                access_token=serializer.validated_data["matrix_access_token"],
                idempotency_key=idempotency_key,
                name=serializer.validated_data["name"],
                invitees=serializer.validated_data["invitees"],
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
            Group.objects.select_related("created_by")
            .prefetch_related("rooms", "members")
            .filter(rooms__room_id__in=serializer.validated_data["room_ids"])
            .filter(Q(created_by=request.user) | Q(members__mxid=actor.mxid))
            .exclude(status=GroupStatus.FAILED)
            .distinct()
            .order_by("-created_at")
        )
        return Response({"groups": GroupSerializer(groups, many=True).data})

    @action(detail=False, methods=["post"], url_path="promote")
    def promote(self, request):
        """Create a hardened successor for a multi-party conversation."""
        serializer = GroupPromotionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        idempotency_key, error_response = self._get_idempotency_key(request)
        if error_response is not None:
            return error_response
        try:
            group = promote_conversation(
                user=request.user,
                account_id=serializer.validated_data["matrix_account_id"],
                access_token=serializer.validated_data["matrix_access_token"],
                idempotency_key=idempotency_key,
                source_room_id=serializer.validated_data["source_room_id"],
                name=serializer.validated_data["name"],
                allow_external_guests=serializer.validated_data[
                    "allow_external_guests"
                ],
                emoji=serializer.validated_data["emoji"],
            )
        except MatrixBridgeError as error:
            return self._matrix_error(error)
        return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)
