/** Extensions of the files a meeting accepts from the user's device. */
export const TEXT_FILE_EXTENSIONS = [".txt", ".md"] as const;

/** `accept` value of the meeting file pickers. */
export const TEXT_FILE_ACCEPT = [
  ...TEXT_FILE_EXTENSIONS,
  "text/plain",
  "text/markdown",
].join(",");

/**
 * Whether a file can be attached to a meeting (agenda or documents). The
 * picker's `accept` is only a hint (the user can pick "All files"), so the name
 * is checked again.
 */
export const isTextFile = (fileName: string): boolean => {
  const name = fileName.trim().toLowerCase();
  return TEXT_FILE_EXTENSIONS.some(
    (extension) => name.endsWith(extension) && name.length > extension.length,
  );
};
