import { describe, expect, it, vi } from 'vitest';

import { Ndt7Protocol } from '../src/ndt7Protocol';
import { runUploadTest } from '../src/uploadTest';

class MockWebSocketWithoutBufferedAmount {
  static instances: MockWebSocketWithoutBufferedAmount[] = [];

  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onopen: (() => void) | null = null;
  sentBytes = 0;

  constructor(
    readonly url: string,
    readonly protocol: string
  ) {
    MockWebSocketWithoutBufferedAmount.instances.push(this);
  }

  send(data: Uint8Array) {
    this.sentBytes += data.byteLength;
  }

  close() {
    this.onclose?.();
  }
}

describe('runUploadTest', () => {
  it('does not emit or complete with NaN when bufferedAmount is unavailable', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocketWithoutBufferedAmount);
    MockWebSocketWithoutBufferedAmount.instances = [];
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

    const resultPromise = runUploadTest(urls, protocol, { onProgress });

    MockWebSocketWithoutBufferedAmount.instances[0]?.onopen?.();
    currentTime = 10_000;
    await vi.runOnlyPendingTimersAsync();

    await expect(resultPromise).resolves.toEqual({
      speedMbps: expect.any(Number),
    });

    const result = await resultPromise;
    expect(Number.isNaN(result.speedMbps)).toBe(false);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'upload',
        speedMbps: expect.any(Number),
        bytesTransferred: expect.any(Number),
      })
    );
    expect(Number.isNaN(onProgress.mock.calls.at(-1)?.[0].speedMbps)).toBe(false);

    vi.useRealTimers();
  });
});
