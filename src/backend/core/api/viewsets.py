"""API endpoints"""

import json
import logging

from django.conf import settings
from django.contrib.postgres.search import TrigramSimilarity
from django.core.cache import cache
from django.db.models.expressions import RawSQL
from django.db.models.functions import Greatest
from django.http import Http404
from django.utils.text import slugify

import rest_framework as drf
from lasuite.tools.email import get_domain_from_email
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from core import models
from core.api.filters import remove_accents

from . import permissions, serializers
from .filters import UserSearchFilter
from .throttling import (
    UserListThrottleBurst,
    UserListThrottleSustained,
)

logger = logging.getLogger(__name__)

# pylint: disable=too-many-ancestors


class NestedGenericViewSet(viewsets.GenericViewSet):
    """
    A generic Viewset aims to be used in a nested route context.
    e.g: `/api/v1.0/resource_1/<resource_1_pk>/resource_2/<resource_2_pk>/`

    It allows to define all url kwargs and lookup fields to perform the lookup.
    """

    lookup_fields: list[str] = ["pk"]
    lookup_url_kwargs: list[str] = []

    def __getattribute__(self, item):
        """
        This method is overridden to allow to get the last lookup field or lookup url kwarg
        when accessing the `lookup_field` or `lookup_url_kwarg` attribute. This is useful
        to keep compatibility with all methods used by the parent class `GenericViewSet`.
        """
        if item in ["lookup_field", "lookup_url_kwarg"]:
            return getattr(self, item + "s", [None])[-1]

        return super().__getattribute__(item)

    def get_queryset(self):
        """
        Get the list of items for this view.

        `lookup_fields` attribute is enumerated here to perform the nested lookup.
        """
        queryset = super().get_queryset()

        # The last lookup field is removed to perform the nested lookup as it corresponds
        # to the object pk, it is used within get_object method.
        lookup_url_kwargs = (
            self.lookup_url_kwargs[:-1]
            if self.lookup_url_kwargs
            else self.lookup_fields[:-1]
        )

        filter_kwargs = {}
        for index, lookup_url_kwarg in enumerate(lookup_url_kwargs):
            if lookup_url_kwarg not in self.kwargs:
                raise KeyError(
                    f"Expected view {self.__class__.__name__} to be called with a URL "
                    f'keyword argument named "{lookup_url_kwarg}". Fix your URL conf, or '
                    "set the `.lookup_fields` attribute on the view correctly."
                )

            filter_kwargs.update(
                {self.lookup_fields[index]: self.kwargs[lookup_url_kwarg]}
            )

        return queryset.filter(**filter_kwargs)


class SerializerPerActionMixin:
    """
    A mixin to allow to define serializer classes for each action.

    This mixin is useful to avoid to define a serializer class for each action in the
    `get_serializer_class` method.

    Example:
    ```
    class MyViewSet(SerializerPerActionMixin, viewsets.GenericViewSet):
        serializer_class = MySerializer
        list_serializer_class = MyListSerializer
        retrieve_serializer_class = MyRetrieveSerializer
    ```
    """

    def get_serializer_class(self):
        """
        Return the serializer class to use depending on the action.
        """
        if serializer_class := getattr(self, f"{self.action}_serializer_class", None):
            return serializer_class
        return super().get_serializer_class()


