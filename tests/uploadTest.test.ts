import { afterEach, describe, expect, it, vi } from 'vitest';

import { Ndt7Protocol } from '../src/ndt7Protocol';
import { runUploadTest } from '../src/uploadTest';

class MockWebSocketWithoutBufferedAmount {
  static instances: MockWebSocketWithoutBufferedAmount[] = [];

  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
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

  emitMessage(data: unknown) {
    this.onmessage?.({ data });
  }
}

class MockWebSocketWithBufferedAmount extends MockWebSocketWithoutBufferedAmount {
  static override instances: MockWebSocketWithBufferedAmount[] = [];

  bufferedAmount = 0;

  constructor(url: string, protocol: string) {
    super(url, protocol);
    MockWebSocketWithBufferedAmount.instances.push(this);
  }
}

describe('runUploadTest', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    MockWebSocketWithoutBufferedAmount.instances = [];
    MockWebSocketWithBufferedAmount.instances = [];
  });

  it('uses NDT7 server AppInfo for upload speed when bufferedAmount is unavailable', async () => {
    vi.stubGlobal('WebSocket', MockWebSocketWithoutBufferedAmount);
    const onProgress = vi.fn();
    const protocol = new Ndt7Protocol();
    const urls = protocol.buildServerURLs(
      'wss://example.test/ndt/v7/download',
      'wss://example.test/ndt/v7/upload'
    );

    const resultPromise = runUploadTest(urls, protocol, { onProgress });
    const socket = MockWebSocketWithoutBufferedAmount.instances[0];

    socket?.onopen?.();
    socket?.emitMessage(
      JSON.stringify({
        AppInfo: {
          NumBytes: 125_000,
          ElapsedTime: 500_000,
        },
      })
    );
    socket?.close();

    await expect(resultPromise).resolves.toEqual({
      speedMbps: 2,
    });
    expect(onProgress).toHaveBeenLastCalledWith({
      phase: 'upload',
      speedMbps: 2,
      elapsedMs: 500,
      bytesTransferred: 125_000,
    });
  });

  it('does not emit or complete with NaN when bufferedAmount is unavailable', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocketWithoutBufferedAmount);
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
  });

  it('ignores malformed upload server messages', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocketWithoutBufferedAmount);
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
    const socket = MockWebSocketWithoutBufferedAmount.instances[0];

    socket?.onopen?.();
    socket?.emitMessage('{not-json');
    socket?.emitMessage(JSON.stringify({ AppInfo: { NumBytes: 'bad' } }));
    currentTime = 10_000;
    await vi.runOnlyPendingTimersAsync();

    const result = await resultPromise;
    expect(Number.isNaN(result.speedMbps)).toBe(false);
    expect(Number.isNaN(onProgress.mock.calls.at(-1)?.[0].speedMbps)).toBe(false);
  });

  it('keeps browser-style bufferedAmount measurement when it is available', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocketWithBufferedAmount);
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
    const socket = MockWebSocketWithBufferedAmount.instances[0];

    socket?.onopen?.();
    if (socket) {
      socket.bufferedAmount = 4096;
    }
    currentTime = 10_000;
    await vi.runOnlyPendingTimersAsync();

    await expect(resultPromise).resolves.toEqual({
      speedMbps: 0.0032768,
    });
    expect(onProgress).toHaveBeenLastCalledWith({
      phase: 'upload',
      speedMbps: 0.0032768,
      elapsedMs: 10_000,
      bytesTransferred: 4096,
    });
  });

  it('returns a finite result if the socket closes before any upload measurement', async () => {
    vi.stubGlobal('WebSocket', MockWebSocketWithoutBufferedAmount);
    const protocol = new Ndt7Protocol();
    const urls = protocol.buildServerURLs(
      'wss://example.test/ndt/v7/download',
      'wss://example.test/ndt/v7/upload'
    );

    const resultPromise = runUploadTest(urls, protocol, { onProgress: vi.fn() });
    const socket = MockWebSocketWithoutBufferedAmount.instances[0];

    socket?.close();

    const result = await resultPromise;
    expect(Number.isFinite(result.speedMbps)).toBe(true);
  });
});
