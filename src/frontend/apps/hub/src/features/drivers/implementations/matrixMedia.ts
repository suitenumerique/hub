/**
 * Matrix media attachments: the `m.image` / `m.file` / `m.video` / `m.audio`
 * message content, the client-side encryption Matrix requires for files
 * posted in encrypted rooms (delegated to `matrix-encrypt-attachment`, the
 * library Element Web uses), their thumbnails, and the media repository
 * requests.
 *
 * Storage is a homeserver concern (Synapse's media repository, backed by local
 * disk or an object store): the client only uploads bytes and keeps the
 * returned `mxc://` URI, plus the decryption key when the room is encrypted.
 *
 * @see https://spec.matrix.org/v1.11/client-server-api/#sending-encrypted-attachments
 */
import {
  decryptAttachment,
  encryptAttachment as encryptFileContent,
} from "matrix-encrypt-attachment";
import { type MatrixClient, Method, MsgType } from "matrix-js-sdk/lib/matrix";
import type { EncryptedFile } from "matrix-js-sdk/lib/types";

import { withSafeBlobType } from "../blobs";
import type { ChatAttachment } from "../types";

/** Authenticated media endpoints (MSC3916, Matrix 1.11). */
const MATRIX_MEDIA_PREFIX = "/_matrix/client/v1/media";
// Synapse pre-generates an 800x600 "scale" thumbnail, about twice the inline
// image width; larger originals are only fetched for the file preview. Images
// sent to encrypted rooms carry a client-made thumbnail of the same size.
const MATRIX_THUMBNAIL_WIDTH = 800;
const MATRIX_THUMBNAIL_HEIGHT = 600;

/** Decryption material of an encrypted file, whose `url` is kept apart. */
export type EncryptedFileKeys = Omit<EncryptedFile, "url">;

/** Where some media bytes are stored, and how to decrypt them if needed. */
export type MatrixMediaLocation = {
  /** `mxc://` URI of the stored (possibly encrypted) bytes. */
  url: string;
  /** Decryption material; present only for files of encrypted rooms. */
  file?: EncryptedFileKeys;
};

/** `info.thumbnail_info` of an image message. */
export type MatrixThumbnailInfo = {
  mimetype?: string;
  size?: number;
  w?: number;
  h?: number;
};

/** Driver-owned shape of `ChatAttachment.source` for Matrix media. */
export type MatrixAttachmentSource = MatrixMediaLocation & {
  /**
   * Smaller rendition attached by the sender (`info.thumbnail_*`). Encrypted
   * images need one: the server cannot thumbnail bytes it cannot read.
   */
  thumbnail?: MatrixMediaLocation & { info?: MatrixThumbnailInfo };
};

const ATTACHMENT_MSGTYPES = new Set<string>([
  MsgType.Image,
  MsgType.File,
  MsgType.Video,
  MsgType.Audio,
]);

/** Image types every browser renders, so they are safe to show inline. */
const INLINE_IMAGE_MIMETYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);

export const isInlineImage = (mimetype: string): boolean =>
  INLINE_IMAGE_MIMETYPES.has(mimetype.toLowerCase());

type MediaInfo = {
  mimetype?: unknown;
  size?: unknown;
  w?: unknown;
  h?: unknown;
};

type MediaEventContent = {
  msgtype?: string;
  body?: unknown;
  filename?: unknown;
  url?: unknown;
  file?: unknown;
  info?: MediaInfo & {
    thumbnail_url?: unknown;
    thumbnail_file?: unknown;
    thumbnail_info?: MediaInfo;
  };
};

const positiveNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;

const isMxcUrl = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("mxc://");

/**
 * Reads media stored in clear (`url`) or encrypted (`file`). The content comes
 * from any client: an encrypted file missing its key, IV or hash cannot be
 * decrypted, so it is rejected like a missing URL.
 */
const parseMediaLocation = (
  url: unknown,
  file: unknown,
): MatrixMediaLocation | null => {
  if (file === undefined || file === null) {
    return isMxcUrl(url) ? { url } : null;
  }
  if (typeof file !== "object") {
    return null;
  }
  const encrypted = file as Partial<EncryptedFile>;
  if (
    !isMxcUrl(encrypted.url) ||
    typeof encrypted.key?.k !== "string" ||
    typeof encrypted.iv !== "string" ||
    typeof encrypted.hashes?.sha256 !== "string"
  ) {
    return null;
  }
  return {
    url: encrypted.url,
    file: {
      key: encrypted.key,
      iv: encrypted.iv,
      hashes: encrypted.hashes,
      v: nonEmptyString(encrypted.v) ?? "v2",
    },
  };
};

