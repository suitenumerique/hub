# 2. Start Visio calls from conversations

Date: 2026-10-05

## Status

Proposed

Answers question 1 of the [Visio RFC](https://github.com/suitenumerique/meet/issues/1681)
for [Hub issue #38](https://github.com/suitenumerique/hub/issues/38). The Visio
team has not reviewed it: every point it has to confirm is listed under
[Assumptions](#assumptions).

## Context

A member starts a call from a conversation. The call opens in Visio, in a new
tab, and the conversation shows that a call is ongoing, then that it has ended.
Every member sees the same status.

Three facts shape the design:

- **Visio does not tell anyone when a call starts or ends.** Its external API
  creates rooms and nothing else. Visio itself learns about calls from LiveKit
  (`room_started`, `room_finished`) but does not pass it on.
- **The Hub backend does not know the conversations.** They live on the chat
  service (Matrix). The backend cannot tell who belongs to a conversation, and
  it has no way to write into one.
- **The Hub backend cannot push to browsers.** The only live channel a browser
  has is its Matrix sync.

## Decision

The Hub backend owns the calls. The conversation only holds a message
announcing each call, and browsers read the status of that call from the Hub.

```
 Browser                Hub backend                 Visio
    │  POST /calls/          │                         │
    ├───────────────────────►│  POST /rooms/ (once)    │
    │                        ├────────────────────────►│
    │  201 {id, url}         │                         │
    │◄───────────────────────┤                         │
    │  opens url in a new tab ─────────────────────────►
    │  posts the announcement in the conversation (Matrix)
    │                        │  webhook call.started   │
    │                        │◄────────────────────────┤
    │  GET /calls/{id}/      │                         │
    ├───────────────────────►│  webhook call.ended     │
    │  (every 5 s while      │◄────────────────────────┤
    │   the call is ongoing) │                         │
```

1. **One Visio room per conversation.** The Hub creates it on the first call
   and reuses it afterwards. The room hosts one call at a time.
2. **A call starts at the click.** The Hub records the call as ongoing as soon
   as a member asks for it, and Visio confirms it with `call.started`. A call
   nobody joins within 5 minutes is closed with no duration.
3. **Starting a call where one is ongoing joins it.** The API then answers
   `200` instead of `201`, and the browser does not announce the call again.
4. **The browser of the member who starts the call announces it**, with a
   regular text message that carries the call under the
   `fr.gouv.numerique.hub.call` key. Other Matrix clients show the text, which
   holds the link.
5. **Browsers poll the Hub** for the status of the calls they display.
6. **Visio reports calls to the Hub with webhooks.** A call started outside of
   the Hub, with the link of the room, is recorded too.

### API of the Hub, for its frontend

Session authentication. A call is:

```json
{
  "id": "5f0c8a1e-6f0e-4b53-9c0e-2f1f3f6f9a10",
  "chat_service_id": "!abcdef:matrix.org",
  "url": "https://visio.numerique.gouv.fr/abc-defg-hij",
  "status": "ongoing",
  "started_at": "2026-10-05T09:00:00Z",
  "ended_at": null
}
```

| Request | Answer |
| --- | --- |
| `POST /api/v1.0/calls/` with `{"chat_service_id": "…"}` | `201` and the call it opened, or `200` and the ongoing call to join. `502` when Visio is unavailable. |
| `GET /api/v1.0/calls/{id}/` | The call. |
| `GET /api/v1.0/calls/?chat_service_id=…&status=ongoing` | The calls of up to 50 conversations, most recent first. `status` is optional. |

`GET /api/v1.0/config/` tells the frontend whether calls are available, with
`MEET_ENABLED`.

### Hub to Visio: existing external API

The Hub uses the external API as it is today:

1. `POST /external-api/v1.0/application/token/` with its application
   credentials and the email of the member starting the call as `scope`.
2. `POST /external-api/v1.0/rooms/` with `{"access_level": "trusted"}`. The Hub
   keeps the `id` and `url` of the room.

### Visio to Hub: webhooks to add to Visio

`POST /api/v1.0/webhooks/meet/` on the Hub, for the rooms the Hub created.

```json
{
  "type": "call.started",
  "timestamp": "2026-10-05T09:00:04Z",
  "data": {
    "room": { "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7", "slug": "abc-defg-hij" },
    "call": { "id": "RM_x7Kq2pLm9aBc", "started_at": "2026-10-05T09:00:04Z" }
  }
}
```

- `type` is `call.started` when the first participant enters the room, and
  `call.ended` when the last one has left. `call.ended` adds `ended_at` to
  `call`.
- `call.id` identifies one call of the room. It has the same value in both
  events of a call, and it makes them idempotent.
- The request is signed as the
  [Standard Webhooks](https://www.standardwebhooks.com/) specification
  describes, with a secret shared by both products: `webhook-id`,
  `webhook-timestamp` and `webhook-signature` headers, the last one being
  `v1,` followed by the base64 HMAC-SHA256 of `{id}.{timestamp}.{body}`.
- The Hub answers `204`, including for event types and rooms it does not know.
  It answers `401` to a wrong signature or a timestamp older than 5 minutes.

## Assumptions

To confirm with the Visio team.

| # | Assumption | If it does not hold |
| --- | --- | --- |
| 1 | Visio can send `call.started` and `call.ended`, from the LiveKit events it already receives. | Without them the Hub cannot show a call as ended. Nothing else replaces them. |
| 2 | The LiveKit room session id (`RM_…`) is exposed as `call.id`. | Any identifier unique per call works. |
| 3 | Webhooks are configured per application (URL and secret), and sent for the rooms that application created. | The Hub already ignores the rooms it does not know. |
| 4 | Payload and signature follow Standard Webhooks, which could be shared with the outbound webhooks Drive is considering. | Only the verification and one serializer change on the Hub. |
| 5 | The Hub application is allowed to act for the email domains of its users, and Visio creates the account of a user who never used it. | Members without a Visio account cannot start the first call of a conversation. |
| 6 | Rooms are `trusted`: signed-in users enter directly, others wait in the lobby. | The RFC asks for more: only the members of the conversation skip the lobby. This needs the attendees feature announced in the external API. |
| 7 | The room is owned by the member who started the first call. | The RFC asks for a room owned by all the members. This needs the same feature. |
| 8 | `call.ended` is sent when LiveKit closes the room, a few seconds after the last participant left. | The ended status is shown later. |

## Consequences

- The Hub works without any change to the room model of Visio. What is missing
  on the Visio side is the two webhooks.
- **Access to calls relies on knowing the identifier of the conversation.** The
  backend cannot check that a user belongs to it. Any signed-in Hub user who
  knows the identifier can read the status and the link of its calls, and
  start one. This is acceptable for a first version only because the link gives
  no more access than Visio grants on its own; it has to be closed before
  rooms become restricted to members.
- **The status is at most 5 seconds late**, and each displayed ongoing call
  costs one request every 5 seconds per browser.
- **A call started outside of the Hub is recorded but not announced** in the
  conversation, as no browser was there to post the message.
- **If the announcement fails after the call was opened**, the call exists
  without a message in the conversation until it ends.
- **The conversation list asks the Hub for the ongoing calls of every
  conversation of the user**, every 5 seconds, in requests of 50 conversations.

Posting the announcements from the backend, with a Matrix identity of its own,
would remove the last four points: the Hub would write the status changes in
the conversation and browsers would receive them from their Matrix sync. It was
left out of the first version because it requires an application service on
the homeserver.

## Local development

`FAKE_MEET_ENABLED` serves a stand-in for Visio from the backend itself. It
implements the two external API endpoints above, and a room page whose links
send the two webhooks. It is enabled in the development environment and forced
off in production.
