"""API contracts for Hub groups."""

# DRF's declarative input serializers intentionally do not implement model
# persistence hooks.
# pylint: disable=abstract-method

from rest_framework import serializers

from matrix_bridge.client import MatrixHomeserver
from matrix_bridge.models import Group, GroupMember, GroupMemberRole, GroupRoom


class GroupCreateSerializer(serializers.Serializer):
    """Validated input for a new hardened group."""

    matrix_account_id = serializers.CharField(max_length=128)
    matrix_access_token = serializers.CharField(write_only=True, trim_whitespace=False)
    name = serializers.CharField(max_length=255)
    invitees = serializers.ListField(
        child=serializers.RegexField(r"^@[^:]+:.+$"), required=False, default=list
    )
    emoji = serializers.CharField(max_length=16, required=False, default="🌲")
    allow_external_guests = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        """Reject fields removed from the public creation contract."""
        removed_fields = {"topic", "announcements_only"} & self.initial_data.keys()
        if removed_fields:
            raise serializers.ValidationError(
                dict.fromkeys(removed_fields, "This field is no longer supported.")
            )
        return attrs

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


class GroupMemberSerializer(serializers.ModelSerializer):
    """One currently joined Matrix member projected for the group."""

    hub_user_id = serializers.UUIDField(read_only=True, allow_null=True)

    class Meta:
        model = GroupMember
        fields = (
            "mxid",
            "hub_user_id",
            "display_name",
            "role",
        )


class GroupRoomSerializer(serializers.ModelSerializer):
    """One active or historical Matrix room in the chain."""

    class Meta:
        model = GroupRoom
        fields = ("room_id", "role", "sequence")


class GroupSerializer(serializers.ModelSerializer):
    """Stable group registry response contextualized to the creator account."""

    matrix = serializers.SerializerMethodField()
    rooms = GroupRoomSerializer(many=True, read_only=True)
    members = GroupMemberSerializer(many=True, read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = (
            "id",
            "status",
            "name",
            "ministry",
            "tags",
            "visibility",
            "emoji",
            "allow_external_guests",
            "member_count",
            "matrix",
            "rooms",
            "members",
        )

    def get_matrix(self, group):
        """Return the active Matrix room and contextual account routing."""
        room = group.active_room
        if not room:
            return None
        homeserver = MatrixHomeserver.for_account(group.matrix_account_id)
        return {
            "room_id": room.room_id,
            "account_id": group.matrix_account_id,
            "via": [homeserver.server_name],
        }

    def get_member_count(self, group):
        """Count joined humans; the AppService bot is an implementation detail."""
        return sum(member.role != GroupMemberRole.BOT for member in group.members.all())
