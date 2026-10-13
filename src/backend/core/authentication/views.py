"""Authentication views for the Hub core app."""

from lasuite.oidc_login.views import (
    OIDCLogoutCallbackView as LaSuiteOIDCLogoutCallbackView,
)
from lasuite.oidc_login.views import OIDCLogoutView as LaSuiteOIDCLogoutView
from mozilla_django_oidc.views import get_next_url

LOGOUT_NEXT_SESSION_KEY = "oidc_logout_next"


class ReturnToLogoutMixin:
    """
    End the logout on the frontend URL it started from, as the login does with
    its `returnTo` parameter, instead of the single LOGOUT_REDIRECT_URL: one
    backend can serve several frontend origins, such as localhost:9800 and the
    Tchap HTTPS origin in development.
    """

    return_to = None

    def dispatch(self, request, *args, **kwargs):
        """Read the frontend URL before the logout flushes the session."""
        self.return_to = request.session.get(LOGOUT_NEXT_SESSION_KEY)
        return super().dispatch(request, *args, **kwargs)

    @property
    def redirect_url(self):
        """Return the frontend URL of this logout, else LOGOUT_REDIRECT_URL."""
        return self.return_to or super().redirect_url


class OIDCLogoutView(ReturnToLogoutMixin, LaSuiteOIDCLogoutView):
    """Start the logout, remembering its `returnTo` frontend URL."""

    def dispatch(self, request, *args, **kwargs):
        """Validate `returnTo` like the login does (allowed hosts, scheme)."""
        request.session[LOGOUT_NEXT_SESSION_KEY] = get_next_url(
            request, self.get_settings("OIDC_REDIRECT_FIELD_NAME", "next")
        )
        return super().dispatch(request, *args, **kwargs)


class OIDCLogoutCallbackView(ReturnToLogoutMixin, LaSuiteOIDCLogoutCallbackView):
    """Finish the logout on the frontend URL it started from."""
