# Connect to Tchap prod locally

This guide connects the Hub chat to **Tchap prod** from a development machine.
For how the connection works in general, see
[Connect the chat to Tchap](tchap-connection.md).

> ⚠️ **Prod is the real Tchap.** You read and send real messages with your
> real account. Only do it with the Tchap team's agreement, and always start
> with preprod (`tchap-preprod`).

## How it works

- **Two modes, never both at once.**
  - **Dev mode** (`make run`): `http://localhost:9800`, chat on the local
    Matrix stack.
  - **Tchap mode** (`make run-tchap`): `https://hub.localhost:9814`, chat on
    Tchap preprod or prod.

  Starting one mode stops the other. Tests (manual, Playwright, agents) always
  run in **dev mode**.
- **Why a special HTTPS address.** Tchap's firewall and authentication server
  reject `localhost` addresses. A Caddy proxy therefore serves the Hub at
  `https://hub.localhost:9814`, with a certificate signed by a local authority.
  This address points to your own machine and cannot be reached from the
  network.
- **Why two sign-ins.**
  - The first one, **local Keycloak**, signs you in to the Hub.
  - The second one, **Tchap** (ProConnect or password), signs in the chat.

  They are two separate identities. The Tchap sign-in happens only once per
  browser profile; the session is then kept.
- **How Tchap finds your server.** Tchap prod has 17 servers
  (`agent.<ministry>.tchap.gouv.fr`). The Hub asks for your email, finds your
  server from it, then sends you to its sign-in page with the email
  pre-filled.

## Prerequisites

- A Tchap prod account in your name, and the Tchap team's agreement.
- The development setup installed (`make bootstrap`, then
  `make frontend-development-install`).
- Chrome, Edge or Firefox. With Safari, also add `127.0.0.1 hub.localhost` to
  `/etc/hosts`.

## First time on a machine

1. **Create your personal settings file** (git-ignored):

   ```sh
   make tchap-env
   ```

   Then edit `src/frontend/apps/hub/.env.tchap.local`:

   ```sh
   FRONTEND_CHAT_ENVIRONMENT=tchap-prod
   ```

2. **If your machine predates the Tchap mode**, re-import the Keycloak
   configuration. This deletes any local Keycloak users you created by hand:

   ```sh
   make reset-keycloak
   ```

3. **Switch to Tchap mode:**

   ```sh
   make run-tchap
   ```

   The command prints the selected environment and asks you to type `y` to
   confirm prod. It then stops dev mode, restarts the backend for the HTTPS
   address, and starts Caddy and a dedicated Next dev server. To follow the
   compilation:

   ```sh
   make logs-tchap
   ```

4. **Trust the local certificate authority**, once per machine:

   ```sh
   make tchap-trust
   ```

   The command prints the exact command for your system: run it, then restart
   the browser. With Firefox on macOS or Windows, also set
   `security.enterprise_roots.enabled` to `true` in `about:config`.

   > This authority can sign certificates for any site. When you no longer test
   > Tchap, remove it, for example "Caddy Local Authority" in Keychain Access on
   > macOS.

5. **Open <https://hub.localhost:9814>**, not `localhost:9800`.

6. **Sign in to the Hub** with a local Keycloak user: `hub` / `hub`.

7. **Sign in to Tchap.** On the "Sign in to LaSuite" page, type the email of
   your Tchap account: local Keycloak users have no Tchap account. The Hub
   redirects you to your Tchap server's sign-in page, with your email
   pre-filled. Choose ProConnect or your password, then
   accept the consent screen for the "LaSuite Hub (dev)" application.

8. **Verify this device.** Back on the Hub, the chat is connected to your
   account. To read encrypted history, verify this new device from
   <https://www.tchap.gouv.fr>, or through "Open encryption settings" in the
   Hub.

## Every day

| Action                            | Command                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| Switch to Tchap mode              | `make run-tchap` (then `y` for prod)                               |
| Show the Tchap frontend logs      | `make logs-tchap`                                                  |
| Stop the Tchap proxy and frontend | `make stop-tchap`                                                  |
| Back to dev mode                  | `make run` (or `make run-backend`)                                 |
| Switch between prod and preprod   | edit `FRONTEND_CHAT_ENVIRONMENT`, then run `make run-tchap` again  |

## Troubleshooting

| Symptom                                                  | Cause and fix                                                                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Certificate warning                                      | The authority is not trusted yet, or `data/caddy/` was recreated. Run `make tchap-trust` again and restart the browser.                                 |
| "Pare-feu applicatif" page (403)                         | You are on `localhost:9800`: open `https://hub.localhost:9814`. In prod, if it persists, stop and report it to the Tchap team.                          |
| Back on `localhost:9800` after sign-in or logout         | The backend is back in dev mode. Run `make run-tchap` again.                                                                                           |
| `make run-tchap` prints "Aborted."                       | You did not answer `y` to the prod confirmation.                                                                                                       |
| "The chat is not configured on this Hub"                 | `FRONTEND_CHAT_ENVIRONMENT` is missing or misspelled in `.env.tchap.local`.                                                                            |
| "Adresse mail … associée au serveur …"                   | The email typed on the Tchap page is not the one typed on the Hub's "Sign in to LaSuite" page.                                                         |
| "The chat server found for your email is not allowed…"   | Your Tchap server is not in the Hub's list, for example a new server. Add it to `src/frontend/apps/hub/src/features/matrix/config.ts`.                 |
| "Your chat account has expired"                          | Renew your account with the link sent to you by email, then try again.                                                                                 |
