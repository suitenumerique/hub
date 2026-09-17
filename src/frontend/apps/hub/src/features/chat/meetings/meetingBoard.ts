import { useEffect, useState } from "react";

import { useApiConfig } from "@/features/config/useApiConfig";

/**
 * An Excalidraw collaboration room: the room the participants share, and the
 * key their scene is encrypted with. Both travel in the URL fragment, so the
 * whiteboard server never receives either of them.
 */
export type BoardRoom = {
  roomId: string;
  roomKey: string;
};

/** Domain separator, so the digest is of no use anywhere else. */
const SEED_PREFIX = "hub-meeting-board:";

/** Excalidraw room ids are 20 hexadecimal characters. */
const ROOM_ID_BYTES = 10;

/** Its key is a 128-bit AES-GCM key, base64url encoded without padding. */
const ROOM_KEY_BYTES = 16;

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

/**
 * The whiteboard room of a meeting, derived from its identifier rather than
 * stored: every participant computes the same room and key from the meeting
 * they already share, so no extra state event, and no coordination, is needed.
 *
 * The board is therefore exactly as confidential as the meeting identifier it
 * comes from — whoever can join the call can open its board.
 */
export const deriveBoardRoom = async (seed: string): Promise<BoardRoom> => {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${SEED_PREFIX}${seed}`),
    ),
  );
  return {
    roomId: toHex(digest.subarray(0, ROOM_ID_BYTES)),
    roomKey: toBase64Url(
      digest.subarray(ROOM_ID_BYTES, ROOM_ID_BYTES + ROOM_KEY_BYTES),
    ),
  };
};

/** The Excalidraw link opening `room`, which joins its collaboration. */
export const buildBoardUrl = (baseUrl: string, room: BoardRoom): string =>
  `${baseUrl.replace(/\/+$/, "")}/#room=${room.roomId},${room.roomKey}`;

/**
 * The whiteboard URL of a meeting, or `null` while it is being derived, when
 * the deployment configures no whiteboard, or when the browser exposes no Web
 * Crypto (an insecure context): the meeting window then shows the call alone.
 */
export const useMeetingBoardUrl = (seed: string | undefined): string | null => {
  const { data: config } = useApiConfig();
  const baseUrl = config?.MEETING_BOARD_BASE_URL ?? null;
  const [room, setRoom] = useState<BoardRoom | null>(null);

  useEffect(() => {
    if (!seed || !baseUrl || !globalThis.crypto?.subtle) {
      setRoom(null);
      return;
    }
    let isCurrent = true;
    void deriveBoardRoom(seed).then((derived) => {
      if (isCurrent) {
        setRoom(derived);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [seed, baseUrl]);

  return baseUrl && room ? buildBoardUrl(baseUrl, room) : null;
};
