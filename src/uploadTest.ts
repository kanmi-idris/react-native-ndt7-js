import type { Ndt7ProgressEvent } from './types';

type UploadCallbacks = {
  onProgress: (event: Ndt7ProgressEvent) => void;
};

function getNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return () => performance.now();
  }

  return () => Date.now();
}

export function runUploadTest(urls: Record<string, string>, callbacks: UploadCallbacks) {
  return new Promise<{ speedMbps: number }>((resolve, reject) => {
    const url = urls['///ndt/v7/upload'];
    if (!url) {
      reject(new Error('Missing NDT7 upload URL'));
      return;
    }

    const socket = new WebSocket(url, 'net.measurementlab.ndt.v7');
    const now = getNow();
    let latestSpeed = 0;
    let settled = false;
    let closed = false;

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
      reject(new Error('upload socket error'));
    };

    const postClientMeasurement = (total: number, bufferedAmount: number, start: number) => {
      const numBytes = total - bufferedAmount;
      const elapsedSeconds = (now() - start) / 1000;
      latestSpeed = elapsedSeconds > 0 ? (numBytes * 8) / 1000000 / elapsedSeconds : 0;
      callbacks.onProgress({
        phase: 'upload',
        speedMbps: latestSpeed,
        elapsedMs: (now() - start),
        bytesTransferred: numBytes,
      });
    };

    const uploader = (data: Uint8Array, start: number, end: number, previous: number, total: number) => {
      if (closed || settled) {
        return;
      }

      const timestamp = now();
      if (timestamp >= end) {
        socket.close();
        postClientMeasurement(total, socket.bufferedAmount, start);
        return;
      }

      const maxMessageSize = 8 * 1024 * 1024;
      const nextSizeIncrement = data.length >= maxMessageSize ? Infinity : 16 * data.length;
      if ((total - socket.bufferedAmount) >= nextSizeIncrement) {
        data = new Uint8Array(Math.min(data.length * 2, maxMessageSize));
      }

      const desiredBuffer = 7 * data.length;
      if (socket.bufferedAmount < desiredBuffer) {
        socket.send(data);
        total += data.length;
      }

      if (timestamp >= previous + 250) {
        postClientMeasurement(total, socket.bufferedAmount, start);
        previous = timestamp;
      }

      setTimeout(() => uploader(data, start, end, previous, total), 0);
    };

    socket.onerror = () => settleReject();
    socket.onmessage = () => {
      // Upstream worker forwards server messages, but controller currently
      // exposes only normalized progress events, so no action is needed here.
    };
    socket.onopen = () => {
      const data = new Uint8Array(8192);
      const start = now();
      const end = start + 10000;
      uploader(data, start, end, start, 0);
    };
    socket.onclose = () => {
      if (!closed) {
        closed = true;
      }
      settleResolve();
    };
  });
}
