export const AVATAR_COLORS = [
  "blue-1",
  "blue-2",
  "brand",
  "brown",
  "gray",
  "green",
  "orange",
  "pink",
  "purple",
  "red",
  "yellow",
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];
