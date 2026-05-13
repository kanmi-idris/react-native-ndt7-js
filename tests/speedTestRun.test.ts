import { describe, expect, it, vi } from 'vitest';

import { runSpeedTest } from '../src/speedTestRun';

const locateResponse = {
  results: [
    {
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

describe('runSpeedTest', () => {
  it('returns without lifecycle events when cancelled during discovery', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => locateResponse }));
    const lifecycle = createLifecycle();

    await runSpeedTest({
      options: {},
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
      options: {},
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
});
