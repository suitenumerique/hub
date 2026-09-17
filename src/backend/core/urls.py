"""URL configuration for the core app."""

from django.conf import settings
from django.urls import include, path

from rest_framework.routers import DefaultRouter

from bots import api as bots_api
from core.api import roles, scribe, viewsets

# - Main endpoints
router = DefaultRouter()
router.register("users", viewsets.UserViewSet, basename="users")


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
    path("profile-role/", roles.RoleProfileView.as_view(), name="profile-role"),
    path("user-roles/", roles.UserRolesView.as_view(), name="user-roles"),
    # The assistant's identity and command catalogue, read by the composer.
    path("bots/assistant/", bots_api.AssistantView.as_view(), name="bots-assistant"),
    path("meetings/", viewsets.MeetingView.as_view()),
    path(
        "meetings/<str:slug>/",
        viewsets.MeetingDetailView.as_view(),
        name="meeting-detail",
    ),
    path(
        "meetings/<str:slug>/archive/",
        viewsets.MeetingArchiveView.as_view(),
        name="meeting-archive",
    ),
    path(
        "meetings/<str:slug>/transcript/",
        viewsets.MeetingTranscriptView.as_view(),
        name="meeting-transcript",
    ),
    # The scribe service, with its shared token: no user session.
    path("scribe/rooms/", scribe.ScribeRoomsView.as_view(), name="scribe-rooms"),
    path(
        "scribe/rooms/<str:livekit_room>/presence/",
        scribe.ScribePresenceView.as_view(),
        name="scribe-presence",
    ),
    path(
        "scribe/rooms/<str:livekit_room>/chat/",
        scribe.ScribeChatView.as_view(),
        name="scribe-chat",
    ),
    path(
        "scribe/rooms/<str:livekit_room>/replies/",
        scribe.ScribeRepliesView.as_view(),
        name="scribe-replies",
    ),
    path(
        "scribe/rooms/<str:livekit_room>/segments/",
        scribe.ScribeSegmentsView.as_view(),
        name="scribe-segments",
    ),
]

# When DEBUG, include a 404 URL for E2E tests

if settings.DEBUG:
    urlpatterns += [
        path("404/", viewsets.NotFoundView.as_view()),
    ]
