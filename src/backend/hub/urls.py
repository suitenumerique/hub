"""URL configuration for the hub project"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import include, path, re_path

from drf_spectacular.views import (
    SpectacularJSONAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from lasuite.oidc_login.urls import urlpatterns as oidc_urls

from core.authentication.views import OIDCLogoutCallbackView, OIDCLogoutView

urlpatterns = [
    path("admin/", admin.site.urls),
    path(f"api/{settings.API_VERSION}/", include("core.urls")),
    # Override django-lasuite's logout routes, matched first, with the same
    # paths and names.
    path(
        f"api/{settings.API_VERSION}/logout/",
        OIDCLogoutView.as_view(),
        name="oidc_logout_custom",
    ),
    path(
        f"api/{settings.API_VERSION}/logout-callback/",
        OIDCLogoutCallbackView.as_view(),
        name="oidc_logout_callback",
    ),
    path(f"api/{settings.API_VERSION}/", include(oidc_urls)),
]

if settings.DEBUG:
    urlpatterns = (
        urlpatterns
        + staticfiles_urlpatterns()
        + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    )

if settings.LOAD_E2E_URLS:
    urlpatterns += [path("", include("e2e.urls"))]


if settings.USE_SWAGGER or settings.DEBUG:
    urlpatterns += [
        path(
            f"api/{settings.API_VERSION}/swagger.json",
            SpectacularJSONAPIView.as_view(
                api_version=settings.API_VERSION,
                urlconf="core.urls",
            ),
            name="client-api-schema",
        ),
        path(
            f"api/{settings.API_VERSION}/swagger/",
            SpectacularSwaggerView.as_view(url_name="client-api-schema"),
            name="swagger-ui-schema",
        ),
        re_path(
            f"api/{settings.API_VERSION}/redoc/",
            SpectacularRedocView.as_view(url_name="client-api-schema"),
            name="redoc-schema",
        ),
    ]
