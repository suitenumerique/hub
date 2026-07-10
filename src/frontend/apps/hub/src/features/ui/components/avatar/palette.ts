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

const hashString = (value: string): number => {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
};

/**
 * Deterministic palette colour for a seed, so an identity keeps the same colour
 * everywhere it is rendered. Lives with the palette rather than in the `Avatar`
 * component so non-React callers (the chat drivers, which precompute an author's
 * colour) share this exact hash instead of mirroring it.
 */
export const hashAvatarColor = (seed: string): AvatarColor =>
  AVATAR_COLORS[hashString(seed) % AVATAR_COLORS.length];
