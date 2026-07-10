/**
 * Copies plain text with the modern async API, then falls back to the legacy
 * selection command for browsers/webviews that deny Clipboard permissions.
 */
const copyUsingSelection = (text: string): boolean => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto 0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
};

export const copyTextToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Embedded browsers can expose Clipboard but deny writes. Keep a local,
    // dependency-free fallback for environments that still allow selection
    // based copying.
  }

  if (!copyUsingSelection(text)) {
    throw new Error("The browser rejected the clipboard copy command.");
  }
};
