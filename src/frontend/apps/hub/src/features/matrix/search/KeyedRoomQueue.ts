type KeyedRoomQueueOptions = {
  concurrency: number;
  worker: (roomId: string) => Promise<void>;
  onIdle: () => void;
};

/** Bounded FIFO work plus per-room serialization for Matrix room updates. */
export class KeyedRoomQueue {
  private readonly concurrency: number;
  private readonly worker: (roomId: string) => Promise<void>;
  private readonly onIdle: () => void;
  private pendingRoomIds = new Set<string>();
  private pendingRooms: string[] = [];
  private activeWorkers = 0;
  private operations = new Map<string, Promise<void>>();
  private busy = false;
  private stopped = false;

  constructor({ concurrency, worker, onIdle }: KeyedRoomQueueOptions) {
    this.concurrency = concurrency;
    this.worker = worker;
    this.onIdle = onIdle;
  }

  /** Dedupe waiting work while allowing a currently running room to requeue. */
  enqueue(roomId: string): boolean {
    if (this.stopped || this.pendingRoomIds.has(roomId)) {
      return false;
    }
    this.busy = true;
    this.pendingRoomIds.add(roomId);
    this.pendingRooms.push(roomId);
    this.schedule();
    return true;
  }

  removePending(roomId: string): void {
    if (!this.pendingRoomIds.delete(roomId)) {
      return;
    }
    this.pendingRooms = this.pendingRooms.filter((queued) => queued !== roomId);
    this.finishIfIdle();
  }

  clearPending(): void {
    this.pendingRoomIds.clear();
    this.pendingRooms = [];
  }

  stop(): void {
    this.stopped = true;
    this.clearPending();
  }

  /** Order all asynchronous mutations for one room without blocking others. */
  serialize(roomId: string, operation: () => Promise<void>): Promise<void> {
    const previous = this.operations.get(roomId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.operations.set(roomId, current);
    return current.finally(() => {
      if (this.operations.get(roomId) === current) {
        this.operations.delete(roomId);
      }
    });
  }

  private schedule(): void {
    if (this.stopped) {
      return;
    }
    while (
      this.activeWorkers < this.concurrency &&
      this.pendingRooms.length > 0
    ) {
      const roomId = this.pendingRooms.shift();
      if (!roomId) {
        break;
      }
      // Removing before work starts allows an in-flight event to requeue it.
      this.pendingRoomIds.delete(roomId);
      this.activeWorkers += 1;
      const finishWorker = () => {
        this.activeWorkers -= 1;
        window.setTimeout(() => {
          if (this.stopped) {
            return;
          }
          this.schedule();
          this.finishIfIdle();
        }, 0);
      };
      // Both outcomes release the worker slot; the worker owns error reporting.
      void this.serialize(roomId, () => this.worker(roomId)).then(
        finishWorker,
        finishWorker,
      );
    }
  }

  private finishIfIdle(): void {
    if (
      !this.busy ||
      this.stopped ||
      this.activeWorkers > 0 ||
      this.pendingRooms.length > 0
    ) {
      return;
    }
    this.busy = false;
    this.onIdle();
  }
}
