import { useQuery } from "@tanstack/react-query";

import { getHubApi } from "./HubApi";

export function useApiConfig() {
  const hubApi = getHubApi();
  return useQuery({
    queryKey: ["config"],
    queryFn: () => hubApi.getConfig(),
    staleTime: 1000,
  });
}
