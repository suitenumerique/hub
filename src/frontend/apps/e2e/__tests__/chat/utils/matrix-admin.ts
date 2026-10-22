import { execFile } from "child_process";
import { promisify } from "util";

import {
  HOMESERVER_URL,
  KEYCLOAK_REALM,
  KEYCLOAK_URL,
  MAS_CONFIG,
  MAS_CONTAINER,
  MATRIX_SERVER_NAME,
} from "./env";
import { uniqueId } from "./ids";

const run = promisify(execFile);

/** A person of the test: one Hub account, one Matrix account. */
export type TestIdentity = {
  /** Matrix localpart and Keycloak username. */
  localpart: string;
  userId: string;
  displayName: string;
  /** Hub account email, which also owns the Matrix session in the browser. */
  email: string;
  /** Keycloak password, for the people created in Keycloak. */
  password: string;
};

/** A Matrix device signed in with its own access token. */
export type MatrixCredentials = {
  userId: string;
  deviceId: string;
  accessToken: string;
};

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Builds the identity of a new person. The display name carries the unique id
 * too: the local directory finds every user of every previous run.
 */
export const newIdentity = (name: string): TestIdentity => {
  const id = uniqueId();
  const localpart = `e2e-${slug(name)}-${id}`;
  return {
    localpart,
    userId: `@${localpart}:${MATRIX_SERVER_NAME}`,
    displayName: `${name} ${id}`,
    email: `${localpart}@example.com`,
    password: `password-${id}`,
  };
};

const masCli = async (...args: string[]): Promise<string> => {
  try {
    const { stdout, stderr } = await run("docker", [
      "exec",
      MAS_CONTAINER,
      "mas-cli",
      "manage",
      "--config",
      MAS_CONFIG,
      ...args,
    ]);
    // mas-cli logs its results on stderr.
    return `${stdout}\n${stderr}`;
  } catch (error) {
    throw new Error(
      `mas-cli ${args[0]} failed. Is the Matrix stack up (make run-matrix-e2e)?\n${String(error)}`,
    );
  }
};

const keycloakAdminToken = async (): Promise<string> => {
  const response = await fetch(
    `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
    {
      method: "POST",
      body: new URLSearchParams({
        client_id: "admin-cli",
        username: "admin",
        password: "admin",
        grant_type: "password",
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Keycloak admin sign-in failed: ${response.status}`);
  }
  return ((await response.json()) as { access_token: string }).access_token;
};

/** Creates the Keycloak user of the `hub` realm. */
const createKeycloakUser = async (identity: TestIdentity): Promise<void> => {
  const token = await keycloakAdminToken();
  const users = `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`;
  const [firstName, lastName] = identity.displayName.split(" ");
  const created = await fetch(users, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: identity.localpart,
      email: identity.email,
      firstName,
      lastName,
      enabled: true,
      emailVerified: true,
      credentials: [
        { type: "password", value: identity.password, temporary: false },
      ],
    }),
  });
  if (!created.ok) {
    throw new Error(`Keycloak user creation failed: ${created.status}`);
  }
};

/** Registers a person in MAS, which provisions the Synapse account. */
export const registerIdentity = async (
  identity: TestIdentity,
): Promise<void> => {
  await masCli(
    "register-user",
    "--yes",
    "--display-name",
    identity.displayName,
    identity.localpart,
  );
};

/** Creates a Keycloak user without a Matrix account (first real sign-in). */
export const registerKeycloakOnly = async (
  identity: TestIdentity,
): Promise<void> => {
  await createKeycloakUser(identity);
};

/**
 * Signs a new device in, like a client would, without the OIDC chain:
 * compatibility tokens have no expiry and no refresh token.
 */
export const issueDevice = async (
  identity: TestIdentity,
  deviceId?: string,
): Promise<MatrixCredentials> => {
  const output = await masCli(
    "issue-compatibility-token",
    identity.localpart,
    ...(deviceId ? [deviceId] : []),
  );
  const accessToken = /Compatibility token issued: (\S+)/.exec(output)?.[1];
  if (!accessToken) {
    throw new Error(`No compatibility token for ${identity.localpart}.`);
  }
  const whoami = await fetch(
    `${HOMESERVER_URL}/_matrix/client/v3/account/whoami`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!whoami.ok) {
    throw new Error(`whoami failed for ${identity.localpart}.`);
  }
  const { user_id: userId, device_id: issuedDeviceId } =
    (await whoami.json()) as { user_id: string; device_id: string };
  return { userId, deviceId: issuedDeviceId, accessToken };
};
