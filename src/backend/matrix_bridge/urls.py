"""Versioned group API routes."""

from django.urls import include, path

from rest_framework.routers import DefaultRouter

from matrix_bridge.api.viewsets import GroupViewSet

router = DefaultRouter()
router.register("groups", GroupViewSet, basename="groups")

urlpatterns = [path("", include(router.urls))]
