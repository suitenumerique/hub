/**
 * Watches a database the SDK keeps open, through a connection of its own.
 * When the browser force-closes or deletes it (storage eviction under low
 * disk space, corruption, cleared site data), every connection to it gets
 * `close`. The Rust crypto store has no such handler and never reopens:
 * every later read of it fails, each message becomes undecryptable (#153).
 *
 * The watcher never creates the database: a missing one aborts the upgrade
 * and counts as closed. It gives way to a deletion or an upgrade
 * (`versionchange`), which ends the store as surely as a close.
 *
 * `onClosed` runs at most once, never after `stop` is called.
 */
export const watchDatabaseClosure = (
  name: string,
  onClosed: () => void,
): (() => void) => {
  let stopped = false;
  let database: IDBDatabase | null = null;
  const closed = () => {
    database = null;
    if (stopped) return;
    stopped = true;
    onClosed();
  };
  const request = indexedDB.open(name);
  request.onupgradeneeded = () => {
    request.transaction?.abort();
    closed();
  };
  request.onsuccess = () => {
    database = request.result;
    if (stopped) {
      database.close();
      database = null;
      return;
    }
    database.onclose = closed;
    database.onversionchange = () => {
      database?.close();
      closed();
    };
  };
  return () => {
    stopped = true;
    database?.close();
    database = null;
  };
};
