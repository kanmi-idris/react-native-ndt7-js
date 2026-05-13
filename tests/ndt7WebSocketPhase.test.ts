import { afterEach, describe, expect, it, vi } from 'vitest';

import { runNdt7WebSocketPhase } from '../src/ndt7WebSocketPhase';

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;

  constructor(
    readonly url: string,
    readonly protocol: string
  ) {
    MockWebSocket.instances.push(this);
  }
}

describe('runNdt7WebSocketPhase', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    MockWebSocket.instances = [];
  });

  it('rejects before socket creation when the phase URL is missing', async () => {
    const run = vi.fn();

    await expect(
      runNdt7WebSocketPhase({
        url: undefined,
        websocketProtocol: 'test-protocol',
        missingURLMessage: 'missing url',
        socketErrorMessage: 'socket failed',
        getResult: () => ({ speedMbps: 0 }),
        run,
      })
    ).rejects.toThrow('missing url');

    expect(run).not.toHaveBeenCalled();
  });

  it('resolves once with the latest result when the socket closes', async () => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    MockWebSocket.instances = [];
    let speedMbps = 0;

    const resultPromise = runNdt7WebSocketPhase({
      url: 'wss://example.test/ndt/v7/download',
      websocketProtocol: 'test-protocol',
      missingURLMessage: 'missing url',
      socketErrorMessage: 'socket failed',
      getResult: () => ({ speedMbps }),
      run: () => {
        speedMbps = 12;
      },
    });

    MockWebSocket.instances[0]?.onclose?.();
    MockWebSocket.instances[0]?.onclose?.();

    await expect(resultPromise).resolves.toEqual({ speedMbps: 12 });
  });

  it('rejects once when the socket errors', async () => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    MockWebSocket.instances = [];

    const resultPromise = runNdt7WebSocketPhase({
      url: 'wss://example.test/ndt/v7/upload',
      websocketProtocol: 'test-protocol',
      missingURLMessage: 'missing url',
      socketErrorMessage: 'socket failed',
      getResult: () => ({ speedMbps: 0 }),
      run: () => {},
    });

    MockWebSocket.instances[0]?.onerror?.();
    MockWebSocket.instances[0]?.onclose?.();

    await expect(resultPromise).rejects.toThrow('socket failed');
  });

  it('rejects when the socket never opens', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocket);

    const resultPromise = runNdt7WebSocketPhase({
      url: 'wss://example.test/ndt/v7/download',
      websocketProtocol: 'test-protocol',
      missingURLMessage: 'missing url',
      socketErrorMessage: 'socket failed',
      connectionTimeoutMessage: 'connection timed out',
      connectionTimeoutMs: 5,
      getResult: () => ({ speedMbps: 0 }),
      run: () => {},
    });

    const rejection = expect(resultPromise).rejects.toThrow('connection timed out');
    await vi.advanceTimersByTimeAsync(5);

    await rejection;
  });

  it('resolves with the latest result when an opened phase times out', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocket);
    let speedMbps = 0;

    const resultPromise = runNdt7WebSocketPhase({
      url: 'wss://example.test/ndt/v7/download',
      websocketProtocol: 'test-protocol',
      missingURLMessage: 'missing url',
      socketErrorMessage: 'socket failed',
      phaseTimeoutMs: 7,
      getResult: () => ({ speedMbps }),
      run: ({ socket, markOpen }) => {
        socket.onopen = () => {
          markOpen();
          speedMbps = 42;
        };
      },
    });

    MockWebSocket.instances[0]?.onopen?.();
    await vi.advanceTimersByTimeAsync(7);

    await expect(resultPromise).resolves.toEqual({ speedMbps: 42 });
  });
});
