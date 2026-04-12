import type { EventSubscription, Ndt7EventMap } from './types';

type ListenerMap = {
  [K in keyof Ndt7EventMap]: Set<(payload: Ndt7EventMap[K]) => void>;
};

export class Ndt7Emitter {
  private listeners: ListenerMap = {
    progress: new Set(),
    stateChange: new Set(),
    complete: new Set(),
    error: new Set(),
  };

  addListener<EventName extends keyof Ndt7EventMap>(
    event: EventName,
    listener: (payload: Ndt7EventMap[EventName]) => void
  ): EventSubscription {
    this.listeners[event].add(listener as never);
    return {
      remove: () => {
        this.listeners[event].delete(listener as never);
      },
    };
  }

  emit<EventName extends keyof Ndt7EventMap>(event: EventName, payload: Ndt7EventMap[EventName]) {
    for (const listener of this.listeners[event]) {
      listener(payload);
    }
  }
}