const parseThumbnail = (
  info: MediaEventContent["info"],
): MatrixAttachmentSource["thumbnail"] => {
  const location = parseMediaLocation(
    info?.thumbnail_url,
    info?.thumbnail_file,
  );
  if (!location) {
    return undefined;
  }
  const thumbnailInfo = info?.thumbnail_info;
  return {
    ...location,
    info: {
      mimetype: nonEmptyString(thumbnailInfo?.mimetype),
      size: positiveNumber(thumbnailInfo?.size),
      w: positiveNumber(thumbnailInfo?.w),
      h: positiveNumber(thumbnailInfo?.h),
    },
  };
};

/**
 * Maps a media message content to a `ChatAttachment` and its caption. Returns
 * `null` for text messages and for media whose content is unusable.
 */
export const parseMatrixAttachment = (
  content: MediaEventContent,
): { attachment: ChatAttachment; caption: string } | null => {
  if (!content.msgtype || !ATTACHMENT_MSGTYPES.has(content.msgtype)) {
    return null;
  }
  const location = parseMediaLocation(content.url, content.file);
  if (!location) {
    return null;
  }
  const body = typeof content.body === "string" ? content.body : "";
  const filename =
    typeof content.filename === "string" && content.filename
      ? content.filename
      : undefined;
  const name = filename ?? body;
  // Matrix 1.10 captions: `body` differs from `filename` only when it is text
  // the sender typed alongside the file.
  const caption = filename && body !== filename ? body : "";
  const mimetype =
    typeof content.info?.mimetype === "string" && content.info.mimetype
      ? content.info.mimetype
      : "application/octet-stream";
  const isImage = content.msgtype === MsgType.Image && isInlineImage(mimetype);
  const thumbnail = isImage ? parseThumbnail(content.info) : undefined;
  const source: MatrixAttachmentSource = thumbnail
    ? { ...location, thumbnail }
    : location;

  return {
    attachment: {
      kind: isImage ? "image" : "file",
      name: name || "file",
      mimetype,
      size: positiveNumber(content.info?.size),
      width: positiveNumber(content.info?.w),
      height: positiveNumber(content.info?.h),
      source,
    },
    caption,
  };
};

/**
 * Builds the `m.room.message` content posting an uploaded attachment. A
 * non-empty caption goes in `body` (Matrix 1.10), the name in `filename`.
 */
export const matrixAttachmentContent = (
  attachment: ChatAttachment,
  caption = "",
) => {
  const source = attachment.source as MatrixAttachmentSource;
  const isImage = attachment.kind === "image";
  const { thumbnail } = source;
  return {
    msgtype: isImage ? MsgType.Image : MsgType.File,
    body: caption || attachment.name,
    filename: attachment.name,
    ...(source.file
      ? { file: { ...source.file, url: source.url } }
      : { url: source.url }),
    info: {
      mimetype: attachment.mimetype,
      ...(attachment.size !== undefined ? { size: attachment.size } : {}),
      ...(isImage && attachment.width && attachment.height
        ? { w: attachment.width, h: attachment.height }
        : {}),
      ...(isImage && thumbnail
        ? {
            ...(thumbnail.file
              ? { thumbnail_file: { ...thumbnail.file, url: thumbnail.url } }
              : { thumbnail_url: thumbnail.url }),
            ...(thumbnail.info ? { thumbnail_info: thumbnail.info } : {}),
          }
        : {}),
    },
  };
};

/** Splits an `mxc://server/mediaId` URI into its path segments. */
export const parseMxcUrl = (
  url: string,
): { serverName: string; mediaId: string } => {
  const [serverName, mediaId, ...rest] = url.slice("mxc://".length).split("/");
  if (!isMxcUrl(url) || !serverName || !mediaId || rest.length > 0) {
    throw new Error(`Invalid Matrix content URI "${url}".`);
  }
  return { serverName, mediaId };
};

/** Pixel size of an image file, or `undefined` when the browser cannot decode it. */
export const readImageDimensions = async (
  file: Blob,
): Promise<{ width: number; height: number } | undefined> => {
  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  } catch {
    return undefined;
  }
};

/**
 * Downscaled copy of an image larger than `maxWidth` x `maxHeight`, or `null`
 * when it already fits, cannot be decoded, or would barely save any bytes.
 */
export const createImageThumbnail = async (
  file: Blob,
  maxWidth: number,
  maxHeight: number,
): Promise<{ data: Blob; info: Required<MatrixThumbnailInfo> } | null> => {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    const scale = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height);
    if (scale >= 1) {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // WebP keeps transparency at a fraction of PNG's size; browsers that
    // cannot encode it fall back to PNG, reported by the blob type.
    const data = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.8),
    );
    // Not worth a second file when it saves less than a tenth of the bytes.
    if (!data || data.size > file.size * 0.9) {
      return null;
    }
    return {
      data,
      info: {
        mimetype: data.type,
        size: data.size,
        w: canvas.width,
        h: canvas.height,
      },
    };
  } finally {
    bitmap.close();
  }
};

