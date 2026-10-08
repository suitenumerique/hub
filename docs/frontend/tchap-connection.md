# Connect the chat to Tchap

The Hub chat can run against Tchap preprod or Tchap prod instead of the local
Matrix stack. This guide explains how it works and how to set it up on a
development machine. To know what to test once connected, follow the
[Tchap test checklist](tchap-test-checklist.md).

## How it works

- **One environment at a time.** `NEXT_PUBLIC_MATRIX_ENVIRONMENT` selects
  `local` (default), `tchap-preprod` or `tchap-prod` when the frontend starts.
  Each environment has its own account id (`matrix-local`, `tchap-preprod`,
  `tchap-prod`), so their sessions, caches and encryption stores never mix.
- **Homeserver discovery.** Tchap is a federation of homeservers. The frontend
  finds the user's homeserver from their email with
  `GET https://matrix.<server>/_matrix/identity/api/v1/info?medium=email&address=<email>`.
  Every server of an environment gives the same answer, so they are asked in
  random order, and an unavailable server is skipped after 5 seconds. Only the
  environment's servers are accepted (`features/matrix/config.ts`).
- **Sign-in.** Each Tchap homeserver has its own Matrix Authentication Service
  (`https://auth.<server>/`), with ProConnect as a button on its login page.
  The Hub registers its OAuth client on that service at each login, like Tchap
  web, then redirects to it with the email pre-filled.
- **HTTPS origin.** Tchap's firewall and authentication service reject
  `localhost` addresses. In development, the Hub is therefore served at
  `https://hub.localhost:9814` by a Caddy proxy. Chrome, Edge and Firefox send
  `*.localhost` to your own machine: nothing is exposed. Caddy also serves the
  API on the same origin, so the Hub session cookie keeps working.

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

1. **Create your personal settings file**, then set your Tchap email in it:

   ```sh
   make tchap-env
   ```

   It creates `src/frontend/apps/hub/.env.tchap.local` (git-ignored):

   ```sh
   NEXT_PUBLIC_MATRIX_ENVIRONMENT=tchap-preprod
   NEXT_PUBLIC_MATRIX_LOGIN_HINT=firstname.lastname@beta.gouv.fr
   ```

   The email is needed because local Keycloak users have no Tchap account.

2. **Start the HTTPS origin.** This restarts the backend containers, then starts
   Caddy and a dedicated Next dev server. `yarn dev` on `localhost:9800` can
   keep running beside it.

   ```sh
   make run-tchap
   ```

   Existing machines created before this change: run `make reset-keycloak` once
   so Keycloak accepts the new origin (or add `https://hub.localhost:9814/*` to
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
   - **Linux**: `update-ca-certificates`, then `certutil` (package
     `libnss3-tools`) for Chrome and Firefox.
   - **Firefox on macOS or Windows**: set `security.enterprise_roots.enabled`
     to `true` in `about:config`.
   - **Safari only**: add `127.0.0.1 hub.localhost` to `/etc/hosts`.

   If you delete `data/caddy/`, a new authority is generated and must be
   trusted again.

4. **Open <https://hub.localhost:9814>** once the frontend has compiled
   (`make logs-tchap`). Sign in to the Hub with a local Keycloak user, then sign
   in to Tchap with your own account (ProConnect or password).

## Every day

```sh
make run-tchap   # backend + HTTPS origin
make logs-tchap  # frontend logs
make stop-tchap  # stop the HTTPS origin only
make down-tchap  # remove its containers (keeps the certificate authority)
```

To switch environment, edit `.env.tchap.local` and run `make run-tchap` again:
`NEXT_PUBLIC_*` values are read when the frontend starts.

`NEXT_PUBLIC_MATRIX_ENVIRONMENT=local` also works on the HTTPS origin, with the
local Matrix stack (`make run-matrix`).

## Troubleshooting

- **Certificate warning**: the authority is not trusted yet, or `data/caddy/`
  was recreated. Run `make tchap-trust` again and restart the browser.
- **Back on `http://localhost:9800` after the Hub login**: the backend still
  runs with old settings. Run `make run-tchap` again.
- **"Pare-feu applicatif" page (403)**: Tchap's firewall rejected the request.
  Check that you opened `https://hub.localhost:9814`, not `localhost:9800`.
- **"Adresse mail … associée au serveur …"**: the email you typed on the Tchap
  page belongs to another homeserver. Use the email set in
  `.env.tchap.local`.
- **"Signing in to the chat did not succeed"**: the Tchap page returned an
  error (for example a cancelled sign-in). The server's explanation is shown
  under the message; "Try again" starts a new sign-in.
- **"Your chat account has expired"**: renew the account with the link Tchap
  sends by email, then try again.
