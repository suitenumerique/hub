# Professional roles

Open the account menu, then **My role** to set, change or remove a label.
PO, PM, DEV, Design, QA and Ops are suggested; custom titles can contain up to
40 characters. The field is optional. There is no first-login prompt and no
People integration.

The role is stored in the Hub user profile and displayed beside message and
thread authors, in people search, direct-chat headers and the members list.
It is global, independent of conversation membership and access permissions.

`GET /api/v1.0/profile-role/` reads the signed-in user's role. `PATCH` accepts
`role` and a transient `matrix_access_token` from the connected driver. Hub
verifies that token with `/_matrix/client/v3/account/whoami` on its configured
`MATRIX_HOMESERVER_URL`, then links the returned id to the current Hub user.
The URL cannot be supplied by the caller. Tokens are neither persisted nor
returned. An existing identity link cannot be transferred or replaced through
the role editor. A failing verification preserves the previous role.

`GET /api/v1.0/user-roles/?id=<matrix-id>` returns only requested active users'
labels (up to 50 ids). React Query shares a cache per viewer and Matrix user,
so showing many messages from one author does not query once per message.
Saving invalidates the local role cache; other viewers refresh stale labels
on focus or navigation after one minute.

Apply the backend migration before starting the updated application:
`python manage.py migrate`. The configured Matrix homeserver must be the one
used by the frontend account.
