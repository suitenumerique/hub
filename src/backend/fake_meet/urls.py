"""URL configuration of the Visio stand-in."""

from django.urls import path

from fake_meet import views

urlpatterns = [
    path("fake-meet/external-api/v1.0/application/token/", views.token),
    path("fake-meet/external-api/v1.0/rooms/", views.rooms),
    path("fake-meet/rooms/<uuid:room_id>/", views.room),
]
