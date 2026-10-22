let counter = 0;

/**
 * Short id unique across runs, so every test works with its own people and
 * conversations instead of resetting the homeserver.
 */
export const uniqueId = (): string => {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 5)}`;
};

/** Text unique to one test, so assertions never match a previous run. */
export const uniqueText = (label: string): string => `${label} ${uniqueId()}`;
