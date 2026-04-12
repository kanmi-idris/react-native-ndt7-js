import type { Ndt7ProgressEvent } from './types';

type UploadCallbacks = {
  onProgress: (event: Ndt7ProgressEvent) => void;
};

export function runUploadTest(urls: Record<string, string>, callbacks: UploadCallbacks) {
  return new Promise<{ speedMbps: number }>((resolve, reject) => {
    const url = urls['///ndt/v7/upload'];
    if (!url) {
      reject(new Error('Missing NDT7 upload URL'));
      return;
    }

    const socket = new WebSocket(url, 'net.measurementlab.ndt.v7');
    const startedAt = Date.now();
    let totalBytes = 0;
    let latestSpeed = 0;
    let cancelled = false;

    const sendLoop = (data: Uint8Array) => {
      if (cancelled || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      const now = Date.now();
      const elapsedMs = now - startedAt;
      if (elapsedMs >= 10000) {
        socket.close();
        return;
      }

      socket.send(data);
      totalBytes += data.length;
      latestSpeed = elapsedMs > 0 ? (totalBytes / elapsedMs) * 0.008 : 0;
      callbacks.onProgress({
        phase: 'upload',
        speedMbps: latestSpeed,
        elapsedMs,
        bytesTransferred: totalBytes,
      });
      setTimeout(() => sendLoop(data.length < 8 * 1024 * 1024 ? new Uint8Array(data.length * 2) : data), 0);
    };

    socket.onerror = () => reject(new Error('upload socket error'));
    socket.onopen = () => sendLoop(new Uint8Array(8192));
    socket.onclose = () => {
      cancelled = true;
      resolve({ speedMbps: latestSpeed });
    };
  });
}
