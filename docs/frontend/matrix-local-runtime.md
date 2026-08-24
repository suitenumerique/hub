# Local Matrix Chat Runtime

The Hub frontend currently exposes one chat account: `matrix-local`. It connects
to the local Synapse homeserver at `http://localhost:9808` through the
pre-registered MAS OAuth client. There is no runtime server selector, remote
homeserver discovery, or fallback chat data.

## Start the Runtime

Start Matrix explicitly; `make run` does not include it.

```shellscript
$ make run-matrix
$ make seed-matrix # optional: deterministic local rooms and messages
$ make run-frontend-development
```

The frontend is available at <http://localhost:9800>. `make run-matrix` also
starts the backend services needed by the local Keycloak realm. The Matrix
stack and its databases remain managed by the existing Compose overlay.

## Runtime Manifest

`features/config/Config.ts` defines the only active account and passes its fixed
settings to `LazyMatrixDriver`:

- account id: `matrix-local`;
- homeserver: `http://localhost:9808`;
- server name: `localhost`;
- OAuth client: the client pre-registered in MAS.

Malformed or incomplete Matrix settings fail explicitly. The frontend never
selects another driver from a query parameter or environment variable.

## Preserved Extension Seams

The local-only product behavior does not collapse the architecture to global
singletons:

- the account manifest remains an array;
- `Driver` remains the backend-neutral contract and `LazyMatrixDriver` keeps
  Matrix SDK code out of the initial bundle;
- `DriverRegistry` still owns one driver instance per `accountId`;
- `ChatRef` always contains both `accountId` and `chatId`;
- routes remain `/chat?account=matrix-local&chat=...`;
- React Query keys, local storage, session storage, IndexedDB sync stores, and
  crypto stores remain account-scoped.

These seams allow a future configured Matrix account or server to be added by
extending the manifest and account provisioning. A future account/server
selector can reconcile a different manifest into the same registry. It must not
remove `accountId` from routes or caches, even when only one account is active.

## Routing and Availability

Routes whose account is absent from the active manifest return to `/chat/new`.
This includes links created by removed development accounts.

Rooms, messages, reactions, threads, typing, favourites, invitations, unread
state, conversation creation, and history removal are backed by Matrix. The
Documents tab remains visible but reports that it is unavailable; it performs
no query and exposes no sample file or preview.

## Authentication and Persistence

The driver obtains delegated-auth metadata from the fixed homeserver and builds
the authorization URL with the configured MAS client id. Dynamic client
registration is not supported. OIDC sessions and refresh tokens remain
persisted per account and user, while Matrix sync and crypto keep their
account-scoped IndexedDB stores.
