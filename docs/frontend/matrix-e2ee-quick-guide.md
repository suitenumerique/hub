# Reset and test E2EE locally

Manual walkthrough using an existing development stack with Docker running.
Local Element acts as the reference client alongside Hub.

## 1. Reset Matrix

**This reset deletes local Matrix rooms, messages, and sessions.** Hub and
Keycloak data are preserved. Close Hub and Element tabs in all browser profiles
before running the following command from the project root:

```sh
make reset-matrix-e2ee
```

The command restarts Matrix and recreates users without creating any rooms. Wait
for `Done (users only; no rooms created)` and the final reset confirmation.
Do not run `make seed-matrix` afterwards: it creates unencrypted conversations.

If the frontend is not already running, open another terminal at the project root:

```sh
make run-frontend-development
```

## 2. Clear browser data

Resetting the server does not remove old keys from the browser. In each profile
used for testing, clear **both origins separately**:

- Hub: open <http://localhost:9800/assets/logo-icon.svg>.
- Element: open <http://localhost:9807/themes/element/img/logos/element-logo.svg>.

These static pages let you clear storage without restarting the Matrix engine.
For each page, open DevTools (`⌥⌘I` on Mac), then **Application → Storage**:

1. Select Local Storage, IndexedDB, Cache Storage, and any service workers.
   **Uncheck Cookies and third-party cookies**: localhost cookies are shared
   across ports.
2. Click **Clear site data**. Also clear **Session Storage** for this origin if
   any entries remain.
3. Check that the old IndexedDB databases are gone. If deletion is blocked,
   close the application's other tabs and try again.
4. Close the cleanup pages before reopening the applications.

## 3. Prepare both accounts in Element

Use two independent browser profiles: for example, a regular Chrome window for A
and an incognito window for B. Keep the incognito window open throughout the test.

| Person | Applications | Local SSO username | Local password |
| --- | --- | --- | --- |
| A | Element + Hub | `hub` | `hub` |
| B | Element | `user-e2e-chromium` | `password-e2e-chromium` |

1. In **both profiles**, open <http://localhost:9807> and sign in using SSO.
2. In Element, open **avatar → Settings / Security & Privacy → Encryption**.
   Check that key storage and backup are enabled. Save the recovery key for
   **each account**, clearly identifying which account it belongs to.
3. Wait until both accounts are ready before creating the conversation.

## 4. Create message history, then verify Hub

1. In **B's Element**, start a private conversation with `@hub:localhost`.
   Accept the invitation in **A's Element** and check that the conversation
   displays **Encryption enabled**.
2. From B, send `Message before signing in to Hub`. Read it in A's Element.
3. In profile **A**, open <http://localhost:9800> in a new tab and sign in as
   `hub`. If a Matrix consent screen appears, check the account shown.
   A's Hub and Element must both use **`@hub:localhost`**, with distinct device IDs.
4. Open the conversation. Sending encrypted messages must be blocked before
   verification.
5. In Hub, open **avatar → Encryption → Verify this device**. The encryption
   setup button above the composer opens the same settings.
6. Accept the request in **A's Element**. Compare all seven emojis in the same
   order, then confirm **in both applications** only if they match. If three
   numbers are displayed instead, compare those three numbers.
7. Wait for **This device: Verified** and **Backup and history: Active**.
   In particular, check that `Message before signing in to Hub` becomes readable
   in Hub.

## 5. Check the results

- [ ] The message sent before signing in to Hub is readable: history was recovered.
- [ ] A message sent from Hub A is readable in Element B, and vice versa.
- [ ] After reloading Hub, the session remains verified and messages remain readable.
- [ ] After closing Element A, exchanges between Hub A and Element B still work.
- [ ] A second Hub tab in the same profile is blocked; the first remains usable.
      Close the additional tab after checking.

If keys take time to arrive, keep Element A open and unlocked. In **Encryption**,
follow the explanation shown and use **Retry recovery** when the button appears.
Counters are available under **Technical details**. Successful verification does
not guarantee recovery of messages whose keys are missing from the backup.
Attachments remain outside the scope of this walkthrough.

For service configuration, see [local Matrix runtime](matrix-local-runtime.md).
