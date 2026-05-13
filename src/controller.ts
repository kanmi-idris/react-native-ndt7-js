import { runSpeedTest } from "./speedTestRun";
import type {
  EventSubscription,
  Ndt7EventMap,
  Ndt7StartOptions,
  SpeedTestState,
  StartSpeedTestResult,
} from "./types";

type ListenerMap = {
  [K in keyof Ndt7EventMap]: Set<(payload: Ndt7EventMap[K]) => void>;
};

/**
 * Owns the public speed-test lifecycle and event surface.
 *
 * The controller coordinates a run, but leaves NDT7 URL/measurement rules to
 * Ndt7Protocol and phase-specific WebSocket behavior to download/upload modules.
 */
export class Ndt7Controller {
  private listeners: ListenerMap = {
    progress: new Set(),
    stateChange: new Set(),
    complete: new Set(),
    error: new Set(),
  };
  private state: SpeedTestState = "idle";
  /**
   * Soft cancellation invalidates a run instead of pretending every platform
   * can synchronously tear down in-flight WebSockets.
   */
  private activeRunId: number | null = null;
  private nextRunId = 1;

  /**
   * Starts the async run on a microtask so callers get the accepted state
   * immediately while state/progress events still flow through subscriptions.
   */
  async startSpeedTest(
    options: Ndt7StartOptions = {},
  ): Promise<StartSpeedTestResult> {
    if (
      this.state === "starting" ||
      this.state === "running" ||
      this.state === "stopping"
    ) {
      return { state: this.state, alreadyRunning: true };
    }

    const runId = this.nextRunId++;
    this.activeRunId = runId;
    this.transition("starting");

    /** Start the run after returning the accepted state; results arrive through events. */
    queueMicrotask(async () => {
      await runSpeedTest({
        options,
        isCurrent: () => this.activeRunId === runId,
        lifecycle: {
          transition: (state) => this.transition(state),
          emitProgress: (event) => this.emit("progress", event),
          emitComplete: (event) => this.emit("complete", event),
          emitError: (event) => this.emit("error", event),
        },
      });

      if (this.activeRunId === runId) {
        this.activeRunId = null;
      }
    });

    return {
      state: this.state,
      alreadyRunning: false,
    };
  }

  async stopSpeedTest(): Promise<void> {
    if (this.state === "idle") {
      return;
    }

    this.activeRunId = null;
    this.transition("stopping");
    this.emit("error", {
      code: "CANCELLED",
      message: "Speed test cancelled",
    });
    this.transition("idle");
  }

  async getState() {
    return this.state;
  }

  /** Registers a listener for one event type and returns a removable subscription. */
  addListener<EventName extends keyof Ndt7EventMap>(
    event: EventName,
    listener: (payload: Ndt7EventMap[EventName]) => void,
  ): EventSubscription {
    this.listeners[event].add(listener as never);
    return {
      remove: () => {
        this.listeners[event].delete(listener as never);
      },
    };
  }

  /** Updates the current state and notifies state-change subscribers. */
  private transition(next: SpeedTestState) {
    this.state = next;
    this.emit("stateChange", { state: next });
  }

  /** Delivers an event payload to every listener registered for that event type. */
  private emit<EventName extends keyof Ndt7EventMap>(
    event: EventName,
    payload: Ndt7EventMap[EventName],
  ) {
    for (const listener of this.listeners[event]) {
      listener(payload);
    }
  }
}