class UserViewSet(
    drf.mixins.UpdateModelMixin, viewsets.GenericViewSet, drf.mixins.ListModelMixin
):
    """User ViewSet"""

    permission_classes = [permissions.IsSelf]
    queryset = models.User.objects.filter(is_active=True)
    serializer_class = serializers.UserSerializer
    pagination_class = None
    throttle_classes = []

    def get_throttles(self):
        self.throttle_classes = []
        if self.action == "list":
            self.throttle_classes = [UserListThrottleBurst, UserListThrottleSustained]

        return super().get_throttles()

    def get_queryset(self):
        """
        Limit listed users by querying the email field with a trigram similarity
        search if a query is provided.
        Limit listed users by excluding users already in the document if a document_id
        is provided.
        """
        queryset = self.queryset

        if self.action != "list":
            return queryset

        filterset = UserSearchFilter(
            self.request.GET, queryset=queryset, request=self.request
        )
        if not filterset.is_valid():
            raise drf.exceptions.ValidationError(filterset.errors)

        # Exclude all users already in the given document
        if document_id := self.request.query_params.get("document_id", ""):
            queryset = queryset.exclude(documentaccess__document_id=document_id)

        filter_data = filterset.form.cleaned_data
        query = remove_accents(filter_data["q"])

        # For emails, match emails by Levenstein distance to prevent typing errors
        if "@" in query:
            return (
                queryset.annotate(
                    distance=RawSQL(
                        "levenshtein(unaccent(email::text), %s::text)", (query,)
                    )
                )
                .filter(distance__lte=3)
                .order_by("distance", "email")[: settings.API_USERS_LIST_LIMIT]
            )

        # Use trigram similarity for non-email-like queries
        # For performance reasons we filter first by similarity, which relies on an
        # index, then only calculate precise similarity scores for sorting purposes.
        #
        # Additionally results are reordered to prefer users "closer" to the current
        # user: users they recently shared documents with, then same email domain.
        # To achieve that without complex SQL, we build a proximity score in Python
        # and return the top N results.
        # For security results, users that match neither of these proximity criteria
        # are not returned at all, to prevent email enumeration.
        current_user = self.request.user

        user_email_domain = get_domain_from_email(current_user.email) or ""

        candidates = list(
            queryset.annotate(
                sim_email=TrigramSimilarity("email", query),
                sim_name=TrigramSimilarity("full_name", query),
            )
            .annotate(similarity=Greatest("sim_email", "sim_name"))
            .filter(similarity__gt=0.2)
            .order_by("-similarity")
        )

        # Keep only users that either share documents with the current user
        # or have an email with the same domain as the current user.
        filtered_candidates = []
        for u in candidates:
            candidate_domain = get_domain_from_email(u.email) or ""
            if user_email_domain and candidate_domain == user_email_domain:
                filtered_candidates.append(u)

        candidates = filtered_candidates

        # Build ordering key for each candidate
        def _sort_key(u):
            # domain proximity
            candidate_email_domain = get_domain_from_email(u.email) or ""

            same_full_domain = (
                1
                if candidate_email_domain
                and candidate_email_domain == user_email_domain
                else 0
            )

            # similarity fallback
            sim = getattr(u, "similarity", 0) or 0

            return (
                same_full_domain,
                sim,
            )

        # Sort candidates by the key descending and return top N as a queryset-like
        # list. Keep return type consistent with previous behavior (QuerySet slice
        # was returned) by returning a list of model instances.
        candidates.sort(key=_sort_key, reverse=True)

        return candidates[: settings.API_USERS_LIST_LIMIT]

    @drf.decorators.action(
        detail=False,
        methods=["get"],
        url_name="me",
        url_path="me",
        permission_classes=[permissions.IsAuthenticated],
    )
    def get_me(self, request):
        """
        Return information on currently logged user
        """
        context = {"request": request}
        return drf.response.Response(
            self.serializer_class(request.user, context=context).data
        )


class ConversationViewSet(SerializerPerActionMixin, viewsets.ModelViewSet):
    """User ViewSet"""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = serializers.ConversationSerializer
    create_serializer_class = serializers.CreateConversationSerializer
    pagination_class = None  # FIXME: Disable pagination for now

    def get_queryset(self):
        return models.Conversation.objects.filter(participants=self.request.user).prefetch_related("participants")

    def perform_create(self, serializer):
        super().perform_create(serializer)


class ConfigView(drf.views.APIView):
    """API ViewSet for sharing some public settings."""

    permission_classes = [AllowAny]
    throttle_scope = "config"

    def get(self, request):
        """
        GET /api/v1.0/config/
            Return a dictionary of public settings.
        """
        array_settings = [
            "API_USERS_SEARCH_QUERY_MIN_LENGTH",
            "CRISP_WEBSITE_ID",
            "ENVIRONMENT",
            "FRONTEND_CSS_URL",
            "FRONTEND_HOMEPAGE_FEATURE_ENABLED",
            "FRONTEND_JS_URL",
            "FRONTEND_SILENT_LOGIN_ENABLED",
            "FRONTEND_THEME",
            "MEDIA_BASE_URL",
            "POSTHOG_KEY",
            "LANGUAGES",
            "LANGUAGE_CODE",
            "SENTRY_DSN",
        ]
        dict_settings = {}
        for setting in array_settings:
            if hasattr(settings, setting):
                dict_settings[setting] = getattr(settings, setting)

        dict_settings["theme_customization"] = self._load_theme_customization()

        return drf.response.Response(dict_settings)

    def _load_theme_customization(self):
        if not settings.THEME_CUSTOMIZATION_FILE_PATH:
            return {}

        cache_key = (
            f"theme_customization_{slugify(settings.THEME_CUSTOMIZATION_FILE_PATH)}"
        )
        theme_customization = cache.get(cache_key, {})
        if theme_customization:
            return theme_customization

        try:
            with open(
                settings.THEME_CUSTOMIZATION_FILE_PATH, "r", encoding="utf-8"
            ) as f:
                theme_customization = json.load(f)
        except FileNotFoundError:
            logger.error(
                "Configuration file not found: %s",
                settings.THEME_CUSTOMIZATION_FILE_PATH,
            )
        except json.JSONDecodeError:
            logger.error(
                "Configuration file is not a valid JSON: %s",
                settings.THEME_CUSTOMIZATION_FILE_PATH,
            )
        else:
            cache.set(
                cache_key,
                theme_customization,
                settings.THEME_CUSTOMIZATION_CACHE_TIMEOUT,
            )

        return theme_customization


class NotFoundView(drf.views.APIView):
    """
    API ViewSet to return a 404 response, used for E2E tests.

    Only available when DEBUG=True,
    see language.spec.ts in e2e test application.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        """
        GET /api/v1.0/404/
            Return a 404 response.
        """
        raise Http404()
