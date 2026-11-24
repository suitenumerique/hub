export const groupKeys = {
  /** The current user's groups. */
  list: () => ["groups", "list"] as const,
  accesses: (groupId: string) => ["groups", groupId, "accesses"] as const,
  files: (groupId: string) => ["groups", groupId, "files"] as const,
};
