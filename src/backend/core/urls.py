"""URL configuration for the core app."""

from django.conf import settings
from django.urls import include, path

from rest_framework.routers import DefaultRouter

from core.api import viewsets

# - Main endpoints
router = DefaultRouter()
router.register("users", viewsets.UserViewSet, basename="users")
router.register("conversations", viewsets.ConversationViewSet, basename="conversations")


urlpatterns = [
    path(
        "",
        include(
            [
                *router.urls,
            ]
        ),
    ),
    path("config/", viewsets.ConfigView.as_view()),
]

# When DEBUG, include a 404 URL for E2E tests

if settings.DEBUG:
    urlpatterns += [
        path("404/", viewsets.NotFoundView.as_view()),
    ]
