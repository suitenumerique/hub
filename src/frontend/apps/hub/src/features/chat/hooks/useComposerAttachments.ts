import { useCallback, useEffect, useRef, useState } from "react";

import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatAttachment } from "@/features/drivers/types";

export type ComposerAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
  controller: AbortController;
  status: "uploading" | "ready" | "error";
  progress: number;
  attachment?: ChatAttachment;
};

export const useComposerAttachments = (
  accountId?: string,
  chatId?: string,
  draftKey?: string,
) => {
  const [entries, setEntries] = useState<ComposerAttachment[]>([]);
  const entriesRef = useRef(entries);
  const update = useCallback(
    (transform: (entries: ComposerAttachment[]) => ComposerAttachment[]) => {
      entriesRef.current = transform(entriesRef.current);
      setEntries(entriesRef.current);
    },
    [],
  );
  const remove = useCallback(
    (id: string) => {
      const entry = entriesRef.current.find((entry) => entry.id === id);
      entry?.controller.abort();
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      update((entries) => entries.filter((entry) => entry.id !== id));
    },
    [update],
  );
  const clear = useCallback(() => {
    for (const entry of entriesRef.current) {
      entry.controller.abort();
      if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    }
    update(() => []);
  }, [update]);

  useEffect(() => clear, [accountId, draftKey, clear]);

  const upload = useCallback(
    async (entry: ComposerAttachment) => {
      if (!accountId) return;
      const patch = (changes: Partial<ComposerAttachment>) =>
        update((entries) =>
          entries.map((current) =>
            current.id === entry.id ? { ...current, ...changes } : current,
          ),
        );
      patch({ status: "uploading", progress: 0 });
      try {
        const attachment = await getRegistry()
          .get(accountId)
          .uploadChatAttachment({
            chatId,
            file: entry.file,
            abortController: entry.controller,
            onProgress: (progress) => patch({ progress }),
          });
        patch({ attachment, status: "ready", progress: 100 });
      } catch {
        if (!entry.controller.signal.aborted) patch({ status: "error" });
      }
    },
    [accountId, chatId, update],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const added = files.map(
        (file): ComposerAttachment => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined,
          controller: new AbortController(),
          status: "uploading",
          progress: 0,
        }),
      );
      update((entries) => [...entries, ...added]);
      added.forEach((entry) => void upload(entry));
    },
    [update, upload],
  );
  const retry = useCallback(
    (id: string) => {
      const current = entriesRef.current.find((entry) => entry.id === id);
      if (!current) return;
      const entry = { ...current, controller: new AbortController() };
      update((entries) =>
        entries.map((current) => (current.id === id ? entry : current)),
      );
      void upload(entry);
    },
    [update, upload],
  );
  return { entries, addFiles, remove, retry, clear };
};
