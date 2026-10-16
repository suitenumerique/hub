"""Versioned group API routes."""

from django.urls import include, path

from rest_framework.routers import DefaultRouter

from .api.viewsets import GroupViewSet

router = DefaultRouter()
router.register("groups", GroupViewSet, basename="groups")

urlpatterns = [path("<str:backend_hrid>/", include(router.urls))]
