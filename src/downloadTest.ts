import type { Ndt7Protocol, Ndt7ServerURLs } from './ndt7Protocol';
import { runNdt7WebSocketPhase } from './ndt7WebSocketPhase';
import type { Ndt7ProgressEvent } from './types';

type DownloadCallbacks = {
  onProgress: (event: Ndt7ProgressEvent) => void;
};

/**
 * Runs the download phase by reading NDT7 WebSocket messages.
 *
 * The phase owns socket lifecycle and byte counters; Ndt7Protocol supplies the
 * shared rules for URL lookup, subprotocol, timing, byte sizing, and Mbps math.
 */
export function runDownloadTest(
  urls: Ndt7ServerURLs,
  ndt7Protocol: Ndt7Protocol,
  callbacks: DownloadCallbacks
) {
  const now = () => ndt7Protocol.now();
  let startedAt = now();
  let lastMeasureAt = startedAt;
  let totalBytes = 0;
  let latestSpeed = 0;

  return runNdt7WebSocketPhase({
    url: ndt7Protocol.getDownloadURL(urls),
    websocketProtocol: ndt7Protocol.websocketProtocol,
    missingURLMessage: 'Missing NDT7 download URL',
    socketErrorMessage: 'download socket error',
    getResult: () => ({ speedMbps: latestSpeed }),
    run: ({ socket }) => {
      socket.onopen = () => {
        startedAt = now();
        lastMeasureAt = startedAt;
        totalBytes = 0;
        latestSpeed = 0;
      };
      socket.onmessage = (event: MessageEvent<string | Blob | ArrayBuffer>) => {
        const size = ndt7Protocol.getMessageSize(event.data);
        totalBytes += size;
        const timestamp = now();
        if (timestamp - lastMeasureAt > ndt7Protocol.progressIntervalMs) {
          const elapsedMs = timestamp - startedAt;
          latestSpeed = ndt7Protocol.calculateMbps(totalBytes, elapsedMs);
          callbacks.onProgress({
            phase: 'download',
            speedMbps: latestSpeed,
            elapsedMs,
            bytesTransferred: totalBytes,
          });
          lastMeasureAt = timestamp;
        }
      };
    },
  });
}
