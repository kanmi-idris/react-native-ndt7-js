import { describe, expect, it, vi } from 'vitest';

describe('resolveNdt7ServerURLs', () => {
  it('builds direct server URLs without assigning URLSearchParams objects', async () => {
    const { resolveNdt7ServerURLs } = await import('../src/discoverServer');

    const result = await resolveNdt7ServerURLs({
      server: 'ndt.example.test',
      protocol: 'wss',
      metadata: {
        client_name: 'example-app',
      },
    });

    expect(result['///ndt/v7/download']).toContain('wss://ndt.example.test/ndt/v7/download?');
    expect(result['///ndt/v7/upload']).toContain('wss://ndt.example.test/ndt/v7/upload?');
    expect(result['///ndt/v7/download']).toContain('client_name=example-app');
    expect(result['///ndt/v7/download']).toContain(
      'client_library_name=%40_molaidrislabs%2Freact-native-ndt7-js'
    );
  });

  it('fetches locate results with string URLs and returns first server URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        results: [
          {
            machine: 'test-node',
            urls: {
              'wss:///ndt/v7/download': 'wss://locate.example.test/ndt/v7/download',
              'wss:///ndt/v7/upload': 'wss://locate.example.test/ndt/v7/upload',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { resolveNdt7ServerURLs } = await import('../src/discoverServer');
    const onServerChosen = vi.fn();

    const result = await resolveNdt7ServerURLs(
      {
        protocol: 'wss',
        metadata: { client_name: 'example-app' },
      },
      { onServerChosen }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://locate.measurementlab.net/v2/nearest/ndt/ndt7?'),
      { headers: undefined }
    );
    expect(onServerChosen).toHaveBeenCalledWith(
      expect.objectContaining({ machine: 'test-node' })
    );
    expect(result).toEqual({
      '///ndt/v7/download': 'wss://locate.example.test/ndt/v7/download',
      '///ndt/v7/upload': 'wss://locate.example.test/ndt/v7/upload',
    });
  });
});
