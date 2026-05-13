import { describe, expect, it } from 'vitest';

import { Ndt7Protocol } from '../src/ndt7Protocol';

describe('Ndt7Protocol', () => {
  it('builds server URL maps using NDT7 endpoint keys', () => {
    const protocol = new Ndt7Protocol();

    const urls = protocol.buildServerURLs(
      'wss://ndt.example.test/ndt/v7/download',
      'wss://ndt.example.test/ndt/v7/upload'
    );

    expect(urls[protocol.getURLKey('download')]).toBe(
      'wss://ndt.example.test/ndt/v7/download'
    );
    expect(urls[protocol.getURLKey('upload')]).toBe('wss://ndt.example.test/ndt/v7/upload');
  });

  it('builds locate keys using the configured network protocol', () => {
    const protocol = new Ndt7Protocol({ protocol: 'ws' });

    expect(protocol.getLocateURLKey('download')).toBe('ws:///ndt/v7/download');
    expect(protocol.getLocateURLKey('upload')).toBe('ws:///ndt/v7/upload');
  });

  it('measures message size across WebSocket payload shapes', () => {
    const protocol = new Ndt7Protocol();

    expect(protocol.getMessageSize('abcd')).toBe(4);
    expect(protocol.getMessageSize(new Uint8Array([1, 2, 3]).buffer)).toBe(3);
    expect(protocol.getMessageSize(new Blob(['abc']))).toBe(3);
  });

  it('calculates Mbps from bytes and elapsed milliseconds', () => {
    const protocol = new Ndt7Protocol();

    expect(protocol.calculateMbps(1_000_000, 1000)).toBe(8);
    expect(protocol.calculateMbps(1_000_000, 0)).toBe(0);
  });

  it('parses server measurements and derives TCP timing metrics', () => {
    const protocol = new Ndt7Protocol();
    const measurement = protocol.parseServerMeasurement(
      JSON.stringify({
        TCPInfo: {
          RTT: 2500,
          RTTVar: 700,
          MinRTT: 1200,
        },
      })
    );

    expect(protocol.getServerMetrics(measurement)).toEqual({
      latencyMs: 2.5,
      jitterMs: 0.7,
      minRttMs: 1.2,
    });
    expect(protocol.parseServerMeasurement('{not-json')).toBeNull();
  });
});
