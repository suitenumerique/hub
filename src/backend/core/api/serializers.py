"""Client serializers for the hub core app."""

from django.utils.text import slugify

from rest_framework import serializers

from core import models


class UserSerializer(serializers.ModelSerializer):
    """Serialize users."""

    full_name = serializers.SerializerMethodField(read_only=True)
    short_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = models.User
        fields = ["id", "email", "full_name", "short_name", "language"]
        read_only_fields = ["id", "email", "full_name", "short_name"]

    def get_full_name(self, instance):
        """Return the full name of the user."""
        if not instance.full_name:
            email = instance.email.split("@")[0]
            return slugify(email)

        return instance.full_name

    def get_short_name(self, instance):
        """Return the short name of the user."""
        if not instance.short_name:
            email = instance.email.split("@")[0]
            return slugify(email)

        return instance.short_name


class UserMeSerializer(UserSerializer):
    """Serialize the current user, with what only they may read about themselves."""

    class Meta(UserSerializer.Meta):
        fields = [*UserSerializer.Meta.fields, "sub"]
        read_only_fields = [*UserSerializer.Meta.read_only_fields, "sub"]


class UserLightSerializer(UserSerializer):
    """Serialize users with limited fields."""

    class Meta:
        model = models.User
        fields = ["full_name", "short_name"]
        read_only_fields = ["full_name", "short_name"]
