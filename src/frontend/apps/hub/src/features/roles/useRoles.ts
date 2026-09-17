import { useQueries, useQuery } from "@tanstack/react-query";

import { fetchAPI } from "@/features/api/fetchApi";
import { useAuth } from "@/features/auth/Auth";

export type RoleProfile = {
  role: string;
  matrix_id: string | null;
};

export const roleProfileKey = (userId: string) => ["role-profile", userId];

export const useRoleProfile = (enabled = true) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: roleProfileKey(user?.id ?? ""),
    queryFn: async (): Promise<RoleProfile> =>
      (
        await fetchAPI("profile-role/", undefined, { redirectOn40x: false })
      ).json(),
    enabled: Boolean(user) && enabled,
    staleTime: 60_000,
    retry: false,
    meta: { noGlobalError: true },
  });
};

/** One cached lookup per person, shared by messages, search and member rows. */
export const useUserRoles = (ids: string[]) => {
  const { user, chatUser } = useAuth();
  const unique = [...new Set(ids)].filter(Boolean);
  const queries = useQueries({
    queries: unique.map((authorId) => {
      // Thread authors use the driver-neutral "me" marker for the viewer.
      const id = authorId === "me" ? (chatUser?.userId ?? "") : authorId;
      return {
        queryKey: ["user-role", user?.id, id],
        queryFn: async (): Promise<string> => {
          const response = await fetchAPI(
            "user-roles/",
            { params: { id } },
            { redirectOn40x: false },
          );
          const data: Record<string, string> = await response.json();
          return data[id] ?? "";
        },
        enabled: Boolean(user) && Boolean(id),
        staleTime: 60_000,
        retry: false,
        meta: { noGlobalError: true },
      };
    }),
  });
  return Object.fromEntries(
    unique.map((id, index) => [id, queries[index].data ?? ""]),
  );
};