// --- Encrypted attachments ----------------------------------------------

/** Encrypts file bytes for an encrypted room (AES-CTR-256, protocol `v2`). */
export const encryptAttachment = async (
  plaintext: ArrayBuffer,
): Promise<{ data: ArrayBuffer; file: EncryptedFileKeys }> => {
  const { data, info } = await encryptFileContent(plaintext);
  // The library always fills the hash and version the spec makes mandatory.
  return { data, file: info as EncryptedFileKeys };
};

type EncryptedThumbnail = {
  data: ArrayBuffer;
  file: EncryptedFileKeys;
  info: MatrixThumbnailInfo;
};

/** Encrypted thumbnail of a large image, or `null` when none is useful. */
export const createEncryptedThumbnail = async (
  file: Blob,
): Promise<EncryptedThumbnail | null> => {
  const thumbnail = await createImageThumbnail(
    file,
    MATRIX_THUMBNAIL_WIDTH,
    MATRIX_THUMBNAIL_HEIGHT,
  );
  if (!thumbnail) {
    return null;
  }
  const encrypted = await encryptAttachment(await thumbnail.data.arrayBuffer());
  return { ...encrypted, info: thumbnail.info };
};

// --- Media repository ----------------------------------------------------

/** Large still images get a thumbnail; GIFs keep their animation. */
export const needsThumbnail = (
  mimetype: string,
  width: number | undefined,
  height: number | undefined,
): boolean =>
  mimetype !== "image/gif" &&
  (!width ||
    !height ||
    width > MATRIX_THUMBNAIL_WIDTH ||
    height > MATRIX_THUMBNAIL_HEIGHT);

/** Authenticated media path of an `mxc://` URI. */
const mediaPath = (endpoint: "download" | "thumbnail", url: string) => {
  const { serverName, mediaId } = parseMxcUrl(url);
  return `/${endpoint}/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`;
};

// The SDK attaches the access token and refreshes it when expired.
const mediaRequestOptions = (signal: AbortSignal | undefined) => ({
  prefix: MATRIX_MEDIA_PREFIX,
  rawResponseBody: true,
  abortSignal: signal,
});

/** Downloads media bytes, decrypted locally once their hash is checked. */
export const fetchMedia = async (
  mx: MatrixClient,
  { url, file }: MatrixMediaLocation,
  mimetype: string,
  signal?: AbortSignal,
): Promise<Blob> => {
  const blob = await mx.http.authedRequest<Blob>(
    Method.Get,
    mediaPath("download", url),
    { allow_redirect: true },
    undefined,
    mediaRequestOptions(signal),
  );
  if (!file) {
    return withSafeBlobType(blob, mimetype);
  }
  const plaintext = await decryptAttachment(await blob.arrayBuffer(), file);
  return withSafeBlobType(new Blob([plaintext]), mimetype);
};

/** Square, cropped rendition of an avatar, as Element requests it. */
export const fetchAvatarThumbnail = async (
  mx: MatrixClient,
  url: string,
  size: number,
  signal?: AbortSignal,
): Promise<Blob> => {
  const thumbnail = await mx.http.authedRequest<Blob>(
    Method.Get,
    mediaPath("thumbnail", url),
    { width: size, height: size, method: "crop", allow_redirect: true },
    undefined,
    mediaRequestOptions(signal),
  );
  return withSafeBlobType(thumbnail, thumbnail.type);
};

/** The server's timeline-sized rendition of an unencrypted image. */
export const fetchServerThumbnail = async (
  mx: MatrixClient,
  url: string,
  signal?: AbortSignal,
): Promise<Blob> => {
  const thumbnail = await mx.http.authedRequest<Blob>(
    Method.Get,
    mediaPath("thumbnail", url),
    {
      width: MATRIX_THUMBNAIL_WIDTH,
      height: MATRIX_THUMBNAIL_HEIGHT,
      method: "scale",
      allow_redirect: true,
    },
    undefined,
    mediaRequestOptions(signal),
  );
  return withSafeBlobType(thumbnail, thumbnail.type);
};

/**
 * Stores an encrypted thumbnail beside its image. Best effort: when it fails,
 * the image is posted without one, unless the whole upload was aborted.
 */
export const uploadThumbnail = async (
  mx: MatrixClient,
  { data, file, info }: EncryptedThumbnail,
  abortController: AbortController,
): Promise<MatrixAttachmentSource["thumbnail"]> => {
  try {
    const { content_uri: url } = await mx.uploadContent(new Blob([data]), {
      type: "application/octet-stream",
      includeFilename: false,
      abortController,
    });
    return { url, file, info };
  } catch {
    abortController.signal.throwIfAborted();
    return undefined;
  }
};
