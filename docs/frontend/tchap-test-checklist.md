# Tchap test checklist

Manual tests of the Hub chat against Tchap, run by the account owner with
their own account. Set up the HTTPS origin first
([Tchap connection guide](tchap-connection.md)). Run preprod completely before
prod.

## Before you start

- Use Chrome or Firefox on `https://hub.localhost:9814`.
- Open DevTools: **Network** with "Preserve log" checked, and **Console**.
- Keep Tchap web open in another tab as the reference client
  (`https://www.beta.tchap.gouv.fr` in preprod) and, ideally, a colleague
  willing to exchange a few messages.
- Record each scenario as OK, KO or Partial.

### What to send back for a KO

- The scenario number and what you expected.
- A screenshot of the page.
- The failing request: method, URL, status and response body (Network tab).
- The console errors.

**Never send tokens or passwords.** Remove the `Authorization` header and any
`access_token`, `refresh_token`, `code` or `id_token` value before sharing. A
response body from `/oauth2/token` must not be shared.

## 1. Sign-in

| # | Steps | Expected |
| --- | --- | --- |
| 1.1 | Open the Hub, sign in with a local Keycloak user. | A request `GET matrix.<i\|a\|e>.tchap.gouv.fr/_matrix/identity/api/v1/info?...` returns `{"hs": "i.tchap.gouv.fr"}` (your server). |
| 1.2 | Same login. | `POST https://auth.i.tchap.gouv.fr/oauth2/registration` returns **201** with a `client_id`. |
| 1.3 | Same login. | Redirect to `auth.i.tchap.gouv.fr/login` with your email pre-filled. Sign in with ProConnect or your password, then accept the consent page. |
| 1.4 | Back on the Hub. | The URL returns to `https://hub.localhost:9814/` (the `code` disappears), then your conversations appear. `GET .../whoami` returns `@…:i.tchap.gouv.fr`. |
| 1.5 | Reload the page. | The chat reconnects without going back to Tchap. |
| 1.6 | Leave the tab open 10 minutes, then send a message. | `POST auth.i…/oauth2/token` (refresh) returns 200; no sign-in page; the message is sent. |
| 1.7 | Log out of the Hub, log in again. | The chat reconnects without a new Tchap sign-in. On `https://auth.i.tchap.gouv.fr/account`, no new Hub session is added. |

### Failure handling

| # | Steps | Expected |
| --- | --- | --- |
| 1.8 | In a private window, start the sign-in and cancel on the Tchap page (or refuse consent). | The Hub shows "Signing in to the chat did not succeed" with Tchap's explanation, and does **not** loop back to Tchap. "Try again" starts a new sign-in. |
| 1.9 | Private window. DevTools > Network > right-click > **Block request domain** on two of `matrix.i`, `matrix.a`, `matrix.e`. Sign in. | Blocked lookups appear in red, the third server answers, sign-in continues. Unblock afterwards. |
| 1.10 | Private window, block all three domains. | After a few retries: "Chat connection interrupted" (servers unavailable). No sign-in page. |

## 2. Encryption

Most Tchap conversations are encrypted. The Hub is a new device on your account.

| # | Steps | Expected |
| --- | --- | --- |
| 2.1 | After the first sign-in, look at the composer and the avatar menu. | The Hub asks to verify this device. |
| 2.2 | Verify the Hub from Tchap web (emoji comparison), or with your recovery key. | The device becomes verified in both clients. |
| 2.3 | Open an old encrypted conversation. | History is readable once the keys are restored from the backup. |
| 2.4 | Send a message in an encrypted conversation. | Tchap web shows it, without "unable to decrypt". |

## 3. Conversations

| # | Steps | Expected |
| --- | --- | --- |
| 3.1 | Look at the conversation list. | Same direct and group conversations as in Tchap web, with names and avatars or initials. Favourites match. |
| 3.2 | Open a conversation and scroll up. | Older messages load. |
| 3.3 | Send a text message. | It appears once in the Hub and in Tchap web. |
| 3.4 | Reply from Tchap web. | It appears live in the Hub; the unread state updates. |
| 3.5 | Edit, then delete one of your messages. | Both clients reflect it. |
| 3.6 | Add and remove a reaction, in both directions. | Counts match in both clients. |
| 3.7 | Reply in a thread, start a thread, both directions. | Threads and reply counts match. |
| 3.8 | Type in both clients. | The typing indicator shows on the other side. |
| 3.9 | Read a conversation in Tchap web. | It is marked read in the Hub. |

## 4. Files

| # | Steps | Expected |
| --- | --- | --- |
| 4.1 | Send an image and a PDF, in a plain and an encrypted conversation. | Upload succeeds; Tchap web shows and opens them. |
| 4.2 | Receive an image and a PDF from Tchap web. | Inline image, preview and download work. Tchap scans files: note any file that stays unavailable. |
| 4.3 | Send a file above 20 MB. | The Hub refuses it before upload. |

## 5. People and conversation creation

| # | Steps | Expected |
| --- | --- | --- |
| 5.1 | Search a colleague by name in "New chat". | They appear. Results may be partial: note who is missing. |
| 5.2 | Create a direct conversation with one colleague. | Created; Tchap web shows it as a direct conversation. |
| 5.3 | Create a group with two colleagues. | Created and visible in Tchap web. |
| 5.4 | Invite an external address (`e` server) into a group. | Tchap rules may refuse it: note the message shown. |
| 5.5 | Receive an invitation from Tchap web and accept it in the Hub. | The conversation opens. |
| 5.6 | Leave a conversation / remove it from history. | It disappears; Tchap web shows you left. |

## 6. Prod (after preprod)

Only with your own authorised account and the Tchap team's agreement. Set
`NEXT_PUBLIC_MATRIX_ENVIRONMENT=tchap-prod`, run `make run-tchap`, then run
only:

- 1.1 to 1.5 (sign-in, reload). If the Tchap page shows "Pare-feu applicatif",
  stop and report it: the prod firewall is stricter than preprod.
- 2.1 to 2.3 (encryption), 3.1 to 3.4 (read and send) in an existing
  conversation with a colleague who agreed, 4.2 (receive a file).

Do not create test conversations or invite people in prod.
