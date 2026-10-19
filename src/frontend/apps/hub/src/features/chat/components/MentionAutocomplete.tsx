import clsx from "clsx";
import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { AccountId } from "@/features/drivers/types";
import { hashAvatarColor } from "@/features/ui/components/avatar/palette";

import type { MentionCandidate } from "../composer/mentionMatching";

import { ChatUserAvatar } from "./ChatUserAvatar";

type MentionAutocompleteProps = {
  id: string;
  accountId: AccountId;
  items: MentionCandidate[];
  selectedIndex: number;
  optionId: (item: MentionCandidate) => string;
  onConfirm: (item: MentionCandidate) => void;
};

/**
 * The people matching the `@` being typed, above the composer as in Element.
 * The textarea keeps the focus and points at the selected row through
 * `aria-activedescendant`; hovering only highlights a row.
 */
export const MentionAutocomplete = ({
  id,
  accountId,
  items,
  selectedIndex,
  optionId,
  onConfirm,
}: MentionAutocompleteProps) => {
  const { t } = useTranslation();
  const listRef = useRef<HTMLUListElement>(null);

  // Scroll the list only: `scrollIntoView` could move the timeline too.
  useLayoutEffect(() => {
    const list = listRef.current;
    const option = list?.children[selectedIndex] as HTMLElement | undefined;
    if (!list || !option) {
      return;
    }
    if (option.offsetTop < list.scrollTop) {
      list.scrollTop = option.offsetTop;
    } else if (
      option.offsetTop + option.offsetHeight >
      list.scrollTop + list.clientHeight
    ) {
      list.scrollTop =
        option.offsetTop + option.offsetHeight - list.clientHeight;
    }
  }, [items, selectedIndex]);

  return (
    <ul
      ref={listRef}
      id={id}
      role="listbox"
      aria-label={t("Mention suggestions")}
      className="hub__mention-autocomplete"
    >
      {items.map((item, index) => (
        <li
          key={item.id}
          id={optionId(item)}
          role="option"
          aria-selected={index === selectedIndex}
          className={clsx(
            "hub__mention-autocomplete__option",
            index === selectedIndex &&
              "hub__mention-autocomplete__option--selected",
          )}
          // Keep the focus in the composer, touch included.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onConfirm(item)}
        >
          <ChatUserAvatar
            accountId={accountId}
            user={{
              name: item.rawName,
              avatarUrl: item.avatarUrl,
              color: hashAvatarColor(item.id),
            }}
          />
          <span className="hub__mention-autocomplete__body">
            <span className="hub__mention-autocomplete__name">{item.name}</span>
            <span className="hub__mention-autocomplete__id">{item.id}</span>
          </span>
        </li>
      ))}
    </ul>
  );
};
