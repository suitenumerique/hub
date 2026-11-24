export const groupKeys = {
  /** The current user's groups. */
  list: () => ["groups"] as const,
  accesses: (groupId: string) => ["groups", groupId, "accesses"] as const,
};
