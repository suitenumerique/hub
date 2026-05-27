import { fetchAPI } from "@/features/api/fetchApi";

import { Driver, UserFilters } from "../Driver";
import { ApiConfig, User } from "../types";

/**
 * Driver wired to the real Django backend. Only methods that already have a
 * matching endpoint are implemented here — chat-related methods are abstract
 * and provided by `MockDriver` until the backend ships. Once it does, fold
 * those implementations back into this class and delete `MockDriver`.
 */
export abstract class StandardDriver extends Driver {
  async getConfig(): Promise<ApiConfig> {
    const response = await fetchAPI(`config/`);
    const data = await response.json();
    return data;
  }

  async getUsers(filters?: UserFilters): Promise<User[]> {
    const response = await fetchAPI(`users/`, {
      params: filters,
    });
    const data = await response.json();
    return data;
  }

  async updateUser(payload: Partial<User> & { id: string }): Promise<User> {
    const response = await fetchAPI(`users/${payload.id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return data;
  }
}
