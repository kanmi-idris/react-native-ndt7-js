import { afterEach, describe, expect, it, vi } from 'vitest';

import { Ndt7Protocol } from '../src/ndt7Protocol';
import { runDownloadTest } from '../src/downloadTest';

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string | Blob | ArrayBuffer }) => void) | null =
    null;
  onopen: (() => void) | null = null;

  constructor(
    readonly url: string,
    readonly protocol: string
  ) {
    MockWebSocket.instances.push(this);
  }

  close() {
    this.onclose?.();
  }

  emitMessage(data: string | Blob | ArrayBuffer) {
    this.onmessage?.({ data });
  }
}

describe('runDownloadTest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    MockWebSocket.instances = [];
  });

  it('keeps server telemetry separate from downloaded payload bytes', async () => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    let currentTime = 0;
    const onProgress = vi.fn();
    const protocol = new Ndt7Protocol({
      now: () => currentTime,
      progressIntervalMs: 1,
    });
    const urls = protocol.buildServerURLs(
      'wss://example.test/ndt/v7/download',
      'wss://example.test/ndt/v7/upload'
    );

    const resultPromise = runDownloadTest(urls, protocol, { onProgress });
    const socket = MockWebSocket.instances[0];

    socket?.onopen?.();
    socket?.emitMessage(new Uint8Array(1000).buffer);
    socket?.emitMessage(
      JSON.stringify({
        TCPInfo: {
          RTT: 2000,
          RTTVar: 500,
          MinRTT: 1000,
        },
      })
    );
    currentTime = 10;
    socket?.emitMessage(new Uint8Array(1000).buffer);
    socket?.close();

    await expect(resultPromise).resolves.toEqual({
      speedMbps: 1.6,
      metrics: {
        latencyMs: 2,
        jitterMs: 0.5,
        minRttMs: 1,
      },
    });
    expect(onProgress).toHaveBeenLastCalledWith({
      phase: 'download',
      speedMbps: 1.6,
      elapsedMs: 10,
      bytesTransferred: 2000,
      latencyMs: 2,
      jitterMs: 0.5,
      minRttMs: 1,
    });
  });
});
