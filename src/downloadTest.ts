import type { Ndt7ProgressEvent } from './types';

type DownloadCallbacks = {
  onProgress: (event: Ndt7ProgressEvent) => void;
};

export function runDownloadTest(urls: Record<string, string>, callbacks: DownloadCallbacks) {
  return new Promise<{ speedMbps: number }>((resolve, reject) => {
    const url = urls['///ndt/v7/download'];
    if (!url) {
      reject(new Error('Missing NDT7 download URL'));
      return;
    }

    const socket = new WebSocket(url, 'net.measurementlab.ndt.v7');
    const startedAt = Date.now();
    let lastMeasureAt = startedAt;
    let totalBytes = 0;
    let latestSpeed = 0;

    socket.onerror = () => reject(new Error('download socket error'));
    socket.onmessage = (event: MessageEvent<string | Blob | ArrayBuffer>) => {
      const size = typeof event.data === 'string'
        ? event.data.length
        : 'size' in event.data
          ? event.data.size
          : event.data.byteLength;
      totalBytes += size;
      const now = Date.now();
      if (now - lastMeasureAt >= 250) {
        const elapsedMs = now - startedAt;
        latestSpeed = elapsedMs > 0 ? (totalBytes / elapsedMs) * 0.008 : 0;
        callbacks.onProgress({
          phase: 'download',
          speedMbps: latestSpeed,
          elapsedMs,
          bytesTransferred: totalBytes,
        });
        lastMeasureAt = now;
      }
    };
    socket.onclose = () => resolve({ speedMbps: latestSpeed });
  });
}
