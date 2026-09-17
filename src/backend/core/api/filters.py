"""API filters for Hub' core application."""

import unicodedata

from django.conf import settings

import django_filters


def remove_accents(value):
    """Remove accents from a string (vélo -> velo)."""
    return "".join(
        c
        for c in unicodedata.normalize("NFD", value)
        if unicodedata.category(c) != "Mn"
    )


class UserSearchFilter(django_filters.FilterSet):
    """
    Custom filter for searching users.
    """

    q = django_filters.CharFilter(max_length=254)

    def __init__(self, *args, **kwargs):
        """
        Read the minimum query length from settings on each request instead
        of at import time, so `override_settings` (in tests) and any
        runtime change actually take effect instead of being frozen into
        the filter the first time this module is imported.
        """
        super().__init__(*args, **kwargs)
        self.filters["q"].extra["min_length"] = (
            settings.API_USERS_SEARCH_QUERY_MIN_LENGTH
        )
