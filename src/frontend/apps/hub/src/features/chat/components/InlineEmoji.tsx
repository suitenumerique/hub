import { useFluentEmojiUrl } from "../hooks/useFluentEmojiUrl";

type InlineEmojiProps = {
  /** Native emoji character, e.g. "👍". */
  emoji: string;
};

/**
 * An emoji within text, drawn as its Fluent drawing over the native glyph.
 * The glyph stays, invisible: it keeps the text's width (so the composer's
 * layer lines up with the textarea), and copying or a screen reader still
 * get the emoji itself.
 */
export const InlineEmoji = ({ emoji }: InlineEmojiProps) => {
  const { url, onError } = useFluentEmojiUrl(emoji);
  if (!url) {
    return emoji;
  }
  return (
    <span className="hub__inline-emoji">
      {emoji}
      <img
        className="hub__inline-emoji__image"
        src={url}
        alt=""
        draggable={false}
        decoding="async"
        onError={onError}
      />
    </span>
  );
};
