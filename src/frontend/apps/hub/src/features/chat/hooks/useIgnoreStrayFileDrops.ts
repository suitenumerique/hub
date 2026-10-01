import { useEffect } from "react";

/**
 * Keeps a file dropped outside every drop area (header, sidebar…) from being
 * opened by the browser in place of the app, which would lose the drafts and
 * uploads in progress. Drop areas cancel the event first, so it is left alone.
 */
export const useIgnoreStrayFileDrops = (): void => {
  useEffect(() => {
    const ignore = (event: DragEvent) => {
      if (
        event.defaultPrevented ||
        !event.dataTransfer?.types.includes("Files")
      ) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "none";
    };
    window.addEventListener("dragover", ignore);
    window.addEventListener("drop", ignore);
    return () => {
      window.removeEventListener("dragover", ignore);
      window.removeEventListener("drop", ignore);
    };
  }, []);
};
