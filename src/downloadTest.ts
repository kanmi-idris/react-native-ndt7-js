import type { Ndt7ProgressEvent } from './types';

type DownloadCallbacks = {
  onProgress: (event: Ndt7ProgressEvent) => void;
};

function getNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return () => performance.now();
  }

  return () => Date.now();
}

function getMessageSize(data: string | Blob | ArrayBuffer) {
  if (typeof data === 'string') {
    return data.length;
  }

  if (data instanceof ArrayBuffer) {
    return data.byteLength;
  }

  if ('size' in data && typeof data.size === 'number') {
    return data.size;
  }

  return 0;
}

export function runDownloadTest(urls: Record<string, string>, callbacks: DownloadCallbacks) {
  return new Promise<{ speedMbps: number }>((resolve, reject) => {
    const url = urls['///ndt/v7/download'];
    if (!url) {
      reject(new Error('Missing NDT7 download URL'));
      return;
    }

    const socket = new WebSocket(url, 'net.measurementlab.ndt.v7');
    const now = getNow();
    let startedAt = now();
    let lastMeasureAt = startedAt;
    let totalBytes = 0;
    let latestSpeed = 0;
    let settled = false;

    const settleResolve = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({ speedMbps: latestSpeed });
    };

    const settleReject = () => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error('download socket error'));
    };

    socket.onerror = () => settleReject();
    socket.onopen = () => {
      startedAt = now();
      lastMeasureAt = startedAt;
      totalBytes = 0;
      latestSpeed = 0;
    };
    socket.onmessage = (event: MessageEvent<string | Blob | ArrayBuffer>) => {
      const size = getMessageSize(event.data);
      totalBytes += size;
      const timestamp = now();
      if (timestamp - lastMeasureAt > 250) {
        const elapsedMs = timestamp - startedAt;
        latestSpeed = elapsedMs > 0 ? (totalBytes / elapsedMs) * 0.008 : 0;
        callbacks.onProgress({
          phase: 'download',
          speedMbps: latestSpeed,
          elapsedMs,
          bytesTransferred: totalBytes,
        });
        lastMeasureAt = timestamp;
      }
    };
    socket.onclose = () => settleResolve();
  });
}
