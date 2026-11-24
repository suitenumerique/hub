import { fetchAPI } from "@/features/api/fetchApi";
import type { ApiConfig, User } from "@/features/drivers/types";
import { DEMO_ACCESSES, DEMO_GROUPS } from "@/features/groups/demoGroups";
import type {
  AddGroupAccessesPayload,
  CreateGroupPayload,
  Group,
  GroupAccess,
  GroupRole,
  UpdateGroupPayload,
} from "@/features/groups/types";

export type UserFilters = {
  q?: string;
};

export interface HubApi {
  getConfig(): Promise<ApiConfig>;
  getUsers(filters?: UserFilters): Promise<User[]>;
  updateUser(payload: Partial<User> & { id: string }): Promise<User>;
  getGroups(): Promise<Group[]>;
  createGroup(payload: CreateGroupPayload): Promise<Group | undefined>;
  updateGroup(
    groupId: string,
    payload: UpdateGroupPayload,
  ): Promise<Group | undefined>;
  getGroupAccesses(groupId: string): Promise<GroupAccess[]>;
  addGroupAccesses(
    groupId: string,
    payload: AddGroupAccessesPayload,
  ): Promise<void>;
  updateGroupAccess(
    groupId: string,
    accessId: string,
    role: GroupRole,
  ): Promise<void>;
  deleteGroupAccess(groupId: string, accessId: string): Promise<void>;
}

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

  // Groups (#173). The backend routes do not exist yet: each call is logged,
  // and the real one is ready below it. To connect a method, uncomment its
  // call, check the address, and delete the log and the hard-coded return.

  async getGroups(): Promise<Group[]> {
    console.log("[groups] GET groups/");
    // const response = await fetchAPI(`groups/`, undefined, {
    //   redirectOn40x: false,
    // });
    // return response.json();
    return DEMO_GROUPS;
  }

  async createGroup(payload: CreateGroupPayload): Promise<Group | undefined> {
    console.log("[groups] POST groups/", payload);
    // const response = await fetchAPI(
    //   `groups/`,
    //   { method: "POST", body: JSON.stringify(payload) },
    //   { redirectOn40x: false },
    // );
    // return response.json();
    return undefined;
  }

  async updateGroup(
    groupId: string,
    payload: UpdateGroupPayload,
  ): Promise<Group | undefined> {
    console.log(`[groups] PATCH groups/${groupId}/`, payload);
    // const response = await fetchAPI(
    //   `groups/${groupId}/`,
    //   { method: "PATCH", body: JSON.stringify(payload) },
    //   { redirectOn40x: false },
    // );
    // return response.json();
    return undefined;
  }

  async getGroupAccesses(groupId: string): Promise<GroupAccess[]> {
    console.log(`[groups] GET groups/${groupId}/accesses/`);
    // const response = await fetchAPI(
    //   `groups/${groupId}/accesses/`,
    //   undefined,
    //   { redirectOn40x: false },
    // );
    // return response.json();
    return DEMO_ACCESSES;
  }

  async addGroupAccesses(
    groupId: string,
    payload: AddGroupAccessesPayload,
  ): Promise<void> {
    console.log(`[groups] POST groups/${groupId}/accesses/`, payload);
    // await fetchAPI(
    //   `groups/${groupId}/accesses/`,
    //   { method: "POST", body: JSON.stringify(payload) },
    //   { redirectOn40x: false },
    // );
  }

  async updateGroupAccess(
    groupId: string,
    accessId: string,
    role: GroupRole,
  ): Promise<void> {
    console.log(`[groups] PATCH groups/${groupId}/accesses/${accessId}/`, {
      role,
    });
    // await fetchAPI(
    //   `groups/${groupId}/accesses/${accessId}/`,
    //   { method: "PATCH", body: JSON.stringify({ role }) },
    //   { redirectOn40x: false },
    // );
  }

  async deleteGroupAccess(groupId: string, accessId: string): Promise<void> {
    console.log(`[groups] DELETE groups/${groupId}/accesses/${accessId}/`);
    // await fetchAPI(
    //   `groups/${groupId}/accesses/${accessId}/`,
    //   { method: "DELETE" },
    //   { redirectOn40x: false },
    // );
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
