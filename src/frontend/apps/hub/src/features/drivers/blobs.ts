/**
 * Attachment bytes are shown through `blob:` URLs, which belong to the Hub
 * origin. A blob typed as HTML or SVG and opened in its own tab (e.g. "Open
 * image in new tab") would run its scripts with access to the Hub session, so
 * only types browsers render without scripting keep their declared type.
 *
 * Mirrors Element Web's list (`src/utils/blobs.ts`), plus `application/pdf`,
 * which the file preview opens in a tab to print it. SVG must never be added,
 * even though current browsers no longer render it typed as
 * `application/octet-stream`: SVG attachments are offered for download only.
 */
const SAFE_BLOB_TYPES = new Set([
  "image/jpeg",
  "image/gif",
  "image/png",
  "image/apng",
  "image/webp",
  "image/avif",

  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",

  "audio/mp4",
  "audio/webm",
  "audio/aac",
  "audio/mpeg",
  "audio/ogg",
  "audio/wave",
  "audio/wav",
  "audio/x-wav",
  "audio/x-pn-wav",
  "audio/flac",
  "audio/x-flac",

  "application/pdf",
]);

/** The declared type when it is safe in a blob, `application/octet-stream` otherwise. */
export const safeBlobType = (mimetype: string): string => {
  const type = mimetype.split(";")[0].trim().toLowerCase();
  return SAFE_BLOB_TYPES.has(type) ? type : "application/octet-stream";
};

/** Same bytes, retyped with `safeBlobType` (no copy is made). */
export const withSafeBlobType = (blob: Blob, mimetype: string): Blob => {
  const type = safeBlobType(mimetype);
  return blob.type === type ? blob : blob.slice(0, blob.size, type);
};
