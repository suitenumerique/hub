import { ApiConfig, User } from "./types";

export type UserFilters = {
  q?: string;
};

export abstract class Driver {
  abstract getConfig(): Promise<ApiConfig>;
  abstract getUsers(filters?: UserFilters): Promise<User[]>;
  abstract updateUser(payload: Partial<User> & { id: string }): Promise<User>;
}
