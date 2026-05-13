import type { Ndt7ServerMetrics } from "./ndt7Protocol";

export type Ndt7WebSocketPhaseResult = {
  speedMbps: number;
  metrics?: Ndt7ServerMetrics;
};

type Ndt7WebSocketPhaseContext = {
  socket: WebSocket;
  isSettled(): boolean;
  /** Starts phase timing after the WebSocket/TLS handshake instead of during connection setup. */
  markOpen(): void;
  resolve(): void;
  reject(): void;
};

type Ndt7WebSocketPhaseOptions = {
  url: string | undefined;
  websocketProtocol: string;
  missingURLMessage: string;
  socketErrorMessage: string;
  connectionTimeoutMessage?: string;
  connectionTimeoutMs?: number;
  phaseTimeoutMs?: number;
  getResult(): Ndt7WebSocketPhaseResult;
  run(context: Ndt7WebSocketPhaseContext): void;
};

/**
 * Runs one NDT7 phase through a WebSocket with shared once-only settlement.
 *
 * Download and upload still own transfer behavior; this module keeps socket
 * creation, close/error handling, and phase settlement consistent.
 */
export function runNdt7WebSocketPhase(options: Ndt7WebSocketPhaseOptions) {
  return new Promise<Ndt7WebSocketPhaseResult>((resolve, reject) => {
    if (!options.url) {
      reject(new Error(options.missingURLMessage));
      return;
    }

    const socket = new WebSocket(options.url, options.websocketProtocol);
    let settled = false;
    let opened = false;
    let connectionTimeout: ReturnType<typeof setTimeout> | undefined;
    let phaseTimeout: ReturnType<typeof setTimeout> | undefined;

    const clearTimeouts = () => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = undefined;
      }

      if (phaseTimeout) {
        clearTimeout(phaseTimeout);
        phaseTimeout = undefined;
      }
    };

    const settleResolve = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeouts();
      resolve(options.getResult());
    };

    const settleReject = (message = options.socketErrorMessage) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeouts();
      reject(new Error(message));
    };

    const markOpen = () => {
      if (settled || opened) {
        return;
      }

      opened = true;
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = undefined;
      }

      const phaseTimeoutMs = options.phaseTimeoutMs ?? 12000;
      if (phaseTimeoutMs > 0) {
        /** A phase timeout is a liveness guard, so settle with the latest measurement. */
        phaseTimeout = setTimeout(() => {
          settleResolve();
        }, phaseTimeoutMs);
      }
    };

    const connectionTimeoutMs = options.connectionTimeoutMs ?? 10000;
    if (connectionTimeoutMs > 0) {
      connectionTimeout = setTimeout(() => {
        settleReject(
          options.connectionTimeoutMessage ?? options.socketErrorMessage,
        );
      }, connectionTimeoutMs);
    }

    socket.onerror = () => settleReject();
    socket.onclose = () => settleResolve();
    options.run({
      socket,
      isSettled: () => settled,
      markOpen,
      resolve: settleResolve,
      reject: settleReject,
    });
  });
}
