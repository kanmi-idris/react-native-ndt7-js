import { afterEach, describe, expect, it, vi } from 'vitest';

import { runSpeedTest } from '../src/speedTestRun';

const locateResponse = {
  results: [
    {
      machine: 'test-node',
      location: {
        city: 'Lagos',
        country: 'NG',
      },
      urls: {
        'wss:///ndt/v7/download': 'wss://example.test/ndt/v7/download',
        'wss:///ndt/v7/upload': 'wss://example.test/ndt/v7/upload',
      },
    },
  ],
};

function createLifecycle() {
  return {
    transition: vi.fn(),
    emitProgress: vi.fn(),
    emitComplete: vi.fn(),
    emitError: vi.fn(),
  };
}

class AutoCloseWebSocket {
  onclose: (() => void) | null = null;
  onopen: (() => void) | null = null;

  constructor(
    readonly url: string,
    readonly protocol: string
  ) {
    queueMicrotask(() => {
      this.onopen?.();
      this.onclose?.();
    });
  }

  send() {}

  close() {
    this.onclose?.();
  }
}

describe('runSpeedTest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns without lifecycle events when cancelled during discovery', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => locateResponse }));
    const lifecycle = createLifecycle();

    await runSpeedTest({
      options: { mlabDataPolicyInapplicable: true },
      lifecycle,
      isCurrent: () => false,
    });

    expect(lifecycle.transition).not.toHaveBeenCalled();
    expect(lifecycle.emitProgress).not.toHaveBeenCalled();
    expect(lifecycle.emitComplete).not.toHaveBeenCalled();
    expect(lifecycle.emitError).not.toHaveBeenCalled();
  });

  it('emits a failed terminal lifecycle when discovery fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('locate unavailable')));
    const lifecycle = createLifecycle();

    await runSpeedTest({
      options: { mlabDataPolicyInapplicable: true },
      lifecycle,
      isCurrent: () => true,
    });

    expect(lifecycle.emitError).toHaveBeenCalledWith({
      code: 'TEST_FAILED',
      message: 'locate unavailable',
    });
    expect(lifecycle.transition).toHaveBeenNthCalledWith(1, 'failed');
    expect(lifecycle.transition).toHaveBeenNthCalledWith(2, 'idle');
  });

  it('fails before discovery when the M-Lab data policy is not accepted', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const lifecycle = createLifecycle();

    await runSpeedTest({
      options: {},
      lifecycle,
      isCurrent: () => true,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(lifecycle.emitError).toHaveBeenCalledWith({
      code: 'TEST_FAILED',
      message:
        'The M-Lab data policy is applicable and the user has not explicitly accepted that data policy.',
    });
  });

  it('includes selected server metadata in complete events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => locateResponse }));
    vi.stubGlobal('WebSocket', AutoCloseWebSocket);
    const lifecycle = createLifecycle();

    await runSpeedTest({
      options: { userAcceptedDataPolicy: true },
      lifecycle,
      isCurrent: () => true,
    });

    expect(lifecycle.emitComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        downloadMbps: 0,
        uploadMbps: 0,
        serverName: 'test-node',
        serverLocation: 'Lagos, NG',
      })
    );
  });
});
