/**
 * Addresses of the local stack used by the chat suites: the Hub, its backend,
 * and the dev-only Matrix stack started by `make run-matrix-e2e`.
 */
export const HUB_URL = process.env.BASE_URL ?? "http://localhost:9800";
export const HUB_API_URL =
  process.env.BASE_API_URL ?? "http://localhost:9801/api/v1.0";

export const HOMESERVER_URL =
  process.env.MATRIX_HOMESERVER_URL ?? "http://localhost:9808";
export const MATRIX_SERVER_NAME = "localhost";
export const MAS_URL = process.env.MAS_URL ?? "http://localhost:9810";
export const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? "http://localhost:9803";
export const KEYCLOAK_REALM = "hub";

/** Docker container running MAS, used for `mas-cli manage` commands. */
export const MAS_CONTAINER = process.env.MAS_CONTAINER ?? "hub-mas-1";
export const MAS_CONFIG = "/config/config.yaml";

/** Chat account of the `local` environment (`MATRIX_LOCAL_ACCOUNT_ID`). */
export const CHAT_ACCOUNT_ID = "matrix-local";

/** Chat journeys sync two clients through a real homeserver. */
export const CHAT_TEST_TIMEOUT = 120_000;
/** How long a client may take to see what another client did. */
export const SYNC_TIMEOUT = 20_000;
