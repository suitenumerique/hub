import { useEffect, useState } from "react";

/** Typing pause before the count is read, so each keystroke does not repeat it. */
const ANNOUNCE_DELAY = 500;

type ComposerSuggestionsStatusProps = {
  /** What to announce while a list is open, empty while none is. */
  message: string;
};

/**
 * Tells screen readers that the `@` or `:` suggestions opened and how many
 * they hold: the focus stays in the text, so the list showing up is not
 * announced otherwise. Emptied when the list closes, so the next one is
 * announced again.
 */
export const ComposerSuggestionsStatus = ({
  message,
}: ComposerSuggestionsStatusProps) => {
  const [announced, setAnnounced] = useState("");

  useEffect(() => {
    if (!message) {
      setAnnounced("");
      return;
    }
    const timer = window.setTimeout(
      () => setAnnounced(message),
      ANNOUNCE_DELAY,
    );
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <span className="hub__visually-hidden" role="status">
      {announced}
    </span>
  );
};
