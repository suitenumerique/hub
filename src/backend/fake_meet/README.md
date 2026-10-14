# Visio stand-in

A stand-in for Visio, served by the Hub backend in local development. It exists
because Visio does not send the `call.started` and `call.ended` webhooks yet
(see [ADR 2](../../../docs/adr/0002-start-visio-calls-from-conversations.md)).
It accepts any credentials and must never be served outside of a developer
machine.

## Removing it

Once Visio sends the webhooks, remove the stand-in in five steps.

1. Delete this directory:

   ```bash
   git rm -r src/backend/fake_meet
   ```

2. In `src/backend/hub/settings.py`, delete the `FAKE_MEET_ENABLED` and
   `FAKE_MEET_BASE_URL` settings of the `Base` class, and the
   `FAKE_MEET_ENABLED = False` override of the `Production` class with its
   comment.

3. In `src/backend/hub/urls.py`, delete the two lines that include
   `fake_meet.urls`.

4. In `env.d/development/common`, delete `FAKE_MEET_ENABLED` and
   `CONTENT_SECURITY_POLICY_EXCLUDE_URL_PREFIXES`, and point the four `MEET_*`
   variables to a real Visio instance:

   | Variable | Value |
   | --- | --- |
   | `MEET_API_URL` | External API of Visio, ending with `/external-api/v1.0` |
   | `MEET_APPLICATION_CLIENT_ID` | Client id of the Hub application in Visio |
   | `MEET_APPLICATION_CLIENT_SECRET` | Its secret |
   | `MEET_WEBHOOK_SECRET` | Secret Visio signs its webhooks with |

5. In the ADR, delete the "Local development" section.

Then check that nothing is left. This command must print nothing:

```bash
git grep -il "fake.meet"
```

## Cleaning a local environment

The rooms created with the stand-in point to its pages. Delete them, with
their calls, before using a real Visio instance:

```bash
make resetdb                          # drops the whole local database
docker compose exec redis redis-cli -n 2 --scan --pattern '*fake-meet:room:*' \
  | xargs -r docker compose exec -T redis redis-cli -n 2 del
```

To keep the rest of the database, delete only the rows of the `hub_call` and
`hub_meet_room` tables.
