# Connect the chat to Tchap

The Hub chat can run against Tchap preprod or Tchap prod instead of the local
Matrix stack. This guide explains how it works and how to set it up on a
development machine. To know what to test once connected, follow the
[Tchap test checklist](tchap-test-checklist.md). For a step-by-step guide to
Tchap prod, see [Connect to Tchap prod locally](tchap-prod-connection.md).

## How it works

- **One environment at a time.** The backend setting
  `FRONTEND_CHAT_ENVIRONMENT` selects `local`, `tchap-preprod` or `tchap-prod`.
  The frontend reads it from the backend configuration (`/api/v1.0/config/`),
  so one frontend build serves every environment; without a known value, the
  chat refuses to start. Each environment has its own account id
  (`matrix-local`, `tchap-preprod`, `tchap-prod`), so their sessions, caches
  and encryption stores never mix.
- **Homeserver discovery.** Tchap is a federation of homeservers. The frontend
  finds the user's homeserver from their email with
  `GET https://matrix.<server>/_matrix/identity/api/v1/info?medium=email&address=<email>`.
  Every server of an environment gives the same answer, so they are asked in
  random order, and an unavailable server is skipped after 5 seconds. Only the
  environment's servers are accepted (`features/matrix/config.ts`).
- **Sign-in.** Like Tchap web, the Hub first asks for the Tchap email on its
  "Sign in to LaSuite" page, to find the homeserver. Unknown email domains
  lead to the external server, so the Hub asks the user to confirm it first.
  Each Tchap homeserver has its own Matrix Authentication Service
  (`https://auth.<server>/`), with ProConnect as a button on its login page.
  The Hub registers its OAuth client on that service at each login, then
  redirects to it with the email pre-filled. Development builds register it as
  "LaSuite Hub (dev)", to keep them apart from the real Hub.
- **HTTPS origin.** Tchap's firewall and authentication service reject
  `localhost` addresses. In development, the Hub is therefore served at
  `https://hub.localhost:9814` by a Caddy proxy. Chrome, Edge and Firefox send
  `*.localhost` to your own machine, and every development port is published
  on `127.0.0.1` only, so other machines on your network cannot reach it. Caddy
  also serves the API on the same origin, so the Hub session cookie keeps
  working.
- **Two modes, never both at once.** Dev mode (`make run`, `localhost:9800`)
  uses the local Matrix stack. Tchap mode (`make run-tchap`,
  `hub.localhost:9814`) restarts the backend so that it sends the browser back
  to the HTTPS origin after login and logout. Tests always run in dev mode.

| Environment     | Homeservers                          | Reference client                 |
| --------------- | ------------------------------------ | -------------------------------- |
| `local`         | `localhost` (local Synapse)          | Element at `http://localhost:9807` |
| `tchap-preprod` | `i`, `a`, `e` `.tchap.gouv.fr`        | `https://www.beta.tchap.gouv.fr` |
| `tchap-prod`    | the 17 `agent.*.tchap.gouv.fr` servers | `https://www.tchap.gouv.fr`      |

The reference client is the one used to verify this device and recover
encrypted history.

## Prerequisites

- A Tchap account in the target environment. In preprod, `*.gouv.fr` and
  `beta.gouv.fr` addresses go to the `i` server; unknown domains go to the
  external server `e`, where an invitation is usually required.
- For prod: your own real account, and the Tchap team's agreement before
  testing.
- The usual development setup (`make bootstrap`, frontend dependencies
  installed with `make frontend-development-install`).

## First time on a machine

1. **Create your personal settings file**, then choose the environment in it:

   ```sh
   make tchap-env
   ```

   It creates `src/frontend/apps/hub/.env.tchap.local` (git-ignored), read by
   the backend:

   ```sh
   FRONTEND_CHAT_ENVIRONMENT=tchap-preprod
   ```

