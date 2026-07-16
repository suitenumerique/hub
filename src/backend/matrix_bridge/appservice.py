"""Unauthenticated-by-session, token-authenticated Matrix AS transaction endpoint."""

import json
import logging
import time

from django.core.exceptions import RequestDataTooBig
from django.db import OperationalError
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from matrix_bridge.client import MatrixBridgeError, MatrixHomeserver
from matrix_bridge.reducers import (
    ALLOWED_EVENT_TYPES,
    process_transaction,
    sanitize_events,
)
from matrix_bridge.services import complete_pending_upgrades_for_events

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name="dispatch")
class AppServiceTransactionView(View):
    """Synchronously project Matrix AS transactions and remember successes."""

    http_method_names = ["put"]

    def put(  # noqa: PLR0911  # pylint: disable=too-many-return-statements,too-many-locals
        self, request, txn_id: str
    ):
        """Authenticate, sanitize, atomically project and ACK a transaction."""
        started_at = time.monotonic()
        max_body_size = 5 * 1024 * 1024

        # Reject an announced oversized payload before reading its body.
        try:
            content_length = int(request.META.get("CONTENT_LENGTH") or 0)
        except (TypeError, ValueError):
            content_length = 0
        if content_length > max_body_size:
            return JsonResponse({"errcode": "PAYLOAD_TOO_LARGE"}, status=413)

        # Enforce the same limit on the body actually received by Django.
        try:
            body = request.body
        except RequestDataTooBig:
            return JsonResponse({"errcode": "PAYLOAD_TOO_LARGE"}, status=413)
        body_size = len(body)
        if body_size > max_body_size:
            return JsonResponse({"errcode": "PAYLOAD_TOO_LARGE"}, status=413)

        # Authenticate Synapse with the registration's homeserver token.
        authorization = request.headers.get("Authorization", "")
        token = (
            authorization.removeprefix("Bearer ")
            if authorization.startswith("Bearer ")
            else ""
        )
        homeserver = MatrixHomeserver.for_hs_token(token)
        if not homeserver:
            return JsonResponse({"errcode": "M_FORBIDDEN"}, status=403)

        # Validate the Application Service transaction envelope.
        try:
            payload = json.loads(body or b"{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            return JsonResponse({"errcode": "M_BAD_JSON"}, status=400)
        if not isinstance(payload, dict):
            return JsonResponse({"errcode": "M_BAD_JSON"}, status=400)
        events = payload.get("events", [])
        if not isinstance(events, list):
            return JsonResponse({"errcode": "M_BAD_JSON"}, status=400)

        # Keep only valid state fields consumed by the local projections.
        sanitized = sanitize_events(events)
        irrelevant_count = sum(
            1
            for event in events
            if isinstance(event, dict)
            and isinstance(event.get("type"), str)
            and event.get("type") not in ALLOWED_EVENT_TYPES
        )
        invalid_count = len(events) - len(sanitized) - irrelevant_count

        # Apply every retained event and the success marker in one DB transaction.
        try:
            processed = process_transaction(
                source_registration=homeserver.registration_id,
                source_homeserver=homeserver.account_id,
                transaction_id=txn_id,
                events=sanitized,
            )
            # Tombstones are registered transactionally first. Matrix network
            # calls happen only after that commit; a retry re-attempts the same
            # pending successor even when the transaction marker already exists.
            completed_upgrades = complete_pending_upgrades_for_events(
                sanitized,
                account_id=homeserver.account_id,
            )
        except MatrixBridgeError as error:
            if error.is_temporary:
                logger.warning(
                    "Temporary Matrix error while activating a successor",
                    extra={
                        "matrix_transaction_id": txn_id,
                        "matrix_error_code": error.errcode,
                    },
                )
                return JsonResponse({"errcode": "M_UNAVAILABLE"}, status=503)
            logger.exception(
                "Matrix rejected successor activation",
                extra={"matrix_transaction_id": txn_id},
            )
            return JsonResponse({"errcode": "M_UNKNOWN"}, status=500)
        except OperationalError:
            # A non-2xx response lets Synapse retry a temporary database failure.
            logger.exception(
                "Temporary database error while processing Matrix transaction",
                extra={"matrix_transaction_id": txn_id},
            )
            return JsonResponse({"errcode": "M_UNAVAILABLE"}, status=503)
        except Exception:  # pylint: disable=broad-exception-caught
            # Do not acknowledge or persist a success marker after any failure.
            logger.exception(
                "Unable to process Matrix AppService transaction",
                extra={"matrix_transaction_id": txn_id},
            )
            return JsonResponse({"errcode": "M_UNKNOWN"}, status=500)

        # Record observability data without logging event contents or tokens.
        logger.info(
            "Matrix AppService request completed",
            extra={
                "matrix_registration": homeserver.registration_id,
                "matrix_transaction_id": txn_id,
                "matrix_body_size": body_size,
                "matrix_event_count_received": len(events),
                "matrix_event_count_retained": len(sanitized),
                "matrix_event_count_irrelevant": irrelevant_count,
                "matrix_event_count_invalid": invalid_count,
                "matrix_event_types": sorted({event["type"] for event in sanitized}),
                "matrix_duplicate": not processed,
                "matrix_upgrades_completed": completed_upgrades,
                "matrix_duration_ms": round((time.monotonic() - started_at) * 1000, 2),
            },
        )
        # ACK only after the projections and success marker have committed.
        return JsonResponse({})
