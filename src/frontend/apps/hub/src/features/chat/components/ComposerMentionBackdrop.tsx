import type { Ref } from "react";

import { type ComposerDraft, draftSegments } from "../composer/composerDraft";

type ComposerMentionBackdropProps = {
  draft: ComposerDraft;
  ref?: Ref<HTMLDivElement>;
};

/**
 * Paints the mentions' highlight behind the transparent textarea, which still
 * draws all the text: the layer repeats the text invisibly with the same
 * metrics so each highlight lands under its name.
 */
export const ComposerMentionBackdrop = ({
  draft,
  ref,
}: ComposerMentionBackdropProps) => (
  <div ref={ref} className="hub__chat-composer__backdrop" aria-hidden="true">
    {draftSegments(draft).map(({ text, mention }) =>
      mention ? (
        <span key={mention.start} className="hub__chat-composer__mention">
          {text}
        </span>
      ) : (
        text
      ),
    )}
    {/* A final newline only makes a line once something follows it. */}
    {draft.text.endsWith("\n") && "​"}
  </div>
);
