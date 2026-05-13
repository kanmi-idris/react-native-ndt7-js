type Ndt7WebSocketPhaseResult = {
  speedMbps: number;
};

type Ndt7WebSocketPhaseContext = {
  socket: WebSocket;
  isSettled(): boolean;
  resolve(): void;
  reject(): void;
};

type Ndt7WebSocketPhaseOptions = {
  url: string | undefined;
  websocketProtocol: string;
  missingURLMessage: string;
  socketErrorMessage: string;
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

    const settleResolve = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(options.getResult());
    };

    const settleReject = () => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error(options.socketErrorMessage));
    };

    socket.onerror = () => settleReject();
    socket.onclose = () => settleResolve();
    options.run({
      socket,
      isSettled: () => settled,
      resolve: settleResolve,
      reject: settleReject,
    });
  });
}
