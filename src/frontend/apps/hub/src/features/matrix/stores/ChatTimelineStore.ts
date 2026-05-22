import {
  Room,
  ClientEvent,
  MatrixClient,
  RoomEvent,
  MatrixEvent,
  IRoomTimelineData,
  EventTimeline,
  Direction,
} from 'matrix-js-sdk/lib/matrix';
import { ChatMessage, ChatMessageAuthor } from '@/features/drivers/types';
import { Store } from '@/features/drivers/Store';
import { matrixEventToMessage } from '../utils/types/matrixTypesToHub';

export interface ChatTimelineSnapshot {
  currentChatId: string;
  timelineByChatId: Map<string, ChatTimeline>;
}

export interface ChatTimeline {
  roomId: string;
  messages: ChatMessage[];
  authors: Map<string, ChatMessageAuthor>;
  linkedTimelines: EventTimeline[];
  liveTimeline: EventTimeline;
  canPaginateBack: boolean;
  canPaginateForward: boolean;
  isPaginating: boolean;
}

const PAGINATION_LIMIT = 50;

export class ChatTimelineStore extends Store<ChatTimelineSnapshot | null> {
  private chatTimelines = new Map<string, ChatTimeline>();
  private chatAuthors = new Map<string, ChatMessageAuthor>();
  private currentChatId?: string;
  private mx?: MatrixClient;

  setMatrixClient(mx: MatrixClient) {
    this.mx = mx;
    this.setupListeners();
  }
  /**
   * Set up listeners for room events
   */
  private setupListeners() {
    if (!this.mx) return;

    // Listen for sync events which will update room information
    this.mx.on(RoomEvent.Timeline, this.onChatTimelineSnapshot);
  }

  /**
   * Update the internal snapshot from the Matrix client
   */
  private onChatTimelineSnapshot(
    event: MatrixEvent,
    room: Room | undefined,
    toStartOfTimeline: boolean | undefined,
    removed: boolean,
    data: IRoomTimelineData,
  ) {
    console.log('*** [ChatStore] onChatTimelineSnapshot', event);
    if (!this.mx) return;
    // Ignore old/removed events and backfilled messages
    if (removed || toStartOfTimeline) return;

    if (!room) return;
    // Event age when it arrived at the device; defensive guard for delayed sync (source of truth remains data.liveEvent).
    const ageOfEvent = event.getAge();
    if (
      !this.isNewLiveTimelineEvent(removed, data, toStartOfTimeline) ||
      (ageOfEvent !== undefined && ageOfEvent >= 2000)
    ) {
      return;
    }

    // Temporary do nothing if event type is not a message text
    if (event.getType() === 'm.room.message') return;

    const roomTimeline = this.chatTimelines.get(room.roomId);

    // should create new chat timeline for this room in the Store if not found
    if (!roomTimeline) {
      this.initializeChatTimeline(room.roomId);
    } else {
      // Add message to room's message list
      const message = matrixEventToMessage(event);

      // Check if message already exists
      if (!roomTimeline.messages.some((m) => m.id === message.id)) {
        roomTimeline.messages.push(message);
      }

      // Cache author info if not already cached
      if (!roomTimeline.authors.has(message.authorId)) {
        const author = this.extractAuthorFromEvent(room, message.authorId);
        if (author) {
          roomTimeline.authors.set(message.authorId, author);
        }
      }
    }

    // Update snapshot if it's for current room
    if (room.roomId === this.currentChatId) {
      this.updateChatSnapshot();
    }
  }

  /**
   * Extract author information from the Matrix room
   */
  private extractAuthorFromEvent(
    room: Room,
    authorId: string,
  ): ChatMessageAuthor | null {
    const member = room.getMember(authorId);
    if (!member) return null;

    return {
      id: authorId,
      name: member.name || authorId,
      initials: (member.name || authorId)[0]?.toUpperCase() || '?',
      color: 'blue-1', // TODO: Map Matrix color scheme if available
    };
  }
  /**
   * Update the snapshot for the current room
   */
  private updateChatSnapshot() {
    if (!this.currentChatId) {
      super.updateSnapshot(null);
      return;
    }

    const snapshot: ChatTimelineSnapshot = {
      currentChatId: this.currentChatId,
      timelineByChatId: this.chatTimelines,
    };

    super.updateSnapshot(snapshot);
  }

  /**
   * Initialize timeline for a room
   */
  private initializeChatTimeline(roomId: string) {
    const room = this.mx?.getRoom(roomId);
    if (!room) return;

    const liveTimeline = room.getLiveTimeline();
    const linkedTimelines = this.getLinkedTimelines(liveTimeline);

    // Load initial messages from live timeline
    const messages: ChatMessage[] = [];
    const authors = new Map<string, ChatMessageAuthor>();
    // Get events from all linked timelines
    linkedTimelines.forEach((timeline) => {
      timeline.getEvents().forEach((event) => {
        if (event.getType() === 'm.room.message') {
          const message = matrixEventToMessage(event);
          messages.push(message);

          // Cache author
          if (!authors.has(message.authorId)) {
            const author = this.extractAuthorFromEvent(room, message.authorId);
            if (author) {
              authors.set(message.authorId, author);
            }
          }
        }
      });
    });

    // Sort by timestamp (oldest first)
    messages.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    this.chatTimelines.set(roomId, {
      roomId,
      messages,
      authors,
      linkedTimelines,
      liveTimeline,
      canPaginateBack: this.canPaginateBackward(linkedTimelines[0]),
      canPaginateForward: false,
      isPaginating: false,
    });
  }

