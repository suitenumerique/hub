import { fetchAPI } from "@/features/api/fetchApi";
import type {
  ApiConfig,
  ChatAccountConfig,
  ChatScope,
  User,
} from "@/features/drivers/types";

export type UserFilters = {
  q?: string;
};

export interface HubApi {
  getConfig(): Promise<ApiConfig>;
  getUsers(filters?: UserFilters): Promise<User[]>;
  updateUser(payload: Partial<User> & { id: string }): Promise<User>;
  getChatScopes(): Promise<ChatScope[]>;
  getChatAccounts(scopeId?: string): Promise<ChatAccountConfig[]>;
}

export const DEFAULT_CHAT_SCOPE_ID = "mock-aggregate";

const MOCK_MAIN_ACCOUNT: ChatAccountConfig = {
  accountId: "mock-main",
  kind: "mock",
  label: "Hub",
  criticality: "required",
  enabled: true,
  settings: {
    nameSuffix: "",
    lastActivityOffsetMinutes: 0,
  },
};

const MOCK_SUPPORT_ACCOUNT: ChatAccountConfig = {
  accountId: "mock-support",
  kind: "mock",
  label: "Support",
  criticality: "optional",
  enabled: true,
  settings: {
    nameSuffix: "Support",
    lastActivityOffsetMinutes: 12,
  },
};

// Dev-only: a single real Matrix account pointing at the Tchap dev homeserver,
// surfaced as its own scope so it can be toggled from the left-panel dropdown
// without disturbing the mock scopes. No `settings` means the Matrix driver
// parses the default Tchap preset.
const MATRIX_DEV_ACCOUNT: ChatAccountConfig = {
  accountId: "matrix-dev",
  kind: "matrix",
  label: "Tchap",
  criticality: "required",
  enabled: true,
};

// Dev-only: a Matrix account pointing at the local Synapse/MAS stack started by
// `make run-matrix`. Fixed discovery skips Tchap email lookup and targets the
// homeserver directly. The stable MAS client id matches the local config.
const MATRIX_LOCAL_ACCOUNT: ChatAccountConfig = {
  accountId: "matrix-local",
  kind: "matrix",
  label: "Matrix local",
  criticality: "required",
  enabled: true,
  settings: {
    discovery: "fixed",
    baseUrl: "http://localhost:9808",
    serverName: "localhost",
    oidcClientId: "01J00000000000000000000000",
    branding: {
      clientName: "Hub",
      logoUri: "http://localhost:9800/assets/logo-icon.svg",
    },
    autoJoinInvites: false,
  },
};

export const DEFAULT_CHAT_SCOPES: ChatScope[] = [
  {
    scopeId: DEFAULT_CHAT_SCOPE_ID,
    label: "Tous les serveurs mockés",
    kind: "aggregate",
    isDefault: true,
    accounts: [MOCK_MAIN_ACCOUNT, MOCK_SUPPORT_ACCOUNT],
  },
  {
    scopeId: "mock-hub",
    label: "Hub",
    kind: "server",
    accounts: [MOCK_MAIN_ACCOUNT],
  },
  {
    scopeId: "mock-support",
    label: "Support",
    kind: "server",
    accounts: [{ ...MOCK_SUPPORT_ACCOUNT, criticality: "required" }],
  },
  {
    scopeId: "matrix-dev",
    label: "Tchap (Matrix dev)",
    kind: "server",
    accounts: [MATRIX_DEV_ACCOUNT],
  },
  {
    scopeId: "matrix-local",
    label: "Matrix local (dev)",
    kind: "server",
    accounts: [MATRIX_LOCAL_ACCOUNT],
  },
];

export class StandardHubApi implements HubApi {
  async getConfig(): Promise<ApiConfig> {
    const response = await fetchAPI(`config/`);
    return response.json();
  }

  async getUsers(filters?: UserFilters): Promise<User[]> {
    const response = await fetchAPI(`users/`, {
      params: filters,
    });
    return response.json();
  }

  async updateUser(payload: Partial<User> & { id: string }): Promise<User> {
    const response = await fetchAPI(`users/${payload.id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return response.json();
  }

  async getChatScopes(): Promise<ChatScope[]> {
    return DEFAULT_CHAT_SCOPES;
  }

  async getChatAccounts(
    scopeId = DEFAULT_CHAT_SCOPE_ID,
  ): Promise<ChatAccountConfig[]> {
    const scope =
      DEFAULT_CHAT_SCOPES.find((candidate) => candidate.scopeId === scopeId) ??
      DEFAULT_CHAT_SCOPES.find((candidate) => candidate.isDefault) ??
      DEFAULT_CHAT_SCOPES[0];

    return scope?.accounts ?? [];
  }
}

let hubApi: HubApi = new StandardHubApi();

export const getHubApi = (): HubApi => hubApi;

export const setHubApiForTests = (api: HubApi): void => {
  hubApi = api;
};

export const resetHubApiForTests = (): void => {
  hubApi = new StandardHubApi();
};
