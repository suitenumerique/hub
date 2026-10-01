import {
  decryptAttachment,
  encryptAttachment,
} from "matrix-encrypt-attachment";
import { MsgType, type MatrixClient } from "matrix-js-sdk/lib/matrix";
import type { RoomMessageEventContent } from "matrix-js-sdk/lib/types";

import type { UploadChatAttachmentParams } from "../Driver";
import type { ChatAttachment } from "../types";

export const attachmentMessageContent = (
  attachment: ChatAttachment,
): RoomMessageEventContent => {
  const common = {
    body: attachment.name,
    filename: attachment.name,
    info: {
      mimetype: attachment.mimetype,
      size: attachment.size,
      ...(attachment.width
        ? { w: attachment.width, h: attachment.height }
        : {}),
    },
    ...(attachment.encryptedFile
      ? { file: attachment.encryptedFile }
      : { url: attachment.url }),
  };
  return attachment.mimetype.startsWith("image/")
    ? { ...common, msgtype: MsgType.Image }
    : { ...common, msgtype: MsgType.File };
};

export const uploadMatrixAttachment = async (
  mx: MatrixClient,
  { chatId, file, abortController, onProgress }: UploadChatAttachmentParams,
): Promise<ChatAttachment> => {
  const { signal } = abortController;
  signal.throwIfAborted();
  const config = await mx.getMediaConfig();
  const maxSize = config["m.upload.size"];
  if (typeof maxSize === "number" && file.size > maxSize) {
    throw new Error("This file exceeds the server's upload limit.");
  }
  const encrypted = Boolean(chatId && mx.isRoomEncrypted(chatId));
  const mimetype = file.type || "application/octet-stream";
  const attachment: ChatAttachment = {
    name: file.name,
    mimetype,
    size: file.size,
    url: "",
  };
  if (mimetype.startsWith("image/")) {
    try {
      const bitmap = await createImageBitmap(file);
      attachment.width = bitmap.width;
      attachment.height = bitmap.height;
      bitmap.close();
    } catch {
      // A valid upload can still be an image this browser cannot decode.
    }
  }
  const ciphertext = encrypted
    ? await encryptAttachment(await file.arrayBuffer())
    : undefined;
  signal.throwIfAborted();
  const result = await mx.uploadContent(
    ciphertext ? new Blob([ciphertext.data]) : file,
    {
      name: file.name,
      type: ciphertext ? "application/octet-stream" : mimetype,
      includeFilename: !encrypted,
      abortController,
      progressHandler: ({ loaded, total }) =>
        onProgress?.(total ? Math.round((loaded / total) * 100) : 0),
    },
  );
  signal.throwIfAborted();
  attachment.url = result.content_uri;
  if (ciphertext) {
    const { key, iv, hashes, v } = ciphertext.info;
    if (!hashes?.sha256 || v !== "v2")
      throw new Error("Invalid encrypted attachment metadata.");
    attachment.encryptedFile = {
      key,
      iv,
      hashes: { sha256: hashes.sha256 },
      v,
      url: result.content_uri,
    };
  }
  return attachment;
};

export const downloadMatrixAttachment = async (
  mx: MatrixClient,
  attachment: ChatAttachment,
  signal?: AbortSignal,
): Promise<Blob> => {
  const url = mx.mxcUrlToHttp(
    attachment.url,
    undefined,
    undefined,
    undefined,
    false,
    true,
    true,
  );
  if (!url) throw new Error("Invalid Matrix media URI.");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${mx.getAccessToken()}` },
    signal,
    credentials: "omit",
  });
  if (!response.ok)
    throw new Error(`File download failed (${response.status}).`);
  const data = await response.arrayBuffer();
  signal?.throwIfAborted();
  const plaintext = attachment.encryptedFile
    ? await decryptAttachment(data, attachment.encryptedFile)
    : data;
  signal?.throwIfAborted();
  return new Blob([plaintext], { type: attachment.mimetype });
};
