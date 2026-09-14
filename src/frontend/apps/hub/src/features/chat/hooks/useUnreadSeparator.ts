import { useCallback, useLayoutEffect, useState } from "react";

type SeparatorSlot = {
  eventId: string;
  isVisible: boolean;
};

/**
 * Keeps the unread separator at a fixed message during a conversation visit,
 * independently from the actual read boundary. Hidden slots preserve the layout
 * until the caller can safely remove them without shifting visible messages.
 */
export const useUnreadSeparator = (
  firstUnreadId: string | null,
  hasUnread: boolean,
  isLoading: boolean,
) => {
  const [slots, setSlots] = useState<SeparatorSlot[]>([]);
  const eventId = slots.find((slot) => slot.isVisible)?.eventId ?? null;

  /**
   * Places the visible separator before the requested message, unless it is
   * already there. Previous slots stay hidden to preserve row height and author
   * grouping until they can be safely released.
   */
  const anchorTo = useCallback((nextEventId: string) => {
    setSlots((current) => {
      if (
        current.some((slot) => slot.eventId === nextEventId && slot.isVisible)
      ) {
        return current;
      }
      return [
        ...current
          .filter((slot) => slot.eventId !== nextEventId)
          .map((slot) =>
            slot.isVisible ? { ...slot, isVisible: false } : slot,
          ),
        { eventId: nextEventId, isVisible: true },
      ];
    });
  }, []);

  /**
   * Removes hidden slots that the caller has identified as safe to remove from
   * the layout. The currently visible separator is always preserved.
   */
  const releaseHiddenSlots = useCallback((eventIds: ReadonlySet<string>) => {
    if (eventIds.size === 0) {
      return;
    }
    setSlots((current) =>
      current.filter((slot) => slot.isVisible || !eventIds.has(slot.eventId)),
    );
  }, []);

  // Once unread data is loaded, initialize a missing anchor before paint without
  // moving an existing one as reading progresses. When everything is read, hide
  // the separator while retaining its slot to avoid a layout jump.
  useLayoutEffect(() => {
    if (isLoading) {
      return;
    }
    if (!hasUnread) {
      setSlots((current) =>
        current.some((slot) => slot.isVisible)
          ? current.map((slot) => ({ ...slot, isVisible: false }))
          : current,
      );
    } else if (!eventId && firstUnreadId) {
      anchorTo(firstUnreadId);
    }
  }, [anchorTo, eventId, firstUnreadId, hasUnread, isLoading]);

  return { slots, eventId, anchorTo, releaseHiddenSlots };
};
