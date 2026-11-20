import { Fragment, type Ref } from "react";

import { type ComposerDraft, draftSegments } from "../composer/composerDraft";
import { renderEmojiText } from "../formattedContent";

type ComposerMentionBackdropProps = {
  draft: ComposerDraft;
  ref?: Ref<HTMLDivElement>;
};

/**
 * Repeats the text behind the transparent textarea, with the same metrics,
 * to paint under it the mentions' highlight and, as the messages show them,
 * the emojis' Fluent drawings. With emojis, the composer hides the textarea's
 * own text and this layer draws it all; the textarea keeps the caret, the
 * selection and the editing.
 */
export const ComposerMentionBackdrop = ({
  draft,
  ref,
}: ComposerMentionBackdropProps) => (
  <div ref={ref} className="hub__chat-composer__backdrop" aria-hidden="true">
    {draftSegments(draft).map(({ text, mention }, index) =>
      mention ? (
        <span key={mention.start} className="hub__chat-composer__mention">
          {renderEmojiText(text)}
        </span>
      ) : (
        <Fragment key={`text-${index}`}>{renderEmojiText(text)}</Fragment>
      ),
    )}
    {/* A final newline only makes a line once something follows it. */}
    {draft.text.endsWith("\n") && "​"}
  </div>
);
