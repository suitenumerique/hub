"""API contracts for Hub groups."""

from rest_framework import serializers

from core.models import Group

from messaging_backends.matrix.models import MatrixRoom, MatrixRoomState


class GroupCreateSerializer(serializers.Serializer):
    """Group creation details."""

    matrix_account_id = serializers.CharField(max_length=128)
    matrix_access_token = serializers.CharField(write_only=True, trim_whitespace=False)
    name = serializers.CharField(max_length=255)
    invitees = serializers.ListField(
        child=serializers.RegexField(r"^@[^:]+:.+$"), required=False, default=list
    )
    emoji = serializers.CharField(max_length=16, required=False, default="🌲")
    allow_external_guests = serializers.BooleanField(required=False, default=False)
    is_encrypted = serializers.BooleanField(required=False, default=False)


class GroupPromotionSerializer(GroupCreateSerializer):
    """Creation details plus the multi-party predecessor room."""

    source_room_id = serializers.CharField(max_length=255)
    invitees = serializers.ListField(
        child=serializers.CharField(), required=False, default=list, write_only=True
    )



class GroupRoomSerializer(serializers.ModelSerializer):
    """One active or historical Matrix room in the chain."""

    class Meta:
        model = MatrixRoom
        fields = ("room_id", "state")


class GroupSerializer(serializers.ModelSerializer):
    matrix = serializers.SerializerMethodField()
    rooms = GroupRoomSerializer(many=True, read_only=True)

    class Meta:
        model = Group
        fields = (
            "id",
            "name",
            "visibility",
            "emoji",
            "matrix",
            "rooms",
        )

    def get_matrix(self, group):
        """Return the active Matrix room and contextual account routing."""
        room = group.rooms.filter(state=MatrixRoomState.ACTIVE).first()  # XXX: prefetch_related_fields
        if not room:
            return None
        
        return {
            "room_id": room.room_id,
            "account_id": room.homeserver_hrid,
            # "via": [homeserver.server_name],
            "via": ["localhost"],  # XXX
        }