2. **Switch to Tchap mode.** This stops the running stack (including the
   `localhost:9800` frontend), restarts the backend with the HTTPS origin as
   its login and logout destination, then starts Caddy and a dedicated Next dev
   server. It prints the environment and asks for confirmation before
   connecting to `tchap-prod`.

   ```sh
   make run-tchap
   ```

   Existing machines created before the HTTPS origin: run
   `make reset-keycloak` before `make run-tchap`, so Keycloak imports the realm
   again and accepts the new origin (or add `https://hub.localhost:9814/*` to
   the `hub` client in the Keycloak admin).

3. **Trust the local certificate authority, once.** Caddy generated it in
   `data/caddy/` (git-ignored, specific to your machine). Docker cannot change
   your system's trusted authorities, so this step runs on your machine:

   ```sh
   make tchap-trust
   ```

   It prints the exact command for your system:

   - **macOS**: `security add-trusted-cert` in your login keychain, or
     double-click the file and choose "Always Trust".
   - **Windows (WSL2)**: the browser runs on Windows, so import the file from
     Windows, with `certutil -addstore -f ROOT` in an administrator PowerShell
     or by double-clicking it ("Trusted Root Certification Authorities").
   - **Linux**: `update-ca-certificates` for the system, then `certutil`
     (package `libnss3-tools`) for Chrome. Firefox: import the file under
     Settings > Privacy & Security > View Certificates > Authorities.
   - **Firefox on macOS or Windows**: set `security.enterprise_roots.enabled`
     to `true` in `about:config`.
   - **Safari only**: add `127.0.0.1 hub.localhost` to `/etc/hosts`.

   If you delete `data/caddy/`, a new authority is generated and must be
   trusted again. A trusted authority can sign certificates for any site:
   remove it from your system when you no longer test Tchap.

4. **Open <https://hub.localhost:9814>** once the frontend has compiled
   (`make logs-tchap`). Sign in to the Hub with a local Keycloak user, type the
   email of your Tchap account on the "Sign in to LaSuite" page, then sign in
   to Tchap with your own account (ProConnect or password).

## Every day

```sh
make run-tchap   # switch to Tchap mode: backend + HTTPS origin
make logs-tchap  # frontend logs
make stop-tchap  # stop the HTTPS origin only
make down-tchap  # remove its containers (keeps the certificate authority)
make run         # back to dev mode on localhost:9800 (or make run-backend)
```

To switch environment, edit `.env.tchap.local` and run `make run-tchap` again:
the backend reads it when it starts.

`FRONTEND_CHAT_ENVIRONMENT=local` also works on the HTTPS origin, with the
local Matrix stack (`make run-matrix`).

## Troubleshooting

- **Certificate warning**: the authority is not trusted yet, or `data/caddy/`
  was recreated. Run `make tchap-trust` again and restart the browser.
- **Back on `http://localhost:9800` after the Hub login or logout**: the
  backend runs in dev mode (for example after `make run-backend`). Run
  `make run-tchap` again.
- **"The chat is not configured on this Hub"**: `FRONTEND_CHAT_ENVIRONMENT` is
  missing or misspelled in `.env.tchap.local` (or in the backend environment).
- **"Pare-feu applicatif" page (403)**: Tchap's firewall rejected the request.
  Check that you opened `https://hub.localhost:9814`, not `localhost:9800`.
- **"Adresse mail … associée au serveur …"**: the email you typed on the Tchap
  page belongs to another homeserver. Use the email typed on the Hub's
  "Sign in to LaSuite" page.
- **"The chat servers cannot be reached"** on the "Sign in to LaSuite" page: no
  homeserver of the environment answered the email lookup. Check your network,
  then try again.
- **"Signing in to the chat did not succeed"**: the Tchap page returned an
  error (for example a cancelled sign-in). The server's explanation is shown
  under the message; "Try again" starts a new sign-in.
- **"Your chat account has expired"**: renew the account with the link Tchap
  sends by email, then try again.
