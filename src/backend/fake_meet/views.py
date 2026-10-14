"""Views of the Visio stand-in."""

import json
import time
import uuid

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect
from django.utils import timezone
from django.utils.html import format_html
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods, require_POST

import requests

from core.services.meet import sign_webhook

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Visio (stand-in)</title>
    <style>
      body {{ font-family: sans-serif; max-width: 32rem; margin: 4rem auto; }}
      a {{ display: inline-block; padding: .5rem 1rem; border: 1px solid; }}
    </style>
  </head>
  <body>
    <h1>Visio (stand-in)</h1>
    <p>Room <code>{room_id}</code></p>
    <p>{status}</p>
    <p><a href="{action_url}">{action_label}</a></p>
    <script>
      // Closing the page of a participant leaves the call, as it does on Visio.
      if (new URLSearchParams(location.search).has("p")) {{
        addEventListener("pagehide", () =>
          navigator.sendBeacon(location.href + "&action=leave"));
      }}
    </script>
  </body>
</html>
"""


@csrf_exempt
@require_POST
def token(request):
    """Return an access token, whatever the credentials."""
    return JsonResponse(
        {"access_token": "fake-meet", "token_type": "Bearer", "expires_in": 3600}
    )


@csrf_exempt
@require_POST
def rooms(request):
    """Create a room. Nothing is stored: the room only lives in its link."""
    room_id = uuid.uuid4()
    return JsonResponse(
        {
            "id": str(room_id),
            "slug": str(room_id),
            "access_level": json.loads(request.body or "{}").get(
                "access_level", "trusted"
            ),
            "url": f"{settings.FAKE_MEET_BASE_URL.rstrip('/')}/rooms/{room_id}/",
        },
        status=201,
    )


def send_webhook(request, event_type, room_id, call):
    """Send to the Hub the webhook Visio is expected to send."""
    body = json.dumps(
        {
            "type": event_type,
            "timestamp": timezone.now().isoformat(),
            "data": {"room": {"id": str(room_id), "slug": str(room_id)}, "call": call},
        }
    ).encode()
    webhook_id = f"msg_{uuid.uuid4().hex}"
    timestamp = str(int(time.time()))
    # The Hub is this very server, reached on the port it listens to.
    requests.post(
        f"http://localhost:{request.META['SERVER_PORT']}"
        f"/api/{settings.API_VERSION}/webhooks/meet/",
        data=body,
        headers={
            "Content-Type": "application/json",
            "webhook-id": webhook_id,
            "webhook-timestamp": timestamp,
            "webhook-signature": sign_webhook(
                settings.MEET_WEBHOOK_SECRET, webhook_id, timestamp, body
            ),
        },
        timeout=settings.MEET_API_TIMEOUT,
    ).raise_for_status()


def cache_key(room_id):
    """Key under which the ongoing call of a room is kept."""
    return f"fake-meet:room:{room_id}"


def join(request, room_id, participant):
    """Add a participant to a room, starting a call when it was empty."""
    call = cache.get(cache_key(room_id))
    if call is None:
        call = {"id": f"RM_{uuid.uuid4().hex[:12]}", "participants": []}
        send_webhook(
            request,
            "call.started",
            room_id,
            {"id": call["id"], "started_at": timezone.now().isoformat()},
        )
    call["participants"].append(participant)
    cache.set(cache_key(room_id), call, timeout=None)


def leave(request, room_id, participant):
    """Remove a participant from a room, ending the call when it gets empty."""
    call = cache.get(cache_key(room_id))
    if call is None or participant not in call["participants"]:
        return
    call["participants"].remove(participant)
    if call["participants"]:
        cache.set(cache_key(room_id), call, timeout=None)
        return
    cache.delete(cache_key(room_id))
    send_webhook(
        request,
        "call.ended",
        room_id,
        {"id": call["id"], "ended_at": timezone.now().isoformat()},
    )


@csrf_exempt
@require_http_methods(["GET", "POST"])
def room(request, room_id):
    """
    Show a room, which a participant joins with a link and leaves with another
    one or by closing the page.

    As Visio does, the Hub is only told when the first participant enters the
    room and when the last one has left.
    """
    action = request.GET.get("action")
    participant = request.GET.get("p")

    if action == "join":
        participant = uuid.uuid4().hex[:8]
        join(request, room_id, participant)
        # Redirect so that reloading the page does not join a second time.
        return redirect(f"{request.path}?p={participant}")
    if action == "leave" and participant:
        leave(request, room_id, participant)
        if request.method == "POST":
            return HttpResponse(status=204)
        return redirect(request.path)

    call = cache.get(cache_key(room_id))
    participants = call["participants"] if call else []
    if participant in participants:
        status = f"You are in the call. Participants: {len(participants)}."
        action_url = f"?action=leave&p={participant}"
        action_label = "Leave the call"
    else:
        status = f"You are not in the call. Participants: {len(participants)}."
        action_url = "?action=join"
        action_label = "Join the call"

    return HttpResponse(
        format_html(
            PAGE,
            room_id=room_id,
            status=status,
            action_url=action_url,
            action_label=action_label,
        )
    )
