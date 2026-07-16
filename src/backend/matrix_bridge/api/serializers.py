"""API contracts for Hub groups."""

# DRF's declarative input serializers intentionally do not implement model
# persistence hooks.
# pylint: disable=abstract-method

from rest_framework import serializers

from matrix_bridge.client import MatrixHomeserver
from matrix_bridge.models import Group, GroupMatrixRoom, GroupMembership


class GroupCreateSerializer(serializers.Serializer):
    """Validated input for a new hardened group."""

    matrix_account_id = serializers.CharField(max_length=128)
    matrix_access_token = serializers.CharField(write_only=True, trim_whitespace=False)
    name = serializers.CharField(max_length=255)
    topic = serializers.CharField(required=False, allow_blank=True, default="")
    invitees = serializers.ListField(
        child=serializers.RegexField(r"^@[^:]+:.+$"), required=False, default=list
    )
    emoji = serializers.CharField(max_length=16, required=False, default="🌲")
    announcements_only = serializers.BooleanField(required=False, default=False)
    allow_external_guests = serializers.BooleanField(required=False, default=False)

    def validate_invitees(self, value):
        """Keep stable order while removing duplicates."""
        return list(dict.fromkeys(value))


class MatrixBindingSerializer(serializers.Serializer):
    """Short-lived Matrix proof used to bind the signed-in Hub user."""

    matrix_account_id = serializers.CharField(max_length=128)
    matrix_access_token = serializers.CharField(write_only=True, trim_whitespace=False)


class GroupResolveSerializer(MatrixBindingSerializer):
    """Candidate Matrix rooms plus the short-lived proof used to resolve them."""

    room_ids = serializers.ListField(
        child=serializers.CharField(max_length=255), allow_empty=False
    )

    def validate_room_ids(self, value):
        """Keep stable order while avoiding duplicate SQL predicates/results."""
        return list(dict.fromkeys(value))


class GroupPromotionSerializer(GroupCreateSerializer):
    """Creation details plus the multi-party predecessor room."""

    source_room_id = serializers.CharField(max_length=255)
    invitees = serializers.ListField(
        child=serializers.CharField(), required=False, default=list, write_only=True
    )


class GroupMembershipSerializer(serializers.ModelSerializer):
    """Explicit Matrix membership projection."""

    class Meta:
        model = GroupMembership
        fields = (
            "mxid",
            "membership",
            "display_name",
            "power_level",
            "role",
            "invited_at",
            "joined_at",
            "left_at",
        )


class GroupRoomSerializer(serializers.ModelSerializer):
    """One active or historical Matrix room in the chain."""

    class Meta:
        model = GroupMatrixRoom
        fields = (
            "room_id",
            "role",
            "sequence",
            "predecessor_room_id",
            "successor_room_id",
            "tombstone_event_id",
            "is_hardened",
            "room_version",
            "name",
            "topic",
            "avatar_mxc",
            "is_encrypted",
            "join_rule",
            "history_visibility",
        )


class GroupSerializer(serializers.ModelSerializer):
    """Stable group registry response contextualized to the creator account."""

    created_by = serializers.UUIDField(source="created_by_id", allow_null=True)
    matrix = serializers.SerializerMethodField()
    rooms = GroupRoomSerializer(many=True, read_only=True)
    memberships = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = (
            "id",
            "status",
            "created_by",
            "created_at",
            "ministry",
            "tags",
            "visibility",
            "emoji",
            "announcements_only",
            "allow_external_guests",
            "matrix",
            "rooms",
            "memberships",
            "last_reconciled_at",
        )

    def get_matrix(self, group):
        """Return the active Matrix room and contextual account routing."""
        room = group.active_room
        if not room:
            return None
        homeserver = MatrixHomeserver.for_account(group.control_homeserver)
        return {
            "room_id": room.room_id,
            "account_id": group.created_via_account_id,
            "via": [homeserver.server_name],
        }

    def get_memberships(self, group):
        """Serialize the projected memberships of the active room."""
        if not group.active_room:
            return []
        memberships = sorted(
            group.active_room.memberships.all(),
            key=lambda membership: (membership.display_name, membership.mxid),
        )
        return GroupMembershipSerializer(memberships, many=True).data
