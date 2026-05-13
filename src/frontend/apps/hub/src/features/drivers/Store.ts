/**
 * Abstract base class for stores that manage state and notify subscribers
 * Designed to work with React's useSyncExternalStore hook
 */
export abstract class Store<T> {
  protected snapshot: T;
  protected listeners = new Set<CallableFunction>();

  constructor(initialSnapshot: T) {
    this.snapshot = initialSnapshot;
  }

  /**
   * Get the current snapshot of the store
   */
  getSnapshot(): T {
    return this.snapshot;
  }

  /**
   * Subscribe to store changes
   * @returns unsubscribe function
   */
  subscribe(listener: CallableFunction): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of changes
   */
  protected notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Update the snapshot and notify listeners
   */
  protected updateSnapshot(newSnapshot: T) {
    // Only update if the snapshot reference changed
    if (this.snapshot !== newSnapshot) {
      this.snapshot = newSnapshot;
      this.notifyListeners();
    }
  }

  /**
   * Cleanup listeners and resources
   */
  destroy() {
    this.listeners.clear();
  }
}
