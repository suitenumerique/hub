import type { ChatRef } from "@/features/drivers/types";

/**
 * Messages leave one at a time, in the order they were written, per
 * conversation and per thread. This queue depends on nothing on screen: another
 * conversation may be open, or the tab hidden, and they still leave.
 *
 * A slot is taken when the message is written: its send waits for `turn`, and
 * `release` lets the next one go, whatever happened to this one.
 */
export type SendSlot = { turn: Promise<void>; release: () => void };

const lastSlots = new Map<string, Promise<void>>();

export const reserveSendSlot = (ref: ChatRef, threadId?: string): SendSlot => {
  const key = `${ref.accountId}:${ref.chatId}:${threadId ?? ""}`;
  const turn = lastSlots.get(key) ?? Promise.resolve();
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  lastSlots.set(key, released);
  void released.then(() => {
    if (lastSlots.get(key) === released) {
      lastSlots.delete(key);
    }
  });
  return { turn, release };
};