  /**
   * Get all linked timelines (backward and forward)
   */
  private getLinkedTimelines(timeline: EventTimeline): EventTimeline[] {
    const firstTimeline = this.getFirstLinkedTimeline(
      timeline,
      Direction.Backward,
    );
    const timelines: EventTimeline[] = [];

    for (
      let nextTimeline: EventTimeline | null = firstTimeline;
      nextTimeline;
      nextTimeline = nextTimeline.getNeighbouringTimeline(Direction.Forward)
    ) {
      timelines.push(nextTimeline);
    }
    return timelines;
  }

  private getLiveTimeline = (room: Room): EventTimeline =>
    room.getUnfilteredTimelineSet().getLiveTimeline();

  /**
   * Get the first timeline in a direction
   */
  private getFirstLinkedTimeline(
    timeline: EventTimeline,
    direction: Direction,
  ): EventTimeline {
    const linkedTm = timeline.getNeighbouringTimeline(direction);
    if (!linkedTm) return timeline;
    return this.getFirstLinkedTimeline(linkedTm, direction);
  }

  /**
   * Check if can paginate backward
   */
  private canPaginateBackward(timeline: EventTimeline): boolean {
    return typeof timeline.getPaginationToken(Direction.Backward) === 'string';
  }

  /**
   * Check if can paginate forward
   */
  private canPaginateForward(timeline: EventTimeline): boolean {
    return typeof timeline.getPaginationToken(Direction.Forward) === 'string';
  }

  /**
   * Paginate backward (load older messages)
   */
  public async paginateBack(roomId: string): Promise<void> {
    if (!this.mx) return;

    const roomTimeline = this.chatTimelines.get(roomId);
    if (!roomTimeline || roomTimeline.isPaginating) return;

    roomTimeline.isPaginating = true;

    try {
      const topTimeline = roomTimeline.linkedTimelines[0];
      if (!topTimeline) return;

      const paginationToken = topTimeline.getPaginationToken(
        Direction.Backward,
      );
      if (!paginationToken) {
        roomTimeline.canPaginateBack = false;
        return;
      }

      // Paginate the timeline
      await this.mx.paginateEventTimeline(topTimeline, {
        backwards: true,
        limit: PAGINATION_LIMIT,
      });

      // Refresh linked timelines and messages
      this.refreshRoomMessages(roomId);
      this.updateChatSnapshot();
    } catch (error) {
      console.error('Error paginating back:', error);
    } finally {
      roomTimeline.isPaginating = false;
    }
  }

  /**
   * Paginate forward (load newer messages)
   */
  public async paginateForward(roomId: string): Promise<void> {
    if (!this.mx) return;

    const roomTimeline = this.chatTimelines.get(roomId);
    if (!roomTimeline || roomTimeline.isPaginating) return;

    roomTimeline.isPaginating = true;

    try {
      const bottomTimeline =
        roomTimeline.linkedTimelines[roomTimeline.linkedTimelines.length - 1];
      if (!bottomTimeline) return;

      const paginationToken = bottomTimeline.getPaginationToken(
        Direction.Forward,
      );
      if (!paginationToken) {
        roomTimeline.canPaginateForward = false;
        return;
      }

      // Paginate the timeline
      await this.mx.paginateEventTimeline(bottomTimeline, {
        backwards: false,
        limit: PAGINATION_LIMIT,
      });

      // Refresh linked timelines and messages
      this.refreshRoomMessages(roomId);
      this.updateChatSnapshot();
    } catch (error) {
      console.error('Error paginating forward:', error);
    } finally {
      roomTimeline.isPaginating = false;
    }
  }

  /**
   * Refresh messages from all linked timelines
   */
  private refreshRoomMessages(roomId: string) {
    const chat = this.mx?.getRoom(roomId);
    const chatTimeline = this.chatTimelines.get(roomId);

    if (!chat || !chatTimeline) return;

    const messages: ChatMessage[] = [];
    const seen = new Set<string>();

    // Get events from all linked timelines (avoiding duplicates)
    chatTimeline.linkedTimelines.forEach((timeline) => {
      timeline.getEvents().forEach((event) => {
        if (event.getType() === 'm.room.message' && !seen.has(event.getId()!)) {
          seen.add(event.getId()!);
          const message = matrixEventToMessage(event);
          messages.push(message);

          // Cache author
          if (!chatTimeline.authors.has(message.authorId)) {
            const author = this.extractAuthorFromEvent(chat, message.authorId);
            if (author) {
              chatTimeline.authors.set(message.authorId, author);
            }
          }
        }
      });
    });

    // Sort by timestamp (oldest first)
    messages.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    chatTimeline.messages = messages;
    chatTimeline.canPaginateBack = this.canPaginateBackward(
      chatTimeline.linkedTimelines[0],
    );
    chatTimeline.canPaginateForward = this.canPaginateForward(
      chatTimeline.linkedTimelines[chatTimeline.linkedTimelines.length - 1],
    );
  }

  private isNewLiveTimelineEvent(
    removed: boolean,
    data: IRoomTimelineData | undefined,
    toStartOfTimeline: boolean | undefined,
  ): boolean {
    return !removed && !!data?.liveEvent && !toStartOfTimeline;
  }

  public setCurrentChatId(id: string) {
    this.currentChatId = id;
    const newSnapshot = {
      currentChatId: this.currentChatId,
      timelineByChatId: this.chatTimelines,
    };
    this.updateSnapshot(newSnapshot);
  }
  /**
   * Cleanup listeners
   */
  override destroy() {
    if (!this.mx) return;
    this.mx.removeAllListeners(ClientEvent.Sync);
    super.destroy();
  }
}
