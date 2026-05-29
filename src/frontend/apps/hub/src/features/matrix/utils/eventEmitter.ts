/* eslint-disable @typescript-eslint/no-explicit-any */
import { MatrixUserInterface } from "../types";

export type EventListener<T = unknown> = (event: T) => void;
export type Unsubscribe = () => void;

export class EventEmitter<EventMap extends Record<string, unknown>> {
  private listeners = new Map<keyof EventMap, Set<EventListener<any>>>();
  private unsubscribers = new Map<keyof EventMap, Set<Unsubscribe>>();

  subscribe<K extends keyof EventMap>(
    eventName: K,
    listener: EventListener<EventMap[K]>,
  ): Unsubscribe {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    this.listeners.get(eventName)!.add(listener);

    return () => {
      this.listeners.get(eventName)?.delete(listener);
    };
  }

  emit<K extends keyof EventMap>(eventName: K, event: EventMap[K]): void {
    this.listeners.get(eventName)?.forEach((listener: EventListener<EventMap[K]>) => listener(event));
  }

  unsubscribeAll<K extends keyof EventMap>(eventName: K): void {
    this.unsubscribers.get(eventName)?.forEach(unsub => unsub());
    this.unsubscribers.delete(eventName);
  }

}

// Application event types
export type MatrixUserInitializedEvent = {
  user: MatrixUserInterface;
};

export type ApplicationEventMap = {
  "matrix:user:initialized": MatrixUserInitializedEvent;
  // Add more event types here as needed
};

export const applicationEmitter = new EventEmitter<ApplicationEventMap>();
