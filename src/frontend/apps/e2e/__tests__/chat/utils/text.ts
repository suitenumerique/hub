export const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches exactly `value`, for texts that also appear inside longer ones. */
export const exactly = (value: string): RegExp =>
  new RegExp(`^${escapeRegExp(value)}$`);

/** Matches text starting with `value`. */
export const startingWith = (value: string): RegExp =>
  new RegExp(`^${escapeRegExp(value)}`);
