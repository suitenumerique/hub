"""Serializers for E2E tests."""

from rest_framework import serializers


# pylint: disable=abstract-method
class E2EAuthSerializer(serializers.Serializer):
    """Serializer for E2E authentication."""

    email = serializers.EmailField(required=True)
