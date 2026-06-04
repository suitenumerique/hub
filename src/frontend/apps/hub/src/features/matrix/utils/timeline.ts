import { EventOrTransactionId, EventTimelineItem, TimelineDiff, TimelineDiff_Tags, TimelineItem, TimelineItemLike, VirtualTimelineItem } from "@/index.web";

/**
 * Simple wrapper to track timeline item with its type
 */
export interface TimelineItemWrapper {
  item: TimelineItemLike;
  eventItem?: EventTimelineItem;
  virtualItem?: VirtualTimelineItem;
  isEvent: boolean;
  isVirtual: boolean;
}
/**
 * Applies a TimelineDiff to the items array
 */
export const applyTimelineDiff = (
  items: TimelineItem[],
  diff: TimelineDiff,
): void => {
  switch (diff.tag) {
    case TimelineDiff_Tags.Set: {
      items[diff.inner.index] = parseTimelineItem(diff.inner.value)
      break;
    }
    case TimelineDiff_Tags.PushBack:
      items.push(parseTimelineItem(diff.inner.value));
      break;
    case TimelineDiff_Tags.PushFront:
      items.unshift(parseTimelineItem(diff.inner.value));
      break;
    case TimelineDiff_Tags.Clear:
      items.length = 0;
      break;
    case TimelineDiff_Tags.PopFront:
      items.shift();
      break;
    case TimelineDiff_Tags.PopBack:
      items.pop();
      break;
    case TimelineDiff_Tags.Insert:
      items.splice(
        diff.inner.index,
        0,
        parseTimelineItem(diff.inner.value),
      );
      break;
    case TimelineDiff_Tags.Remove:
      items.splice(diff.inner.index, 1);
      break;
    case TimelineDiff_Tags.Truncate:
      items.splice(diff.inner.length);
      break;
    case TimelineDiff_Tags.Reset:
      items.length = 0;
      items.push(...diff.inner.values.map((v) => parseTimelineItem(v)));
      break;
    case TimelineDiff_Tags.Append:
      items.push(...diff.inner.values.map((v) => parseTimelineItem(v)));
      break;
  }
}

/**
 * Parses a TimelineItemInterface into a TimelineItem
 */
export const parseTimelineItem = (
  item: TimelineItemLike,
): TimelineItem => {
    return item as TimelineItem;
}

/**
 * Check if item is a real event
 */
export const isRealEvent = (
  item: TimelineItemWrapper | undefined,
): item is TimelineItemWrapper & { eventItem: EventTimelineItem } => {
  return item?.isEvent ?? false;
};

/**
 * Check if item is a virtual item
 */
export const isVirtualEvent = (
  item: TimelineItemWrapper | undefined,
): item is TimelineItemWrapper & { virtualItem: VirtualTimelineItem } => {
  return item?.isVirtual ?? false;
};

/**
 * Extracts the event ID from a timeline event
 */
export const getEventId = (event: EventTimelineItem): string => {
  try {
    const eventOrTxId = event.eventOrTransactionId;

    if (EventOrTransactionId.EventId.instanceOf(eventOrTxId)) {
      return eventOrTxId.inner.eventId;
    }

    if (EventOrTransactionId.TransactionId.instanceOf(eventOrTxId)) {
      return eventOrTxId.inner.transactionId;
    }
  } catch (e) {
    console.warn(
      "[MatrixDriver.getEventId] Failed to extract event ID:",
      e,
    );
  }

  return `event-${Math.random()}`;
}


/**
 * Extracts the sender from a timeline event
 */
export const getEventSender = (event: EventTimelineItem): string | null => {
  try {
    return event.sender ?? null;
  } catch (e) {
    console.warn("[timeline.getEventSender] Failed to extract sender:", e);
    return null;
  }
};

/**
 * Extracts the message content from a timeline event
 */
export const getEventContent = (event: EventTimelineItem): string => {
  try {
    if (event.content && typeof event.content === "object") {
      if ("body" in event.content) {
        return (event.content as any).body || "";
      }
    }
  } catch (e) {
    console.warn("[timeline.getEventContent] Failed to extract content:", e);
  }
  return "";
};

/**
 * Extracts the timestamp from a timeline event
 */
export const getEventTimestamp = (event: EventTimelineItem): string => {
  try {
    const ts = event.timestamp.toLocaleString();
    if (ts) {
      return new Date(ts).toISOString();
    }
  } catch (e) {
    console.warn("[timeline.getEventTimestamp] Failed to extract timestamp:", e);
  }
  return new Date().toISOString();
};


/**
 * Gets the event as EventTimelineItem
 */
export const getAsEvent = (item: TimelineItem): EventTimelineItem | null => {
  return item.asEvent?.() ?? null;
};

/**
 * Gets the virtual item as VirtualTimelineItem
 */
export const getAsVirtual = (item: TimelineItem): VirtualTimelineItem | null => {
  return item.asVirtual?.() ?? null;
};

/**
 * Gets the internal ID for a timeline item (event or virtual)
 */
export const getInternalId = (item: TimelineItem): string => {
  const event = getAsEvent(item);
  if (event) {
    return getEventId(event);
  }

  const virtualItem = getAsVirtual(item);
  if (virtualItem) return virtualItem.tag;

  console.warn("[timeline.getInternalId] Failed to get internal id");
  return `item-${Math.random()}`;
};
